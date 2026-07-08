/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IBrowserViewService = createDecorator<IBrowserViewService>('browserViewService');

/**
 * Stable identifier of a browser view owned by a particular editor tab.
 * Unique per editor input across the whole app.
 */
export type BrowserViewId = string;

export interface IElementBoundingBox {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface INavigationState {
	readonly url: string;
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
	readonly isLoading: boolean;
	readonly title: string;
}

export interface IElementData {
	readonly tagName: string;
	readonly id: string | null;
	readonly classes: string[];
	readonly attributes: Record<string, string>;
	readonly text: string;
	readonly html: string;
}

export interface IElementPickData {
	readonly pageUrl: string;
	readonly selector: string;
	readonly selectorChain?: string[];
	readonly elementData: IElementData;
	readonly boundingBox: IElementBoundingBox | null;
	readonly viewport: { readonly width: number; readonly height: number };
	readonly isSensitive: boolean;
}

export interface IBrowserViewOpenOptions {
	readonly url: string;
	/** Optional home URL used by the home button. Defaults to `url`. */
	readonly homeUrl?: string;
	/**
	 * Initial viewport-relative bounds of the editor pane's content area, if already known
	 * when `open()` is called. When provided, the view is sized and made visible *before*
	 * navigation starts, so the first paint happens live instead of while hidden (a hidden/
	 * zero-size `WebContentsView` does not composite frames, so a page that finishes loading
	 * before the first `setBounds`/`setVisible` call stays blank until something else forces
	 * a repaint, e.g. a manual reload).
	 */
	readonly bounds?: IBrowserViewBounds;
}

export interface IBrowserViewBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Event emitted when a browser view finishes navigating. */
export interface IBrowserViewNavigationEvent {
	readonly id: BrowserViewId;
	readonly url: string;
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
}

export interface IBrowserViewTitleEvent {
	readonly id: BrowserViewId;
	readonly title: string;
}

export interface IBrowserViewFaviconEvent {
	readonly id: BrowserViewId;
	readonly favicon: string | null;
}

export interface IBrowserViewLoadingEvent {
	readonly id: BrowserViewId;
	readonly isLoading: boolean;
}

/**
 * A browser-chrome shortcut pressed while the native page had focus. `action` is the canonical
 * command id the pane should run (e.g. `_browserView.findInPage`); `id` is the owning view so
 * only the right pane reacts.
 */
export interface IBrowserViewShortcutEvent {
	readonly id: BrowserViewId;
	readonly action: BrowserShortcutAction;
}

/** The set of browser-chrome actions forwardable from the main process to the renderer. */
export type BrowserShortcutAction =
	| 'findInPage'
	| 'closeFindInPage'
	| 'zoomIn'
	| 'zoomOut'
	| 'zoomReset'
	| 'reload'
	| 'focusAddressBar'
	| 'goBack'
	| 'goForward';

export interface IBrowserViewService {
	readonly _serviceBrand: undefined;

	readonly onDidNavigate: Event<IBrowserViewNavigationEvent>;
	readonly onDidTitleChange: Event<IBrowserViewTitleEvent>;
	readonly onDidFaviconChange: Event<IBrowserViewFaviconEvent>;
	readonly onDidLoadingStateChange: Event<IBrowserViewLoadingEvent>;
	readonly onDidClose: Event<BrowserViewId>;
	/**
	 * Fires when the user focuses the native web contents directly (e.g. clicks into the
	 * page). The renderer never sees that interaction, so it uses this to activate the
	 * owning editor group and keep tab/keybinding state in sync.
	 */
	readonly onDidFocusView: Event<BrowserViewId>;

	/**
	 * Fires when the user presses a browser-chrome shortcut (Cmd+F find, Cmd+R reload,
	 * Cmd+L address, Cmd+/-/0 zoom, Alt+Left/Right back/forward) while the native page has
	 * focus. Because the `WebContentsView` is a separate OS surface, its key events never
	 * reach the workbench renderer's DOM, so the workbench keybinding system cannot see
	 * them. The main process intercepts these keystrokes in `before-input-event` (letting
	 * editing shortcuts like Cmd+A/C/V through to the page) and forwards the chrome ones
	 * here; the owning pane runs the matching command.
	 */
	readonly onDidBrowserShortcut: Event<IBrowserViewShortcutEvent>;

	/**
	 * Open (or focus) a browser view for the given id. The view is attached to the
	 * Electron window identified by `windowId` (passed as IPC context by the renderer proxy).
	 */
	open(id: BrowserViewId, options: IBrowserViewOpenOptions): Promise<INavigationState>;
	close(id: BrowserViewId): Promise<void>;

	navigate(id: BrowserViewId, url: string): Promise<INavigationState>;
	goBack(id: BrowserViewId): Promise<INavigationState>;
	goForward(id: BrowserViewId): Promise<INavigationState>;
	reload(id: BrowserViewId): Promise<INavigationState>;
	stop(id: BrowserViewId): Promise<INavigationState>;

	/** Zoom factor for the page (1 = 100%). Clamped to [0.25, 5]. */
	setZoomFactor(id: BrowserViewId, zoomFactor: number): Promise<void>;
	/** Returns the current page zoom factor (1 = 100%). */
	getZoomFactor(id: BrowserViewId): Promise<number>;

	/** Opens the browser's find-in-page UI for `query` (empty to clear/close). */
	findInPage(id: BrowserViewId, query: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void>;
	/** Stops/closes the active find-in-page session. */
	stopFindInPage(id: BrowserViewId): Promise<void>;

	setBounds(id: BrowserViewId, bounds: IBrowserViewBounds): Promise<void>;
	setVisible(id: BrowserViewId, visible: boolean): Promise<void>;
	focus(id: BrowserViewId): Promise<void>;
	blur(id: BrowserViewId): Promise<void>;
	bringToFront(id: BrowserViewId): Promise<void>;
	/**
	 * When `enabled` is true, application menu shortcuts (Cmd+A, Cmd+C, Cmd+F, …) are routed to
	 * the browser page instead of the workbench's menu bar, so editing/search shortcuts work
	 * inside the page when it has focus. Set to false when the page loses focus (chrome focused,
	 * overlay up, pane hidden) so the workbench menu shortcuts resume.
	 */
	setIgnoreMenuShortcuts(id: BrowserViewId, enabled: boolean): Promise<void>;

	executeJavaScript(id: BrowserViewId, script: string): Promise<unknown>;
	screenshot(id: BrowserViewId): Promise<string>;

	/**
	 * Installs the live picker overlay in the page and resolves with the first pick/cancel.
	 * Returns `{ picked: true, data }` on pick, `{ picked: false }` on cancel (Esc).
	 */
	runPicker(id: BrowserViewId): Promise<{ picked: boolean; data?: IElementPickData }>;
	/** Tears down the picker overlay if installed. */
	teardownPicker(id: BrowserViewId): Promise<void>;
}

/**
 * Resolves a raw address-bar / command value into a navigable URL.
 * Absolute URLs pass through, bare hosts get https://, everything else becomes a search query.
 */
export function resolveBrowserNavigationTarget(raw: string, searchEngine: 'google' | 'duckduckgo' | 'bing' = 'google'): string {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) {
		return 'https://www.google.com/';
	}
	if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed)) {
		return trimmed;
	}
	if (!/\s/.test(trimmed) && looksLikeHost(trimmed)) {
		return 'https://' + trimmed;
	}
	const q = encodeURIComponent(trimmed);
	switch (searchEngine) {
		case 'duckduckgo':
			return `https://duckduckgo.com/?q=${q}`;
		case 'bing':
			return `https://www.bing.com/search?q=${q}`;
		default:
			return `https://www.google.com/search?q=${q}`;
	}
}

function looksLikeHost(value: string): boolean {
	const host = value.split(/[/?#]/, 1)[0].split(':')[0];
	if (host.toLowerCase() === 'localhost') {
		return true;
	}
	if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
		return true;
	}
	return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}

/** Returns true when a URL is safe to show in the address bar (main-frame committed navigations). */
export function shouldDisplayBrowserUrl(url: string): boolean {
	const candidate = String(url ?? '').trim();
	if (!candidate) {
		return false;
	}
	const lower = candidate.toLowerCase();
	if (lower === 'about:blank' || lower === 'about:srcdoc') {
		return false;
	}
	if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:')) {
		return false;
	}
	return true;
}
