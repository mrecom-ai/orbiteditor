"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleBrowserView = void 0;
const vscode = __importStar(require("vscode"));
const dispose_1 = require("./dispose");
const elementSelection_1 = require("./automation/elementSelection");
class SimpleBrowserView extends dispose_1.Disposable {
    static getWebviewLocalResourceRoots(extensionUri) {
        return [
            vscode.Uri.joinPath(extensionUri, 'media')
        ];
    }
    static getWebviewOptions(extensionUri) {
        return {
            enableScripts: true,
            enableForms: true,
            localResourceRoots: SimpleBrowserView.getWebviewLocalResourceRoots(extensionUri),
        };
    }
    static create(extensionUri, url, showOptions, automationService) {
        const webview = vscode.window.createWebviewPanel(SimpleBrowserView.viewType, SimpleBrowserView.title, {
            viewColumn: showOptions?.viewColumn ?? vscode.ViewColumn.Active,
            preserveFocus: showOptions?.preserveFocus
        }, {
            retainContextWhenHidden: true,
            ...SimpleBrowserView.getWebviewOptions(extensionUri)
        });
        return new SimpleBrowserView(extensionUri, url, webview, automationService);
    }
    static restore(extensionUri, url, webviewPanel, automationService) {
        return new SimpleBrowserView(extensionUri, url, webviewPanel, automationService);
    }
    constructor(extensionUri, url, webviewPanel, automationService) {
        super();
        this.extensionUri = extensionUri;
        this.automationService = automationService;
        this._isInitialized = false;
        this._onDidDispose = this._register(new vscode.EventEmitter());
        this.onDispose = this._onDidDispose.event;
        this.currentUrl = '';
        // --- Element selection state ---
        this.elementSelection = {
            active: false,
            generation: 0,
            viewport: undefined,
            pickInProgress: false,
            hoverRequestId: 0,
        };
        // --- Navigation sync state ---
        this.navigationSyncEnabled = true;
        this.navigationQueue = [];
        this.isProcessingNavigation = false;
        this.isRecoveringSession = false;
        /** True when iframe navigated via in-page link (cross-origin); address bar may be stale. */
        this.iframeNavigatedSinceUrlBarSync = false;
        this._webviewPanel = this._register(webviewPanel);
        this._webviewPanel.webview.options = SimpleBrowserView.getWebviewOptions(extensionUri);
        this._register(this._webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'openExternal':
                    try {
                        const url = vscode.Uri.parse(e.url);
                        vscode.env.openExternal(url);
                    }
                    catch {
                        // Noop
                    }
                    break;
                case 'didNavigate':
                    if (typeof e.url === 'string') {
                        this.currentUrl = e.url;
                    }
                    break;
                case 'urlChanged':
                    // Legacy: iframe navigation with readable URL
                    if (typeof e.url === 'string' && e.url !== this.currentUrl) {
                        this.iframeNavigatedSinceUrlBarSync = false;
                        this.handleUINavigation(e.url, e.source || 'iframe').catch(err => {
                            console.error('Failed to sync iframe navigation:', err);
                        });
                    }
                    break;
                case 'iframeLoaded':
                    this.handleIframeLoaded(e);
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
                        this.postElementSelectionError(err instanceof Error ? err.message : String(err));
                    });
                    break;
                case 'elementSelection.stop':
                    this.stopElementSelection();
                    break;
                case 'elementSelection.hover':
                    this.handleElementSelectionHover(e).catch(() => {
                        // Ignore hover errors to keep UI responsive
                    });
                    break;
                case 'elementSelection.pick':
                    this.handleElementSelectionPick(e).catch(err => {
                        this.postElementSelectionError(err instanceof Error ? err.message : String(err));
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
                    focusLockEnabled: configuration.get('focusLockIndicator.enabled', true)
                });
            }
        }));
        this.show(url);
        this.startNavigationPolling();
        this.startSessionHealthMonitoring();
    }
    dispose() {
        this.stopNavigationPolling();
        this.stopSessionHealthMonitoring();
        // Clean up element selection state (keep main automation session)
        this.stopElementSelection();
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
    show(url, options) {
        this.currentUrl = url;
        // Only regenerate HTML on first call
        if (!this._isInitialized) {
            this._webviewPanel.webview.html = this.getHtml(url);
            this._isInitialized = true;
        }
        else {
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
    showAutomationActivity(_action, _details) {
        // Disabled to prevent distracting UI popups during automation
        // this._webviewPanel.webview.postMessage({
        // 	type: 'automation-activity',
        // 	action,
        // 	details
        // });
    }
    /**
     * Sync with automation navigation — never hijack the iframe while element picker is active.
     */
    syncAutomationNavigation(url) {
        if (!url) {
            return;
        }
        this.automationSessionUrl = url;
        // While element picker is active, only update internal URL tracking — do not navigate iframe.
        if (this.elementSelection.active) {
            return;
        }
        if (url !== this.currentUrl) {
            this.currentUrl = url;
            this.show(url);
        }
    }
    /**
     * Get current URL
     */
    getCurrentUrl() {
        return this.currentUrl;
    }
    // --- Element selection helpers ---
    bumpElementSelectionGeneration() {
        this.elementSelection.generation += 1;
        return this.elementSelection.generation;
    }
    postElementSelectionMessage(message) {
        void this._webviewPanel.webview.postMessage({
            ...message,
            generation: this.elementSelection.generation,
        });
    }
    postElementSelectionError(message) {
        this.postElementSelectionMessage({ type: 'elementSelection.error', message });
    }
    stopElementSelection() {
        this.elementSelection.active = false;
        this.elementSelection.pickInProgress = false;
        this.elementSelection.hoverRequestId = 0;
        this.postElementSelectionMessage({ type: 'elementSelection.stopped' });
        this.bumpElementSelectionGeneration();
    }
    async refreshElementSelectionScreenshot() {
        if (!this.elementSelection.active) {
            return;
        }
        const sessionId = this.mainAutomationSessionId;
        if (!sessionId) {
            this.postElementSelectionError('Browser automation session unavailable');
            return;
        }
        try {
            const screenshot = await this.screenshotSession(sessionId, { type: 'png' });
            this.postElementSelectionMessage({ type: 'elementSelection.screenshot', data: screenshot });
        }
        catch (err) {
            this.postElementSelectionError(err instanceof Error ? err.message : String(err));
        }
    }
    async onNavigationSyncedForSelection(url) {
        if (!this.elementSelection.active) {
            return;
        }
        this.bumpElementSelectionGeneration();
        const viewport = this.elementSelection.viewport;
        try {
            await this.ensureElementSelectionSession(url, viewport);
            await this.refreshElementSelectionScreenshot();
        }
        catch (err) {
            this.postElementSelectionError(err instanceof Error ? err.message : String(err));
        }
    }
    async ensureElementSelectionSession(url, viewport) {
        const automationService = this.getAutomationService();
        if (!automationService) {
            throw new Error('Browser automation service unavailable');
        }
        const shouldRecreateSession = !!(this.mainAutomationSessionId && viewport && this.elementSelection.viewport &&
            (Math.abs(viewport.width - this.elementSelection.viewport.width) > 50 ||
                Math.abs(viewport.height - this.elementSelection.viewport.height) > 50));
        if (shouldRecreateSession && this.mainAutomationSessionId) {
            await automationService.closeSession(this.mainAutomationSessionId).catch(() => { });
            this.mainAutomationSessionId = undefined;
            this.automationSessionUrl = undefined;
        }
        let sessionId = this.mainAutomationSessionId;
        if (sessionId) {
            const isAlive = await this.verifySession(sessionId, automationService);
            if (!isAlive) {
                await automationService.closeSession(sessionId).catch(() => { });
                this.mainAutomationSessionId = undefined;
                this.automationSessionUrl = undefined;
                sessionId = undefined;
            }
        }
        if (!sessionId) {
            const result = await automationService.createSession(url, viewport ? { viewport } : undefined);
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to create browser automation session');
            }
            sessionId = result.data;
            this.mainAutomationSessionId = sessionId;
            this.elementSelection.viewport = viewport;
            this.automationSessionUrl = url;
            await this.updateNavigationButtonState(sessionId);
            return sessionId;
        }
        if (viewport) {
            this.elementSelection.viewport = viewport;
        }
        // Compare against the URL the automation session is actually on, not the UI URL
        const needsNavigation = !this.automationSessionUrl ||
            this.normalizePageUrl(this.automationSessionUrl) !== this.normalizePageUrl(url);
        if (needsNavigation) {
            const navRes = await automationService.navigate(sessionId, url, { waitUntil: 'domcontentloaded', timeout: 12000 });
            if (!navRes.success) {
                throw new Error(navRes.error || 'Failed to navigate automation session');
            }
            const actualUrl = navRes.data || url;
            this.automationSessionUrl = actualUrl;
            await this.updateNavigationButtonState(sessionId);
        }
        return sessionId;
    }
    async screenshotSession(sessionId, options) {
        const res = await vscode.commands.executeCommand('_browserAutomation.screenshot', { sessionId, options });
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
    async evaluateInSession(sessionId, script) {
        const res = await vscode.commands.executeCommand('_browserAutomation.evaluate', { sessionId, script });
        if (!res?.success) {
            throw new Error(res?.error || 'Failed to evaluate script');
        }
        return res.data;
    }
    clampClip(boundingBox, viewport, padding) {
        const pad = Math.max(0, Math.round(padding));
        const vpW = Math.max(0, Math.round(viewport.width));
        const vpH = Math.max(0, Math.round(viewport.height));
        if (!vpW || !vpH)
            return null;
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
    isLikelyStaleSearchUrl(url) {
        const lower = url.toLowerCase();
        return lower.includes('google.com/search') ||
            lower.includes('google.com/url') ||
            lower.includes('bing.com/search') ||
            lower.includes('duckduckgo.com/');
    }
    async handleStartElementSelection(e) {
        if (this.iframeNavigatedSinceUrlBarSync && this.isLikelyStaleSearchUrl(this.currentUrl)) {
            throw new Error('The page navigated away from search results. Enter the current page URL in the address bar and press Enter, then try Select Element again.');
        }
        const webviewUrl = typeof e.url === 'string' ? e.url : undefined;
        const url = this.resolveElementSelectionUrl(webviewUrl);
        const viewport = e.viewport && typeof e.viewport.width === 'number' && typeof e.viewport.height === 'number'
            ? { width: Math.max(1, Math.round(e.viewport.width)), height: Math.max(1, Math.round(e.viewport.height)) }
            : undefined;
        this.elementSelection.active = true;
        this.elementSelection.pickInProgress = false;
        this.elementSelection.viewport = viewport;
        this.bumpElementSelectionGeneration();
        await this.waitForNavigationIdle();
        const sessionId = await this.ensureElementSelectionSession(url, viewport);
        const screenshot = await this.screenshotSession(sessionId, { type: 'png' });
        if (!screenshot || screenshot.length < 100) {
            throw new Error('Screenshot capture returned empty data. Try reloading the page.');
        }
        this.postElementSelectionMessage({ type: 'elementSelection.screenshot', data: screenshot });
    }
    clampPointerCoordinates(x, y, viewport) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        const vpW = Math.max(0, Math.round(viewport.width));
        const vpH = Math.max(0, Math.round(viewport.height));
        if (!vpW || !vpH) {
            return null;
        }
        const clampedX = Math.max(0, Math.min(vpW - 1, Math.round(x)));
        const clampedY = Math.max(0, Math.min(vpH - 1, Math.round(y)));
        return { x: clampedX, y: clampedY };
    }
    async handleElementSelectionHover(e) {
        if (!this.elementSelection.active)
            return;
        if (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)
            return;
        if (this.isProcessingNavigation || this.isRecoveringSession)
            return;
        if (this.elementSelection.pickInProgress)
            return;
        const sessionId = this.mainAutomationSessionId;
        if (!sessionId)
            return;
        if (typeof e.x !== 'number' || typeof e.y !== 'number')
            return;
        const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
        const point = this.clampPointerCoordinates(e.x, e.y, viewport);
        if (!point)
            return;
        const requestId = ++this.elementSelection.hoverRequestId;
        const hoverData = await this.evaluateInSession(sessionId, (0, elementSelection_1.buildHoverScript)(point.x, point.y));
        if (!this.elementSelection.active || requestId !== this.elementSelection.hoverRequestId)
            return;
        if (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)
            return;
        this.postElementSelectionMessage({ type: 'elementSelection.hoverResult', data: hoverData });
    }
    validateBrowserElementPayload(pickData, elementScreenshot) {
        if (!pickData.selector?.trim())
            return false;
        if (!pickData.elementData?.tagName?.trim())
            return false;
        if (!pickData.pageUrl?.trim())
            return false;
        if (pickData.isSensitive)
            return false;
        const tagName = pickData.elementData.tagName;
        if (tagName.length > 50)
            return false;
        const text = pickData.elementData.text ?? '';
        const html = pickData.elementData.html ?? '';
        if (text.length > 500 || html.length > 2000)
            return false;
        if (elementScreenshot) {
            if (elementScreenshot.length > 5000000)
                return false;
            if (!/^[A-Za-z0-9+/=]+$/.test(elementScreenshot))
                return false;
        }
        return true;
    }
    async handleElementSelectionPick(e) {
        if (!this.elementSelection.active)
            return;
        if (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)
            return;
        if (this.isProcessingNavigation || this.isRecoveringSession)
            return;
        if (this.elementSelection.pickInProgress)
            return;
        const sessionId = this.mainAutomationSessionId;
        if (!sessionId)
            return;
        if (typeof e.x !== 'number' || typeof e.y !== 'number')
            return;
        const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
        const point = this.clampPointerCoordinates(e.x, e.y, viewport);
        if (!point)
            return;
        this.elementSelection.pickInProgress = true;
        try {
            const pickData = await this.evaluateInSession(sessionId, (0, elementSelection_1.buildPickScript)(point.x, point.y));
            if (!this.elementSelection.active || (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)) {
                return;
            }
            if (!pickData || !pickData.selector || !pickData.elementData?.tagName) {
                return;
            }
            if (pickData.isSensitive) {
                vscode.window.showWarningMessage('Refusing to capture sensitive fields (e.g. password inputs).');
                this.postElementSelectionMessage({ type: 'elementSelection.picked', data: { label: 'Sensitive field refused', selector: '' } });
                return;
            }
            let elementScreenshot = null;
            if (pickData.boundingBox) {
                const clip = this.clampClip(pickData.boundingBox, pickData.viewport, 12);
                if (clip) {
                    try {
                        elementScreenshot = await this.screenshotSession(sessionId, {
                            type: 'png',
                            clip,
                            omitBackground: false,
                            encoding: 'base64'
                        });
                    }
                    catch (error) {
                        console.error('Failed to capture element screenshot:', error);
                        elementScreenshot = null;
                    }
                }
            }
            if (!this.validateBrowserElementPayload(pickData, elementScreenshot)) {
                this.postElementSelectionError('Invalid element data — try selecting a different element.');
                return;
            }
            const payload = {
                type: 'BrowserElement',
                selector: pickData.selector,
                selectorChain: pickData.selectorChain,
                pageUrl: pickData.pageUrl,
                elementData: pickData.elementData,
                screenshot: elementScreenshot,
                timestamp: Date.now(),
            };
            try {
                await vscode.commands.executeCommand('void.addBrowserElementSelection', payload);
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed to add element to chat selections: ${err instanceof Error ? err.message : String(err)}`);
                this.postElementSelectionError(err instanceof Error ? err.message : String(err));
                return;
            }
            this.postElementSelectionMessage({ type: 'elementSelection.picked', data: { label: pickData.elementData.tagName, selector: pickData.selector } });
        }
        finally {
            this.elementSelection.pickInProgress = false;
        }
    }
    async handleElementSelectionScroll(e) {
        if (!this.elementSelection.active)
            return;
        if (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)
            return;
        if (this.isProcessingNavigation || this.isRecoveringSession)
            return;
        const sessionId = this.mainAutomationSessionId;
        if (!sessionId)
            return;
        if (typeof e.deltaY !== 'number')
            return;
        const deltaY = Math.max(-2000, Math.min(2000, Math.round(e.deltaY)));
        await this.evaluateInSession(sessionId, `(() => { window.scrollBy(0, ${deltaY}); return { y: window.scrollY }; })()`);
        await new Promise(resolve => setTimeout(resolve, 120));
        if (!this.elementSelection.active || (typeof e.generation === 'number' && e.generation !== this.elementSelection.generation)) {
            return;
        }
        const screenshot = await this.screenshotSession(sessionId, { type: 'png' });
        this.postElementSelectionMessage({ type: 'elementSelection.screenshot', data: screenshot });
    }
    // --- Bidirectional Navigation Sync Methods ---
    /**
     * Get automation service from global registry
     */
    getAutomationService() {
        return this.automationService ?? global.browserAutomationService;
    }
    /**
     * Handle UI navigation and sync to Puppeteer
     * Called when user navigates in the UI (types URL, clicks links, etc.)
     */
    enqueueNavigation(request) {
        return new Promise((resolve, reject) => {
            this.navigationQueue.push({ ...request, resolve, reject });
            if (!this.isProcessingNavigation) {
                this.processNavigationQueue().catch(err => console.error('Navigation queue processing failed:', err));
            }
        });
    }
    async processNavigationQueue() {
        if (this.isProcessingNavigation) {
            return;
        }
        this.isProcessingNavigation = true;
        try {
            while (this.navigationQueue.length) {
                const next = this.navigationQueue.shift();
                try {
                    switch (next.kind) {
                        case 'navigate': {
                            if (next.url !== this.currentUrl) {
                                break;
                            }
                            try {
                                await this.syncUINavigationToAutomation(next.url);
                            }
                            catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                if (this.currentUrl === next.url) {
                                    await this.revertNavigation(next.previousUrl, message);
                                }
                                throw error;
                            }
                            break;
                        }
                        case 'back':
                            await this.performBackNavigation();
                            break;
                        case 'forward':
                            await this.performForwardNavigation();
                            break;
                        case 'reload':
                            await this.performReload();
                            break;
                        case 'recover':
                            await this.recoverDeadSession(next.reason);
                            break;
                    }
                    next.resolve();
                }
                catch (error) {
                    next.reject(error);
                }
            }
        }
        finally {
            this.isProcessingNavigation = false;
        }
    }
    normalizePageUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.href.replace(/\/$/, '');
        }
        catch {
            return url.trim();
        }
    }
    resolveElementSelectionUrl(webviewUrl) {
        const candidates = [this.currentUrl, webviewUrl].filter((u) => typeof u === 'string' && u.length > 0);
        return candidates[0] || 'https://www.google.com/';
    }
    handleIframeLoaded(e) {
        if (typeof e.url === 'string' && e.url.length && e.url !== 'about:blank') {
            this.iframeNavigatedSinceUrlBarSync = false;
            this.currentUrl = e.url;
            void this._webviewPanel.webview.postMessage({ type: 'updateUrlBar', url: e.url, stale: false });
            if (e.url !== this.automationSessionUrl) {
                this.handleUINavigation(e.url, 'iframe').catch(err => {
                    console.error('Failed to sync iframe navigation:', err);
                });
            }
            return;
        }
        if (e.crossOrigin) {
            this.iframeNavigatedSinceUrlBarSync = true;
            void this._webviewPanel.webview.postMessage({ type: 'updateUrlBar', stale: true });
        }
    }
    async waitForNavigationIdle(maxMs = 8000) {
        const start = Date.now();
        while (this.isProcessingNavigation || this.navigationQueue.length) {
            if (Date.now() - start > maxMs) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    async handleUINavigation(url, source) {
        const previousUrl = this.currentUrl;
        this.currentUrl = url;
        if (source === 'user' || source === 'user-action') {
            this.iframeNavigatedSinceUrlBarSync = false;
            void this._webviewPanel.webview.postMessage({ type: 'updateUrlBar', url, stale: false });
        }
        if (!this.navigationSyncEnabled) {
            return;
        }
        return this.enqueueNavigation({ kind: 'navigate', url, source, previousUrl });
    }
    async syncUINavigationToAutomation(url) {
        const automationService = this.getAutomationService();
        if (!automationService) {
            return;
        }
        let sessionId = this.mainAutomationSessionId;
        if (sessionId) {
            const isAlive = await this.verifySession(sessionId, automationService);
            if (!isAlive) {
                sessionId = undefined;
                this.mainAutomationSessionId = undefined;
            }
        }
        if (!sessionId) {
            const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
            const result = await automationService.createSession(url, {
                viewport
            });
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to create automation session');
            }
            this.mainAutomationSessionId = result.data;
            this.elementSelection.viewport = viewport;
            this.automationSessionUrl = url;
            await this.updateNavigationButtonState(result.data);
            await this.onNavigationSyncedForSelection(url);
            return;
        }
        const result = await automationService.navigate(sessionId, url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        if (result.success) {
            const actualUrl = result.data;
            if (typeof actualUrl === 'string' && actualUrl.length) {
                this.automationSessionUrl = actualUrl;
            }
            else {
                this.automationSessionUrl = url;
            }
            await this.updateNavigationButtonState(sessionId);
            await this.onNavigationSyncedForSelection(this.automationSessionUrl ?? url);
            return;
        }
        if (result.error?.includes('Session') || result.error?.includes('closed')) {
            this.mainAutomationSessionId = undefined;
            this.automationSessionUrl = undefined;
            const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
            const createResult = await automationService.createSession(url, { viewport });
            if (!createResult.success || !createResult.data) {
                throw new Error(createResult.error || 'Failed to recreate session');
            }
            this.mainAutomationSessionId = createResult.data;
            this.elementSelection.viewport = viewport;
            this.automationSessionUrl = url;
            await this.updateNavigationButtonState(createResult.data);
            await this.onNavigationSyncedForSelection(url);
            return;
        }
        throw new Error(result.error || 'Navigation failed');
    }
    startNavigationPolling() {
        if (this.navigationPollingInterval) {
            return;
        }
        this.navigationPollingInterval = setInterval(() => {
            this.pollNavigationFromAutomation().catch(err => console.error('Navigation polling failed:', err));
        }, 500);
    }
    stopNavigationPolling() {
        if (!this.navigationPollingInterval) {
            return;
        }
        clearInterval(this.navigationPollingInterval);
        this.navigationPollingInterval = undefined;
    }
    async pollNavigationFromAutomation() {
        if (!this.navigationSyncEnabled || this.isProcessingNavigation || this.isRecoveringSession || this.elementSelection.active) {
            return;
        }
        const sessionId = this.mainAutomationSessionId;
        if (!sessionId) {
            return;
        }
        const result = await vscode.commands.executeCommand('_browserAutomation.getUrl', { sessionId });
        const url = result?.success ? result.data : undefined;
        if (typeof url !== 'string' || !url.length) {
            return;
        }
        // Track automation URL internally only — never push to iframe via polling.
        // Iframe is the source of truth for what the user sees; only back/forward/reload sync iframe.
        if (url !== this.automationSessionUrl) {
            this.automationSessionUrl = url;
        }
    }
    startSessionHealthMonitoring() {
        if (this.sessionHealthCheckInterval) {
            return;
        }
        this.sessionHealthCheckInterval = setInterval(() => {
            this.checkSessionHealth().catch(err => console.error('Session health check failed:', err));
        }, 5000);
    }
    stopSessionHealthMonitoring() {
        if (!this.sessionHealthCheckInterval) {
            return;
        }
        clearInterval(this.sessionHealthCheckInterval);
        this.sessionHealthCheckInterval = undefined;
    }
    async checkSessionHealth() {
        if (!this.navigationSyncEnabled || this.isRecoveringSession) {
            return;
        }
        const automationService = this.getAutomationService();
        const sessionId = this.mainAutomationSessionId;
        if (!automationService || !sessionId) {
            return;
        }
        if (this.navigationQueue.some(item => item.kind === 'recover')) {
            return;
        }
        const isAlive = await this.verifySession(sessionId, automationService);
        if (!isAlive) {
            await this.enqueueNavigation({ kind: 'recover', reason: 'health-check' });
        }
    }
    async recoverDeadSession(reason) {
        if (this.isRecoveringSession) {
            return;
        }
        this.isRecoveringSession = true;
        const automationService = this.getAutomationService();
        const urlToRestore = this.currentUrl || 'https://www.google.com/';
        const oldSessionId = this.mainAutomationSessionId;
        try {
            await this._webviewPanel.webview.postMessage({ type: 'sessionRecovering', reason });
            if (automationService && oldSessionId) {
                await automationService.closeSession(oldSessionId).catch(() => { });
            }
            this.mainAutomationSessionId = undefined;
            if (!automationService) {
                throw new Error('Browser automation service unavailable');
            }
            const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
            const createResult = await automationService.createSession(urlToRestore, { viewport });
            if (!createResult.success || !createResult.data) {
                throw new Error(createResult.error || 'Failed to recover automation session');
            }
            this.mainAutomationSessionId = createResult.data;
            this.elementSelection.viewport = viewport;
            this.automationSessionUrl = urlToRestore;
            await this.updateNavigationButtonState(createResult.data);
            await this._webviewPanel.webview.postMessage({ type: 'sessionRecovered' });
            await this.onNavigationSyncedForSelection(urlToRestore);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this._webviewPanel.webview.postMessage({ type: 'sessionRecoveryFailed', error: message });
            if (this.elementSelection.active) {
                this.postElementSelectionError('Automation session lost. Press Reload or re-enable Select Element.');
            }
        }
        finally {
            this.isRecoveringSession = false;
        }
    }
    async updateNavigationButtonState(_sessionId) {
        const result = await vscode.commands.executeCommand('_browserAutomation.getNavigationState', { sessionId: _sessionId });
        if (!result?.success || !result.data) {
            return;
        }
        await this._webviewPanel.webview.postMessage({
            type: 'updateNavigationState',
            canGoBack: !!result.data.canGoBack,
            canGoForward: !!result.data.canGoForward
        });
    }
    /**
     * Verify if a session is still alive
     */
    async verifySession(sessionId, automationService) {
        try {
            const result = await automationService.getUrl(sessionId);
            return result.success;
        }
        catch {
            return false;
        }
    }
    /**
     * Handle back navigation
     */
    async handleBackNavigation() {
        if (!this.navigationSyncEnabled) {
            return;
        }
        return this.enqueueNavigation({ kind: 'back' });
    }
    async performBackNavigation() {
        try {
            const automationService = this.getAutomationService();
            if (!automationService) {
                return;
            }
            let sessionId = this.mainAutomationSessionId;
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (sessionId) {
                    this.mainAutomationSessionId = sessionId;
                }
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
                this.automationSessionUrl = urlResult.data;
                // Sync UI to new URL
                await this._webviewPanel.webview.postMessage({
                    type: 'navigate',
                    url: urlResult.data
                });
                await this.onNavigationSyncedForSelection(urlResult.data);
            }
            await this.updateNavigationButtonState(sessionId);
        }
        catch (error) {
            console.error('Back navigation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            // Don't show error for common cases like "no history"
            if (!message.includes('history') && !message.includes('cannot go back')) {
                vscode.window.showErrorMessage(`Failed to go back: ${message}`);
            }
        }
    }
    /**
     * Handle forward navigation
     */
    async handleForwardNavigation() {
        if (!this.navigationSyncEnabled) {
            return;
        }
        return this.enqueueNavigation({ kind: 'forward' });
    }
    async performForwardNavigation() {
        try {
            const automationService = this.getAutomationService();
            if (!automationService) {
                return;
            }
            let sessionId = this.mainAutomationSessionId;
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (sessionId) {
                    this.mainAutomationSessionId = sessionId;
                }
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
                this.automationSessionUrl = urlResult.data;
                // Sync UI to new URL
                await this._webviewPanel.webview.postMessage({
                    type: 'navigate',
                    url: urlResult.data
                });
                await this.onNavigationSyncedForSelection(urlResult.data);
            }
            await this.updateNavigationButtonState(sessionId);
        }
        catch (error) {
            console.error('Forward navigation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            // Don't show error for common cases like "no forward history"
            if (!message.includes('history') && !message.includes('cannot go forward')) {
                vscode.window.showErrorMessage(`Failed to go forward: ${message}`);
            }
        }
    }
    /**
     * Handle reload
     */
    async handleReload() {
        if (!this.navigationSyncEnabled) {
            return;
        }
        return this.enqueueNavigation({ kind: 'reload' });
    }
    async performReload() {
        try {
            const automationService = this.getAutomationService();
            if (!automationService) {
                return;
            }
            let sessionId = this.mainAutomationSessionId;
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (sessionId) {
                    this.mainAutomationSessionId = sessionId;
                }
            }
            if (!sessionId) {
                throw new Error('No active session for reload. Please open a page first.');
            }
            // Verify session is alive
            const isAlive = await this.verifySession(sessionId, automationService);
            if (!isAlive) {
                // Session dead - recreate with current URL
                if (this.currentUrl) {
                    const viewport = this.elementSelection.viewport ?? { width: 1280, height: 720 };
                    const result = await automationService.createSession(this.currentUrl, { viewport });
                    if (result.success && result.data) {
                        this.mainAutomationSessionId = result.data;
                        this.elementSelection.viewport = viewport;
                        this.automationSessionUrl = this.currentUrl;
                        await this.updateNavigationButtonState(result.data);
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
            await this.updateNavigationButtonState(sessionId);
            if (this.elementSelection.active) {
                await this.onNavigationSyncedForSelection(this.automationSessionUrl ?? this.currentUrl);
            }
        }
        catch (error) {
            console.error('Reload failed:', error);
            vscode.window.showErrorMessage(`Failed to reload: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Revert navigation to previous URL on error
     */
    async revertNavigation(previousUrl, errorMessage) {
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
    setNavigationSyncEnabled(enabled) {
        this.navigationSyncEnabled = enabled;
    }
    getHtml(url) {
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
            focusLockEnabled: configuration.get('focusLockIndicator.enabled', true)
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
    extensionResourceUrl(...parts) {
        return this._webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...parts));
    }
}
exports.SimpleBrowserView = SimpleBrowserView;
SimpleBrowserView.viewType = 'simpleBrowser.view';
SimpleBrowserView.title = vscode.l10n.t("Browser");
function escapeAttribute(value) {
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
//# sourceMappingURL=simpleBrowserView.js.map