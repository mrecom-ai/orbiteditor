/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	AutomationResult,
	BrowserSession,
	ScreenshotOptions,
	PDFOptions,
	Cookie,
	NavigationOptions,
	WaitForSelectorOptions,
	ClickOptions,
	TypeOptions,
	SessionOptions
} from './automationTypes';
import { generateSessionId } from './utils';
import { SimpleBrowserManager } from '../simpleBrowserManager';

/**
 * Automation statistics
 */
interface AutomationStats {
	totalCommands: number;
	successfulCommands: number;
	failedCommands: number;
	sessions: {
		created: number;
		closed: number;
		active: number;
	};
	lastCommandTime?: number;
}

/**
 * Browser Automation Service
 * Manages browser automation sessions and communicates with the main process via commands
 */
export class BrowserAutomationService {
	private sessions: Map<string, BrowserSession> = new Map();
	private activeSessionId?: string;
	private sessionUrls: Map<string, string> = new Map(); // Track current URL for each session
	private stats: AutomationStats = {
		totalCommands: 0,
		successfulCommands: 0,
		failedCommands: 0,
		sessions: {
			created: 0,
			closed: 0,
			active: 0
		}
	};
	private defaultSessionUrl = 'https://www.google.com';

	constructor(private context: vscode.ExtensionContext) {
		// Load stats from context if available
		const savedStats = context.globalState.get<AutomationStats>('automationStats');
		if (savedStats) {
			this.stats = { ...this.stats, ...savedStats };
		}
	}

	/**
	 * Get automation statistics
	 */
	getStats(): AutomationStats {
		return { ...this.stats, sessions: { ...this.stats.sessions } };
	}

	/**
	 * Save stats to persistent storage
	 */
	private saveStats() {
		this.context.globalState.update('automationStats', this.stats);
	}

	/**
	 * Update stats after command execution
	 */
	private updateStats(success: boolean) {
		this.stats.totalCommands++;
		this.stats.lastCommandTime = Date.now();
		if (success) {
			this.stats.successfulCommands++;
		} else {
			this.stats.failedCommands++;
		}
		this.saveStats();
	}

	/**
	 * Get browser manager for UI sync
	 */
	private getBrowserManager(): SimpleBrowserManager | undefined {
		return (global as any).simpleBrowserManager;
	}

	/**
	 * Sync browser UI with automation action
	 */
	private syncBrowserUI(action: string, details?: string, url?: string) {
		const manager = this.getBrowserManager();
		if (manager) {
			const view = manager.getActiveView();
			if (view) {
				// Show automation activity overlay
				view.showAutomationActivity(action, details);

				// Sync navigation if URL provided
				if (url) {
					view.syncAutomationNavigation(url);
				}
			} else {
				// No active browser view, open one
				if (url) {
					manager.show(url);
				}
			}
		}
	}

	/**
	 * Ensure an active session exists, creating one if necessary
	 */
	async ensureActiveSession(): Promise<string | undefined> {
		if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
			return this.activeSessionId;
		}

		// Try to create a default session
		const result = await this.createSession(this.defaultSessionUrl);
		if (result.success && result.data) {
			return result.data;
		}

		return undefined;
	}

	/**
	 * Create a new browser automation session
	 */
	async createSession(url: string, options?: SessionOptions): Promise<AutomationResult<string>> {
		try {
			const sessionId = generateSessionId();
			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.createSession',
				{ sessionId, url, options }
			);

			if (result?.success && result.data) {
				this.sessions.set(sessionId, {
					id: sessionId,
					url,
					createdAt: Date.now()
				});
				this.sessionUrls.set(sessionId, url); // Track session URL
				this.activeSessionId = sessionId;
				this.stats.sessions.created++;
				this.stats.sessions.active = this.sessions.size;
				this.updateStats(true);
				return { success: true, data: sessionId };
			}

			this.updateStats(false);

			const errorMsg = result?.error || 'Failed to create session';
			return result || { success: false, error: errorMsg };
		} catch (error) {
			this.updateStats(false);
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';

			return {
				success: false,
				error: errorMsg
			};
		}
	}

	/**
	 * Close a browser automation session
	 */
	async closeSession(sessionId: string): Promise<AutomationResult<void>> {
		try {
			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.closeSession',
				{ sessionId }
			);

			if (result?.success) {
				this.sessions.delete(sessionId);
				this.sessionUrls.delete(sessionId); // Remove URL tracking
				if (this.activeSessionId === sessionId) {
					this.activeSessionId = undefined;
				}
				this.stats.sessions.closed++;
				this.stats.sessions.active = this.sessions.size;
				this.updateStats(true);
			} else {
				this.updateStats(false);
			}

			return result || { success: false, error: 'Failed to close session' };
		} catch (error) {
			this.updateStats(false);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * List all active sessions
	 */
	listSessions(): BrowserSession[] {
		return Array.from(this.sessions.values());
	}

	/**
	 * Get active session ID
	 */
	getActiveSessionId(): string | undefined {
		return this.activeSessionId;
	}

	/**
	 * Set active session
	 */
	setActiveSession(sessionId: string): boolean {
		if (this.sessions.has(sessionId)) {
			this.activeSessionId = sessionId;
			return true;
		}
		return false;
	}

	/**
	 * Ensure a session exists for the given URL
	 * Returns existing session if already on that URL, or creates new one
	 */
	async ensureSessionForUrl(url: string): Promise<string | undefined> {
		// Check if active session is already on this URL
		if (this.activeSessionId) {
			const currentUrl = this.sessionUrls.get(this.activeSessionId);
			if (currentUrl === url) {
				return this.activeSessionId;
			}
		}

		// Search all sessions for matching URL
		for (const [sessionId, sessionUrl] of this.sessionUrls.entries()) {
			if (sessionUrl === url && this.sessions.has(sessionId)) {
				this.activeSessionId = sessionId;
				return sessionId;
			}
		}

		// No matching session found - create new one
		const result = await this.createSession(url);
		if (result.success && result.data) {
			return result.data;
		}

		return undefined;
	}

	/**
	 * Update the tracked URL for a session
	 */
	updateSessionUrl(sessionId: string, url: string): void {
		this.sessionUrls.set(sessionId, url);

		// Also update the session object if it exists
		const session = this.sessions.get(sessionId);
		if (session) {
			session.url = url;
			this.sessions.set(sessionId, session);
		}
	}

	/**
	 * Get the current URL for a session
	 */
	getSessionUrl(sessionId: string): string | undefined {
		return this.sessionUrls.get(sessionId);
	}

	/**
	 * Navigate to URL
	 */
	async navigate(sessionId: string, url: string, options?: NavigationOptions): Promise<AutomationResult<string>> {
		try {
			// Sync browser UI immediately
			this.syncBrowserUI('Navigating...', url, url);

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.navigate',
				{ sessionId, url, options }
			);

			if (result?.success) {
				// Update tracked URL after successful navigation
				this.updateSessionUrl(sessionId, url);
				this.syncBrowserUI('Navigation Complete', url, url);
			}

			return result || { success: false, error: 'Failed to navigate' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Go back in history
	 */
	async goBack(sessionId: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Going Back', 'Navigating to previous page');

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.goBack',
				{ sessionId }
			);

			if (result?.success) {
				// Get the current URL after going back and sync the browser
				const urlResult = await vscode.commands.executeCommand<AutomationResult<string>>(
					'_browserAutomation.getUrl',
					{ sessionId }
				);

				if (urlResult?.success && urlResult.data) {
					// Update tracked URL after going back
					this.updateSessionUrl(sessionId, urlResult.data);
					this.syncBrowserUI('Back Navigation Complete', `Now at: ${urlResult.data}`, urlResult.data);
				} else {
					this.syncBrowserUI('Back Navigation Complete', 'Returned to previous page');
				}
			}

			return result || { success: false, error: 'Failed to go back' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Go forward in history
	 */
	async goForward(sessionId: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Going Forward', 'Navigating to next page');

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.goForward',
				{ sessionId }
			);

			if (result?.success) {
				// Get the current URL after going forward and sync the browser
				const urlResult = await vscode.commands.executeCommand<AutomationResult<string>>(
					'_browserAutomation.getUrl',
					{ sessionId }
				);

				if (urlResult?.success && urlResult.data) {
					// Update tracked URL after going forward
					this.updateSessionUrl(sessionId, urlResult.data);
					this.syncBrowserUI('Forward Navigation Complete', `Now at: ${urlResult.data}`, urlResult.data);
				} else {
					this.syncBrowserUI('Forward Navigation Complete', 'Moved to next page');
				}
			}

			return result || { success: false, error: 'Failed to go forward' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Reload current page
	 */
	async reload(sessionId: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Reloading Page', 'Refreshing current page');

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.reload',
				{ sessionId }
			);

			if (result?.success) {
				// Get the current URL and sync the browser to reload the same page
				const urlResult = await vscode.commands.executeCommand<AutomationResult<string>>(
					'_browserAutomation.getUrl',
					{ sessionId }
				);

				if (urlResult?.success && urlResult.data) {
					this.syncBrowserUI('Reload Complete', `Page refreshed: ${urlResult.data}`, urlResult.data);
				} else {
					this.syncBrowserUI('Reload Complete', 'Page refreshed');
				}
			}

			return result || { success: false, error: 'Failed to reload' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get current URL
	 */
	async getUrl(sessionId: string): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Getting URL', 'Retrieving current page URL');

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.getUrl',
				{ sessionId }
			);

			if (result?.success && result.data) {
				this.syncBrowserUI('URL Retrieved', result.data);
			}

			return result || { success: false, error: 'Failed to get URL' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Click an element
	 */
	async click(sessionId: string, selector: string, options?: ClickOptions): Promise<AutomationResult<void>> {
		try {
			// Get URL before click to detect navigation
			const urlBefore = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.getUrl',
				{ sessionId }
			);

			this.syncBrowserUI('Clicking Element', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.click',
				{ sessionId, selector, options }
			);

			if (result?.success) {
				// Check if URL changed after click (e.g., clicked a link)
				const urlAfter = await vscode.commands.executeCommand<AutomationResult<string>>(
					'_browserAutomation.getUrl',
					{ sessionId }
				);

				if (urlAfter?.success && urlAfter.data && urlBefore?.data && urlAfter.data !== urlBefore.data) {
					// Navigation occurred - update tracked URL and sync browser
					this.updateSessionUrl(sessionId, urlAfter.data);
					this.syncBrowserUI('Click Complete - Navigated', `Now at: ${urlAfter.data}`, urlAfter.data);
				} else {
					this.syncBrowserUI('Click Complete', selector);
				}
			}

			return result || { success: false, error: 'Failed to click' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Type text into an element
	 */
	async type(sessionId: string, selector: string, text: string, options?: TypeOptions): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Typing Text', `Into: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.type',
				{ sessionId, selector, text, options }
			);

			if (result?.success) {
				this.syncBrowserUI('Typing Complete', `Entered: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
			}

			return result || { success: false, error: 'Failed to type' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Fill a form field
	 */
	async fill(sessionId: string, selector: string, value: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Filling Field', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.fill',
				{ sessionId, selector, value }
			);

			if (result?.success) {
				this.syncBrowserUI('Field Filled', `Value: "${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`);
			}

			return result || { success: false, error: 'Failed to fill' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Press a keyboard key
	 */
	async press(sessionId: string, key: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Pressing Key', `Key: ${key}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.press',
				{ sessionId, key }
			);

			if (result?.success) {
				this.syncBrowserUI('Key Pressed', `Sent: ${key}`);
			}

			return result || { success: false, error: 'Failed to press key' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Hover over an element
	 */
	async hover(sessionId: string, selector: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Hovering Over Element', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.hover',
				{ sessionId, selector }
			);

			if (result?.success) {
				this.syncBrowserUI('Hover Complete', selector);
			}

			return result || { success: false, error: 'Failed to hover' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Select an option from a dropdown
	 */
	async select(sessionId: string, selector: string, value: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Selecting Option', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.select',
				{ sessionId, selector, value }
			);

			if (result?.success) {
				this.syncBrowserUI('Option Selected', `Value: ${value}`);
			}

			return result || { success: false, error: 'Failed to select' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Take a screenshot
	 */
	async screenshot(sessionId: string, options?: ScreenshotOptions): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Capturing Screenshot', 'Processing...');

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.screenshot',
				{ sessionId, options }
			);

			if (result?.success && result.data) {
				// Show screenshot size
				const sizeKB = (result.data.length / 1024).toFixed(2);
				this.syncBrowserUI('Screenshot Captured', `${sizeKB} KB (base64 PNG)`);
			} else if (result?.success) {
				this.syncBrowserUI('Screenshot Captured', 'Saved successfully');
			}

			return result || { success: false, error: 'Failed to take screenshot' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Generate PDF
	 */
	async pdf(sessionId: string, options?: PDFOptions): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Generating PDF', 'Processing...');

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.pdf',
				{ sessionId, options }
			);

			if (result?.success && result.data) {
				// Show PDF size
				const sizeKB = (result.data.length / 1024).toFixed(2);
				this.syncBrowserUI('PDF Generated', `${sizeKB} KB (base64)`);
			} else if (result?.success) {
				this.syncBrowserUI('PDF Generated', 'Saved successfully');
			}

			return result || { success: false, error: 'Failed to generate PDF' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get page HTML content
	 */
	async getContent(sessionId: string): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Getting Page Content', 'Retrieving HTML...');

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.getContent',
				{ sessionId }
			);

			if (result?.success && result.data) {
				// Show size of content
				const sizeKB = (result.data.length / 1024).toFixed(2);
				this.syncBrowserUI('Content Retrieved', `${sizeKB} KB HTML extracted`);
			} else if (result?.success) {
				this.syncBrowserUI('Content Retrieved', 'Empty content');
			}

			return result || { success: false, error: 'Failed to get content' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get page title
	 */
	async getTitle(sessionId: string): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Getting Page Title', 'Retrieving title...');

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.getTitle',
				{ sessionId }
			);

			if (result?.success && result.data) {
				this.syncBrowserUI('Title Retrieved', result.data);
			}

			return result || { success: false, error: 'Failed to get title' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Extract text from an element
	 */
	async extractText(sessionId: string, selector: string): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Extracting Text', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.extractText',
				{ sessionId, selector }
			);

			if (result?.success && result.data) {
				// Show preview of extracted text
				const preview = result.data.length > 50
					? result.data.substring(0, 50) + '...'
					: result.data;
				this.syncBrowserUI('Text Extracted', `"${preview}"`);
			} else if (result?.success) {
				this.syncBrowserUI('Text Extracted', 'Empty text retrieved');
			}

			return result || { success: false, error: 'Failed to extract text' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Extract HTML from an element
	 */
	async extractHTML(sessionId: string, selector: string): Promise<AutomationResult<string>> {
		try {
			this.syncBrowserUI('Extracting HTML', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<string>>(
				'_browserAutomation.extractHTML',
				{ sessionId, selector }
			);

			if (result?.success && result.data) {
				// Show size of extracted HTML
				const sizeKB = (result.data.length / 1024).toFixed(2);
				this.syncBrowserUI('HTML Extracted', `${sizeKB} KB retrieved`);
			} else if (result?.success) {
				this.syncBrowserUI('HTML Extracted', 'Empty HTML retrieved');
			}

			return result || { success: false, error: 'Failed to extract HTML' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Evaluate JavaScript in page context
	 */
	async evaluate(sessionId: string, script: string, options?: { timeout?: number }): Promise<AutomationResult<any>> {
		try {
			this.syncBrowserUI('Evaluating JavaScript', 'Running custom script...');

			const result = await vscode.commands.executeCommand<AutomationResult<any>>(
				'_browserAutomation.evaluate',
				{ sessionId, script, options }
			);

			if (result?.success) {
				// Show result preview
				let resultText = 'Execution complete';
				if (result.data !== undefined && result.data !== null) {
					const resultStr = typeof result.data === 'object'
						? JSON.stringify(result.data)
						: String(result.data);
					resultText = resultStr.length > 50
						? resultStr.substring(0, 50) + '...'
						: resultStr;
				}
				this.syncBrowserUI('Script Evaluated', `Result: ${resultText}`);
			}

			return result || { success: false, error: 'Failed to evaluate script' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Wait for an element to appear
	 */
	async waitForSelector(sessionId: string, selector: string, options?: WaitForSelectorOptions): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Waiting for Element', `Selector: ${selector}`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.waitForSelector',
				{ sessionId, selector, options }
			);

			if (result?.success) {
				this.syncBrowserUI('Element Found', selector);
			}

			return result || { success: false, error: 'Failed to wait for selector' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Wait for navigation to complete
	 */
	async waitForNavigation(sessionId: string, options?: NavigationOptions): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Waiting for Navigation', 'Monitoring page load...');

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.waitForNavigation',
				{ sessionId, options }
			);

			if (result?.success) {
				this.syncBrowserUI('Navigation Complete', 'Page loaded');
			}

			return result || { success: false, error: 'Failed to wait for navigation' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get cookies
	 */
	async getCookies(sessionId: string, urls?: string[]): Promise<AutomationResult<Cookie[]>> {
		try {
			this.syncBrowserUI('Getting Cookies', 'Retrieving cookies...');

			const result = await vscode.commands.executeCommand<AutomationResult<Cookie[]>>(
				'_browserAutomation.getCookies',
				{ sessionId, urls }
			);

			if (result?.success) {
				const count = result.data?.length || 0;
				this.syncBrowserUI('Cookies Retrieved', `Found ${count} cookie(s)`);
			}

			return result || { success: false, error: 'Failed to get cookies' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Set cookies
	 */
	async setCookies(sessionId: string, cookies: Cookie[]): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Setting Cookies', `Setting ${cookies.length} cookie(s)...`);

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.setCookies',
				{ sessionId, cookies }
			);

			if (result?.success) {
				this.syncBrowserUI('Cookies Set', `${cookies.length} cookie(s) updated`);
			}

			return result || { success: false, error: 'Failed to set cookies' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Clear cookies
	 */
	async clearCookies(sessionId: string): Promise<AutomationResult<void>> {
		try {
			this.syncBrowserUI('Clearing Cookies', 'Removing all cookies...');

			const result = await vscode.commands.executeCommand<AutomationResult<void>>(
				'_browserAutomation.clearCookies',
				{ sessionId }
			);

			if (result?.success) {
				this.syncBrowserUI('Cookies Cleared', 'All cookies removed');
			}

			return result || { success: false, error: 'Failed to clear cookies' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get accessibility snapshot
	 */
	async snapshot(sessionId: string, options?: { interestingOnly?: boolean }): Promise<AutomationResult<any>> {
		try {
			this.syncBrowserUI('Getting Accessibility Snapshot', 'Analyzing page structure...');

			const result = await vscode.commands.executeCommand<AutomationResult<any>>(
				'_browserAutomation.snapshot',
				{ sessionId, options }
			);

			if (result?.success && result.data) {
				const countNodes = (node: any): number => {
					if (!node) return 0;
					let count = 1;
					if (node.children) {
						count += node.children.reduce((sum: number, child: any) => sum + countNodes(child), 0);
					}
					return count;
				};

				const nodeCount = countNodes(result.data);
				this.syncBrowserUI('Snapshot Retrieved', `${nodeCount} accessible elements found`);
			} else if (result?.success) {
				this.syncBrowserUI('Snapshot Retrieved', 'Empty page structure');
			}

			return result || { success: false, error: 'Failed to get accessibility snapshot' };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Dispose and clean up
	 */
	dispose() {
		// Close all sessions
		for (const sessionId of this.sessions.keys()) {
			this.closeSession(sessionId).catch(() => { });
		}
		this.sessions.clear();
	}
}
