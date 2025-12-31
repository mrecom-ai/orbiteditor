/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from './dispose';
import { AutomationResult } from './automation/automationTypes';
import { generateSessionId } from './automation/utils';
import { buildHoverScript, buildPickScript, ElementBoundingBox, ElementSelectionHoverData, ElementSelectionPickData } from './automation/elementSelection';
import { BrowserAutomationService } from './automation/browserAutomationService';

// Message types received from webview - defined inline for type safety


export interface ShowOptions {
	readonly preserveFocus?: boolean;
	readonly viewColumn?: vscode.ViewColumn;
}

export class SimpleBrowserView extends Disposable {

	public static readonly viewType = 'simpleBrowser.view';
	private static readonly title = vscode.l10n.t("Simple Browser");

	private static getWebviewLocalResourceRoots(extensionUri: vscode.Uri): readonly vscode.Uri[] {
		return [
			vscode.Uri.joinPath(extensionUri, 'media')
		];
	}

	private static getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
		return {
			enableScripts: true,
			enableForms: true,
			localResourceRoots: SimpleBrowserView.getWebviewLocalResourceRoots(extensionUri),
		};
	}

	private readonly _webviewPanel: vscode.WebviewPanel;
	private _isInitialized = false;

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDispose = this._onDidDispose.event;

	private currentUrl: string = '';

	// --- Element selection (Cursor-style) ---
	private elementSelectionSessionId: string | undefined;
	private elementSelectionViewport: { width: number; height: number } | undefined;
	private elementSelectionLastUrl: string | undefined;
	private elementSelectionHoverRequestId = 0;

	// --- Navigation sync state ---
	private navigationSyncEnabled = true;
	private mainAutomationSessionId: string | undefined;
	private navigationInProgress = false;
	private pendingNavigation: string | undefined;

	public static create(
		extensionUri: vscode.Uri,
		url: string,
		showOptions?: ShowOptions
	): SimpleBrowserView {
		const webview = vscode.window.createWebviewPanel(SimpleBrowserView.viewType, SimpleBrowserView.title, {
			viewColumn: showOptions?.viewColumn ?? vscode.ViewColumn.Active,
			preserveFocus: showOptions?.preserveFocus
		}, {
			retainContextWhenHidden: true,
			...SimpleBrowserView.getWebviewOptions(extensionUri)
		});
		return new SimpleBrowserView(extensionUri, url, webview);
	}

	public static restore(
		extensionUri: vscode.Uri,
		url: string,
		webviewPanel: vscode.WebviewPanel,
	): SimpleBrowserView {
		return new SimpleBrowserView(extensionUri, url, webviewPanel);
	}

	private constructor(
		private readonly extensionUri: vscode.Uri,
		url: string,
		webviewPanel: vscode.WebviewPanel,
	) {
		super();

		this._webviewPanel = this._register(webviewPanel);
		this._webviewPanel.webview.options = SimpleBrowserView.getWebviewOptions(extensionUri);

		this._register(this._webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'openExternal':
					try {
						const url = vscode.Uri.parse(e.url);
						vscode.env.openExternal(url);
					} catch {
						// Noop
					}
					break;
				case 'didNavigate':
					if (typeof e.url === 'string') {
						this.currentUrl = e.url;
						this.elementSelectionLastUrl = e.url;
					}
					break;
				case 'urlChanged':
					// Iframe navigation detected (user clicked link, submitted form, etc.)
					if (typeof e.url === 'string' && e.url !== this.currentUrl) {
						this.handleUINavigation(e.url, e.source || 'iframe').catch(err => {
							console.error('Failed to sync iframe navigation:', err);
						});
					}
					break;
				case 'navigate':
					// User typed URL or clicked home button
					if (typeof e.url === 'string') {
						this.handleUINavigation(e.url, e.source || 'user').catch(err => {
							console.error('Failed to sync user navigation:', err);
						});
					}
					break;
				case 'goBack':
					this.handleBackNavigation().catch(err => {
						console.error('Failed to navigate back:', err);
					});
					break;
				case 'goForward':
					this.handleForwardNavigation().catch(err => {
						console.error('Failed to navigate forward:', err);
					});
					break;
				case 'reload':
					this.handleReload().catch(err => {
						console.error('Failed to reload:', err);
					});
					break;
				case 'elementSelection.start':
					this.handleStartElementSelection(e).catch(err => {
						this._webviewPanel.webview.postMessage({ type: 'elementSelection.error', message: err instanceof Error ? err.message : String(err) });
					});
					break;
				case 'elementSelection.stop':
					this.closeElementSelectionSession().then(() => {
						this._webviewPanel.webview.postMessage({ type: 'elementSelection.stopped' });
					}, () => {
						this._webviewPanel.webview.postMessage({ type: 'elementSelection.stopped' });
					});
					break;
				case 'elementSelection.hover':
					this.handleElementSelectionHover(e).catch(() => {
						// Ignore hover errors to keep UI responsive
					});
					break;
				case 'elementSelection.pick':
					this.handleElementSelectionPick(e).catch(err => {
						this._webviewPanel.webview.postMessage({ type: 'elementSelection.error', message: err instanceof Error ? err.message : String(err) });
					});
					break;
				case 'elementSelection.scroll':
					this.handleElementSelectionScroll(e).catch(() => {
						// Ignore scroll errors; selection UI can retry
					});
					break;
			}
		}));

		this._register(this._webviewPanel.onDidDispose(() => {
			this.dispose();
		}));

		this._register(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('simpleBrowser.focusLockIndicator.enabled')) {
				const configuration = vscode.workspace.getConfiguration('simpleBrowser');
				this._webviewPanel.webview.postMessage({
					type: 'didChangeFocusLockIndicatorEnabled',
					focusLockEnabled: configuration.get<boolean>('focusLockIndicator.enabled', true)
				});
			}
		}));

		this.show(url);
	}

	public override dispose() {
		// Clean up element selection session
		this.closeElementSelectionSession().then(() => { }, () => { });

		// Clean up main automation session
		if (this.mainAutomationSessionId) {
			const automationService = this.getAutomationService();
			if (automationService) {
				automationService.closeSession(this.mainAutomationSessionId).catch(() => {
					// Ignore errors on cleanup
				});
			}
			this.mainAutomationSessionId = undefined;
		}

		this._onDidDispose.fire();
		super.dispose();
	}

	public show(url: string, options?: ShowOptions) {
		this.currentUrl = url;
		// Only regenerate HTML on first call
		if (!this._isInitialized) {
			this._webviewPanel.webview.html = this.getHtml(url);
			this._isInitialized = true;
		} else {
			// Navigate the iframe to new URL
			this._webviewPanel.webview.postMessage({
				type: 'navigate',
				url
			});
		}
		this._webviewPanel.reveal(options?.viewColumn, options?.preserveFocus);
	}

	/**
	 * Show automation activity overlay
	 * Disabled for production - no popups
	 */
	public showAutomationActivity(_action: string, _details?: string) {
		// Disabled to prevent distracting UI popups during automation
		// this._webviewPanel.webview.postMessage({
		// 	type: 'automation-activity',
		// 	action,
		// 	details
		// });
	}

	/**
	 * Sync with automation navigation
	 */
	public syncAutomationNavigation(url: string) {
		if (url && url !== this.currentUrl) {
			this.show(url);
		}
	}

	/**
	 * Get current URL
	 */
	public getCurrentUrl(): string {
		return this.currentUrl;
	}

	// --- Element selection helpers ---

	private async ensureElementSelectionSession(url: string, viewport?: { width: number; height: number }): Promise<string> {
		const shouldRecreateSession = !!(this.elementSelectionSessionId && viewport && this.elementSelectionViewport &&
			(viewport.width !== this.elementSelectionViewport.width || viewport.height !== this.elementSelectionViewport.height));

		if (shouldRecreateSession && this.elementSelectionSessionId) {
			await vscode.commands.executeCommand<AutomationResult<void>>('_browserAutomation.closeSession', { sessionId: this.elementSelectionSessionId });
			this.elementSelectionSessionId = undefined;
		}

		if (!this.elementSelectionSessionId) {
			const sessionId = generateSessionId();
			const result = await vscode.commands.executeCommand<AutomationResult<string>>('_browserAutomation.createSession', { sessionId, url, options: viewport ? { viewport } : undefined });
			if (!result?.success) {
				throw new Error(result?.error || 'Failed to create browser automation session');
			}
			this.elementSelectionSessionId = sessionId;
			this.elementSelectionViewport = viewport;
			this.elementSelectionLastUrl = url;
			return sessionId;
		}

		// Navigate the session if needed
		if (this.elementSelectionLastUrl !== url) {
			const navRes = await vscode.commands.executeCommand<AutomationResult<string>>('_browserAutomation.navigate', { sessionId: this.elementSelectionSessionId, url, options: { waitUntil: 'load', timeout: 10000 } });
			if (!navRes?.success) {
				throw new Error(navRes?.error || 'Failed to navigate automation session');
			}
			this.elementSelectionLastUrl = url;
		}

		return this.elementSelectionSessionId;
	}

	private async closeElementSelectionSession(): Promise<void> {
		if (!this.elementSelectionSessionId) return;
		try {
			await vscode.commands.executeCommand<AutomationResult<void>>('_browserAutomation.closeSession', { sessionId: this.elementSelectionSessionId });
		} finally {
			this.elementSelectionSessionId = undefined;
			this.elementSelectionViewport = undefined;
			this.elementSelectionLastUrl = undefined;
		}
	}

	private async screenshotSession(sessionId: string, options?: any): Promise<string> {
		const res = await vscode.commands.executeCommand<AutomationResult<string>>('_browserAutomation.screenshot', { sessionId, options });
		if (!res?.success || !res.data) {
			throw new Error(res?.error || 'Failed to capture screenshot');
		}

		// Validate screenshot data
		const screenshot = res.data;
		if (typeof screenshot !== 'string' || screenshot.length === 0) {
			throw new Error('Invalid screenshot data: empty or invalid format');
		}

		// Remove data URI prefix if present (we only want base64)
		if (screenshot.startsWith('data:')) {
			const match = screenshot.match(/^data:image\/[^;]+;base64,(.+)$/);
			if (match && match[1]) {
				return match[1];
			}
			throw new Error('Invalid screenshot data URI format');
		}

		return screenshot;
	}

	private async evaluateInSession<T>(sessionId: string, script: string): Promise<T> {
		const res = await vscode.commands.executeCommand<AutomationResult<T>>('_browserAutomation.evaluate', { sessionId, script });
		if (!res?.success) {
			throw new Error(res?.error || 'Failed to evaluate script');
		}
		return res.data as T;
	}

	private clampClip(boundingBox: ElementBoundingBox, viewport: { width: number; height: number }, padding: number): { x: number; y: number; width: number; height: number } | null {
		const pad = Math.max(0, Math.round(padding));
		const vpW = Math.max(0, Math.round(viewport.width));
		const vpH = Math.max(0, Math.round(viewport.height));
		if (!vpW || !vpH) return null;

		// Ensure element has valid dimensions
		if (boundingBox.width <= 0 || boundingBox.height <= 0) {
			return null;
		}

		// Calculate clip region with padding
		const rawX = Math.floor(boundingBox.x) - pad;
		const rawY = Math.floor(boundingBox.y) - pad;
		const rawW = Math.ceil(boundingBox.width) + pad * 2;
		const rawH = Math.ceil(boundingBox.height) + pad * 2;

		// Clamp to viewport bounds
		const x = Math.max(0, Math.min(rawX, vpW - 1));
		const y = Math.max(0, Math.min(rawY, vpH - 1));

		// Adjust width/height if element starts before viewport
		const adjustedW = rawX < 0 ? rawW + rawX : rawW;
		const adjustedH = rawY < 0 ? rawH + rawY : rawH;

		const width = Math.max(1, Math.min(vpW - x, adjustedW));
		const height = Math.max(1, Math.min(vpH - y, adjustedH));

		// Ensure minimum viable screenshot size (at least 10x10)
		if (width < 10 || height < 10) {
			return null;
		}

		return { x, y, width, height };
	}

	private async handleStartElementSelection(e: any): Promise<void> {
		const url = typeof e.url === 'string' ? e.url : this.currentUrl;
		const viewport = e.viewport && typeof e.viewport.width === 'number' && typeof e.viewport.height === 'number'
			? { width: e.viewport.width, height: e.viewport.height }
			: undefined;

		const sessionId = await this.ensureElementSelectionSession(url, viewport);
		const screenshot = await this.screenshotSession(sessionId, { type: 'png' });
		await this._webviewPanel.webview.postMessage({ type: 'elementSelection.screenshot', data: screenshot });
	}

	private async handleElementSelectionHover(e: any): Promise<void> {
		if (!this.elementSelectionSessionId) return;
		if (typeof e.x !== 'number' || typeof e.y !== 'number') return;

		const requestId = ++this.elementSelectionHoverRequestId;
		const hoverData = await this.evaluateInSession<ElementSelectionHoverData>(this.elementSelectionSessionId, buildHoverScript(e.x, e.y));
		if (requestId !== this.elementSelectionHoverRequestId) return;

		await this._webviewPanel.webview.postMessage({ type: 'elementSelection.hoverResult', data: hoverData });
	}

	private async handleElementSelectionPick(e: any): Promise<void> {
		if (!this.elementSelectionSessionId) return;
		if (typeof e.x !== 'number' || typeof e.y !== 'number') return;

		const pickData = await this.evaluateInSession<ElementSelectionPickData>(this.elementSelectionSessionId, buildPickScript(e.x, e.y));
		if (!pickData || !pickData.selector || !pickData.elementData?.tagName) {
			return;
		}

		if (pickData.isSensitive) {
			vscode.window.showWarningMessage('Refusing to capture sensitive fields (e.g. password inputs).');
			return;
		}

		let elementScreenshot: string | null = null;
		if (pickData.boundingBox) {
			// Use larger padding for better element visibility (12px instead of 4px)
			const clip = this.clampClip(pickData.boundingBox, pickData.viewport, 12);
			if (clip) {
				try {
					// Capture screenshot with quality settings
					elementScreenshot = await this.screenshotSession(this.elementSelectionSessionId, {
						type: 'png',
						clip,
						omitBackground: false,
						encoding: 'base64'
					});
				} catch (error) {
					console.error('Failed to capture element screenshot:', error);
					elementScreenshot = null;
				}
			} else {
				console.warn('Element bounding box is too small or invalid for screenshot');
			}
		}

		// Validate screenshot before sending
		if (elementScreenshot) {
			// Log screenshot info for debugging
			console.log(`Element screenshot captured: ${elementScreenshot.length} characters`);

			// Ensure it's valid base64 (basic check)
			if (!/^[A-Za-z0-9+/=]+$/.test(elementScreenshot)) {
				console.warn('Screenshot contains invalid base64 characters');
				elementScreenshot = null;
			}
		}

		const payload = {
			type: 'BrowserElement' as const,
			selector: pickData.selector,
			selectorChain: pickData.selectorChain,
			pageUrl: pickData.pageUrl,
			elementData: pickData.elementData,
			screenshot: elementScreenshot,
			timestamp: Date.now(),
		};

		try {
			await vscode.commands.executeCommand('void.addBrowserElementSelection', payload);

			// Show success feedback
			const elementLabel = pickData.elementData.tagName +
				(pickData.elementData.id ? `#${pickData.elementData.id}` : '') +
				(pickData.elementData.classes[0] ? `.${pickData.elementData.classes[0]}` : '');
			console.log(`Added browser element to selections: ${elementLabel}`);

		} catch (err) {
			vscode.window.showErrorMessage(`Failed to add element to chat selections: ${err instanceof Error ? err.message : String(err)}`);
		}

		await this._webviewPanel.webview.postMessage({ type: 'elementSelection.picked', data: { label: pickData.elementData.tagName, selector: pickData.selector } });
	}

	private async handleElementSelectionScroll(e: any): Promise<void> {
		if (!this.elementSelectionSessionId) return;
		if (typeof e.deltaY !== 'number') return;

		// Scroll and then refresh screenshot (debounced on the webview side)
		const deltaY = Math.max(-2000, Math.min(2000, Math.round(e.deltaY)));
		await this.evaluateInSession(this.elementSelectionSessionId, `(() => { window.scrollBy(0, ${deltaY}); return { y: window.scrollY }; })()`);
		await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
		const screenshot = await this.screenshotSession(this.elementSelectionSessionId, { type: 'png' });
		await this._webviewPanel.webview.postMessage({ type: 'elementSelection.screenshot', data: screenshot });
	}

	// --- Bidirectional Navigation Sync Methods ---

	/**
	 * Get automation service from global registry
	 */
	private getAutomationService(): BrowserAutomationService | undefined {
		return (global as any).browserAutomationService;
	}

	/**
	 * Handle UI navigation and sync to Puppeteer
	 * Called when user navigates in the UI (types URL, clicks links, etc.)
	 */
	private async handleUINavigation(url: string, _source: string): Promise<void> {
		if (!this.navigationSyncEnabled) {
			return;
		}

		// Prevent concurrent navigations - queue if one is in progress
		if (this.navigationInProgress) {
			this.pendingNavigation = url;
			return;
		}

		this.navigationInProgress = true;
		const previousUrl = this.currentUrl;
		this.currentUrl = url;

		try {
			const automationService = this.getAutomationService();
			if (!automationService) {
				// No automation service available - UI-only mode
				this.navigationInProgress = false;
				this.processPendingNavigation();
				return;
			}

			// Verify session is alive before using it
			let sessionId = this.mainAutomationSessionId;
			if (sessionId) {
				const isAlive = await this.verifySession(sessionId, automationService);
				if (!isAlive) {
					sessionId = undefined;
					this.mainAutomationSessionId = undefined;
				}
			}

			if (!sessionId) {
				// Create new session
				const result = await automationService.createSession(url, {
					viewport: { width: 1280, height: 720 }
				});
				if (result.success && result.data) {
					sessionId = result.data;
					this.mainAutomationSessionId = sessionId;
				} else {
					throw new Error(result.error || 'Failed to create automation session');
				}
			} else {
				// Navigate existing session to new URL
				const result = await automationService.navigate(sessionId, url, {
					waitUntil: 'domcontentloaded',
					timeout: 30000
				});

				if (!result.success) {
					// Session might be dead - try recreating
					if (result.error?.includes('Session') || result.error?.includes('closed')) {
						this.mainAutomationSessionId = undefined;
						const createResult = await automationService.createSession(url);
						if (createResult.success && createResult.data) {
							this.mainAutomationSessionId = createResult.data;
						} else {
							throw new Error(createResult.error || 'Failed to recreate session');
						}
					} else {
						throw new Error(result.error || 'Navigation failed');
					}
				}
			}

		} catch (error) {
			console.error('Navigation sync failed:', error);
			// Revert UI to previous URL
			await this.revertNavigation(previousUrl, error instanceof Error ? error.message : String(error));
		} finally {
			this.navigationInProgress = false;
			this.processPendingNavigation();
		}
	}

	/**
	 * Process any pending navigation that was queued
	 */
	private processPendingNavigation(): void {
		if (this.pendingNavigation) {
			const url = this.pendingNavigation;
			this.pendingNavigation = undefined;
			// Process pending navigation asynchronously
			this.handleUINavigation(url, 'queued').catch(err => {
				console.error('Pending navigation failed:', err);
			});
		}
	}

	/**
	 * Verify if a session is still alive
	 */
	private async verifySession(sessionId: string, automationService: BrowserAutomationService): Promise<boolean> {
		try {
			const result = await automationService.getUrl(sessionId);
			return result.success;
		} catch {
			return false;
		}
	}

	/**
	 * Handle back navigation
	 */
	private async handleBackNavigation(): Promise<void> {
		if (!this.navigationSyncEnabled || this.navigationInProgress) {
			return;
		}

		this.navigationInProgress = true;

		try {
			const automationService = this.getAutomationService();
			if (!automationService) {
				return;
			}

			let sessionId = this.mainAutomationSessionId;
			if (!sessionId) {
				sessionId = await automationService.ensureActiveSession();
			}

			if (!sessionId) {
				throw new Error('No active session for navigation. Please open a page first.');
			}

			// Verify session is alive
			const isAlive = await this.verifySession(sessionId, automationService);
			if (!isAlive) {
				throw new Error('Session is no longer active. Please refresh the page.');
			}

			// Go back in Puppeteer
			const result = await automationService.goBack(sessionId);
			if (!result.success) {
				throw new Error(result.error || 'Failed to go back');
			}

			// Get new URL after navigation
			const urlResult = await automationService.getUrl(sessionId);
			if (urlResult.success && urlResult.data) {
				this.currentUrl = urlResult.data;
				// Sync UI to new URL
				await this._webviewPanel.webview.postMessage({
					type: 'navigate',
					url: urlResult.data
				});
			}

		} catch (error) {
			console.error('Back navigation failed:', error);
			const message = error instanceof Error ? error.message : String(error);
			// Don't show error for common cases like "no history"
			if (!message.includes('history') && !message.includes('cannot go back')) {
				vscode.window.showErrorMessage(`Failed to go back: ${message}`);
			}
		} finally {
			this.navigationInProgress = false;
		}
	}

	/**
	 * Handle forward navigation
	 */
	private async handleForwardNavigation(): Promise<void> {
		if (!this.navigationSyncEnabled || this.navigationInProgress) {
			return;
		}

		this.navigationInProgress = true;

		try {
			const automationService = this.getAutomationService();
			if (!automationService) {
				return;
			}

			let sessionId = this.mainAutomationSessionId;
			if (!sessionId) {
				sessionId = await automationService.ensureActiveSession();
			}

			if (!sessionId) {
				throw new Error('No active session for navigation. Please open a page first.');
			}

			// Verify session is alive
			const isAlive = await this.verifySession(sessionId, automationService);
			if (!isAlive) {
				throw new Error('Session is no longer active. Please refresh the page.');
			}

			// Go forward in Puppeteer
			const result = await automationService.goForward(sessionId);
			if (!result.success) {
				throw new Error(result.error || 'Failed to go forward');
			}

			// Get new URL after navigation
			const urlResult = await automationService.getUrl(sessionId);
			if (urlResult.success && urlResult.data) {
				this.currentUrl = urlResult.data;
				// Sync UI to new URL
				await this._webviewPanel.webview.postMessage({
					type: 'navigate',
					url: urlResult.data
				});
			}

		} catch (error) {
			console.error('Forward navigation failed:', error);
			const message = error instanceof Error ? error.message : String(error);
			// Don't show error for common cases like "no forward history"
			if (!message.includes('history') && !message.includes('cannot go forward')) {
				vscode.window.showErrorMessage(`Failed to go forward: ${message}`);
			}
		} finally {
			this.navigationInProgress = false;
		}
	}

	/**
	 * Handle reload
	 */
	private async handleReload(): Promise<void> {
		if (!this.navigationSyncEnabled || this.navigationInProgress) {
			return;
		}

		this.navigationInProgress = true;

		try {
			const automationService = this.getAutomationService();
			if (!automationService) {
				return;
			}

			let sessionId = this.mainAutomationSessionId;
			if (!sessionId) {
				sessionId = await automationService.ensureActiveSession();
			}

			if (!sessionId) {
				throw new Error('No active session for reload. Please open a page first.');
			}

			// Verify session is alive
			const isAlive = await this.verifySession(sessionId, automationService);
			if (!isAlive) {
				// Session dead - recreate with current URL
				if (this.currentUrl) {
					const result = await automationService.createSession(this.currentUrl);
					if (result.success && result.data) {
						this.mainAutomationSessionId = result.data;
						return;
					}
				}
				throw new Error('Session is no longer active. Please navigate to a page.');
			}

			// Reload in Puppeteer
			const result = await automationService.reload(sessionId);
			if (!result.success) {
				throw new Error(result.error || 'Failed to reload');
			}

		} catch (error) {
			console.error('Reload failed:', error);
			vscode.window.showErrorMessage(`Failed to reload: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.navigationInProgress = false;
		}
	}

	/**
	 * Revert navigation to previous URL on error
	 */
	private async revertNavigation(previousUrl: string, errorMessage: string): Promise<void> {
		this.currentUrl = previousUrl;
		await this._webviewPanel.webview.postMessage({
			type: 'navigationError',
			previousUrl,
			error: errorMessage
		});
		vscode.window.showErrorMessage(`Navigation failed: ${errorMessage}`);
	}

	/**
	 * Update navigation button states from Puppeteer
	 * (Future enhancement - requires Puppeteer history state query)
	 */
	// private async updateNavigationState(sessionId: string): Promise<void> {
	// 	// TODO: Query Puppeteer for canGoBack/canGoForward
	// 	// For now, rely on UI fallback history
	// 	/*
	// 	const canGoBack = await queryPuppeteerCanGoBack(sessionId);
	// 	const canGoForward = await queryPuppeteerCanGoForward(sessionId);
	//
	// 	await this._webviewPanel.webview.postMessage({
	// 		type: 'updateNavigationState',
	// 		canGoBack,
	// 		canGoForward
	// 	});
	// 	*/
	// }

	/**
	 * Enable or disable navigation synchronization
	 */
	public setNavigationSyncEnabled(enabled: boolean): void {
		this.navigationSyncEnabled = enabled;
	}

	private getHtml(url: string) {
		const configuration = vscode.workspace.getConfiguration('simpleBrowser');

		const nonce = getNonce();

		const mainJs = this.extensionResourceUrl('media', 'index.js');
		const mainCss = this.extensionResourceUrl('media', 'main.css');
		const codiconsUri = this.extensionResourceUrl('media', 'codicon.css');

		return /* html */ `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">

				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					font-src data: ${this._webviewPanel.webview.cspSource};
					style-src ${this._webviewPanel.webview.cspSource} 'unsafe-inline';
					script-src 'nonce-${nonce}';
					frame-src *;
					img-src ${this._webviewPanel.webview.cspSource} data:;
					">

				<meta id="simple-browser-settings" data-settings="${escapeAttribute(JSON.stringify({
			url: url,
			focusLockEnabled: configuration.get<boolean>('focusLockIndicator.enabled', true)
		}))}">

				<link rel="stylesheet" type="text/css" href="${mainCss}">
				<link rel="stylesheet" type="text/css" href="${codiconsUri}">
			</head>
			<body>
				<header class="header">
					<nav class="controls">
						<button
							title="${vscode.l10n.t("Back")}"
							class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

						<button
							title="${vscode.l10n.t("Forward")}"
							class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

						<button
							title="${vscode.l10n.t("Reload")}"
							class="reload-button icon"><i class="codicon codicon-refresh"></i></button>

						<button
							title="${vscode.l10n.t("Home")}"
							class="home-button icon"><i class="codicon codicon-home"></i></button>

						<button
							title="${vscode.l10n.t("Select Element")}"
							class="select-element-button icon"><i class="codicon codicon-target"></i></button>
					</nav>

					<div class="url-bar">
						<span class="url-bar-icon security-icon" title="${vscode.l10n.t("Connection is secure")}">
							<i class="codicon codicon-lock"></i>
						</span>
						<input class="url-input" type="text" placeholder="${vscode.l10n.t("Search or enter URL")}">
						<button class="url-bar-icon clear-button" title="${vscode.l10n.t("Clear")}">
							<i class="codicon codicon-close"></i>
						</button>
					</div>

					<nav class="controls">
						<button
							title="${vscode.l10n.t("Open in browser")}"
							class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
					</nav>
				</header>
				<div class="content">
					<div class="iframe-focused-alert">${vscode.l10n.t("Focus Lock")}</div>
					<div class="automation-overlay" id="automation-overlay">
						<div class="automation-indicator">
							<i class="codicon codicon-zap"></i>
							<span class="automation-action"></span>
							<span class="automation-details"></span>
						</div>
					</div>
					<div class="element-selection-overlay" id="element-selection-overlay" aria-hidden="true">
						<div class="element-selection-banner">
							<span class="element-selection-title">${vscode.l10n.t("Element Selection")}</span>
							<span class="element-selection-hint">${vscode.l10n.t("Move to highlight, click to add to chat. Press Esc to exit.")}</span>
						</div>
						<div class="element-selection-stage">
							<div class="element-selection-image-wrapper" id="element-selection-image-wrapper">
								<img class="element-selection-image" id="element-selection-image" alt="Element selection preview">
								<div class="element-selection-highlight" id="element-selection-highlight"></div>
							</div>
						</div>
						<div class="element-selection-status" id="element-selection-status"></div>
					</div>
					<iframe sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"></iframe>
				</div>

				<script src="${mainJs}" nonce="${nonce}"></script>
			</body>
			</html>`;
	}

	private extensionResourceUrl(...parts: string[]): vscode.Uri {
		return this._webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts));
	}
}

function escapeAttribute(value: string | vscode.Uri): string {
	return value.toString().replace(/"/g, '&quot;');
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 64; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
