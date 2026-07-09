/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserViewId, IBrowserViewBounds } from './browserView.js';

/**
 * Snapshot of a single browser tab's externally-visible state. Returned by
 * `listViews` and used by the tab registry / built-in MCP server to describe
 * open tabs to the agent without exposing internal Electron handles.
 */
export interface IBrowserViewInfo {
	readonly id: BrowserViewId;
	readonly url: string;
	readonly title: string;
	readonly favicon: string | null;
	readonly isLoading: boolean;
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
	readonly windowId: number;
}

export interface IBrowserViewFullNavigationState {
	readonly url: string;
	readonly title: string;
	readonly isLoading: boolean;
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
	readonly favicon: string | null;
}

/** Options for {@link IBrowserAutomationService.captureAccessibilitySnapshot}. */
export interface IAccessibilitySnapshotOptions {
	/** When true, only include interactive elements (links, buttons, inputs, etc.). */
	readonly interactive?: boolean;
	/** Maximum tree depth. Defaults to 20. */
	readonly maxDepth?: number;
	/** When true, omit non-essential attributes (classes, inline styles) for a smaller payload. */
	readonly compact?: boolean;
	/** Optional CSS selector to scope the snapshot to a subtree. */
	readonly selector?: string;
}

/** A single node in the accessibility snapshot returned to the agent. */
export interface IAXNode {
	/** Opaque ref the agent passes back to {@link IBrowserAutomationService.clickByRef} etc. */
	readonly ref: string;
	/** ARIA / native role, e.g. `button`, `link`, `textbox`, `heading`. */
	readonly role: string;
	/** Accessible name (text content, aria-label, etc.). */
	readonly name: string;
	/** Bounding box in CSS pixels relative to the page viewport. May be null for off-screen nodes. */
	readonly bounds: IBrowserViewBounds | null;
	/** Depth in the tree (root is 0). */
	readonly depth: number;
	/** Child refs (only present when the node has children). */
	readonly children?: string[];
	/** Extra attributes that vary by role (value, checked, level, url, …). */
	readonly attributes?: Record<string, string | boolean | number>;
}

export interface IAccessibilitySnapshot {
	readonly viewId: BrowserViewId;
	readonly url: string;
	readonly title: string;
	/** All nodes indexed by ref — the agent looks up refs from the YAML tree. */
	readonly nodes: Record<string, IAXNode>;
	/** Ref of the root node. */
	readonly rootRef: string;
	/** YAML serialization of the tree (what gets returned to the model in `text`). */
	readonly yaml: string;
	/** Refs that existed in the previous snapshot but are gone now (for diff mode). */
	readonly removedRefs?: string[];
}

/** Options for {@link IBrowserAutomationService.dispatchMouseClick}. */
export interface IMouseClickOptions {
	readonly button?: 'left' | 'right' | 'middle';
	readonly doubleClick?: boolean;
	readonly modifiers?: readonly ('Control' | 'Shift' | 'Alt' | 'Meta' | 'ControlOrMeta')[];
	/** Hold duration in ms before release (for long presses). */
	readonly holdDurationMs?: number;
	/** Optional x/y offset from the element center (in CSS px). */
	readonly offsetX?: number;
	readonly offsetY?: number;
}

/** Options for {@link IBrowserAutomationService.dispatchKey}. */
export interface IKeyDispatchOptions {
	readonly modifiers?: readonly ('Control' | 'Shift' | 'Alt' | 'Meta' | 'ControlOrMeta')[];
}

/** Options for {@link IBrowserAutomationService.scroll}. */
export interface IScrollOptions {
	readonly deltaX?: number;
	readonly deltaY?: number;
	/** Scroll to a specific ref instead of by delta. */
	readonly ref?: string;
}

/** Options for {@link IBrowserAutomationService.dispatchDrag}. */
export interface IDragOptions {
	readonly sourceRef: string;
	/** Target element ref. Either targetRef or targetX/targetY must be provided. */
	readonly targetRef?: string;
	/** Target viewport x coordinate. Used when targetRef is not provided. */
	readonly targetX?: number;
	/** Target viewport y coordinate. Used when targetRef is not provided. */
	readonly targetY?: number;
	/** Optional intermediate points (refs) for multi-step drags. */
	readonly intermediateRefs?: readonly string[];
}

/** Options for {@link IBrowserAutomationService.captureScreenshot}. */
export interface IScreenshotOptions {
	/** Image format. Defaults to png. */
	readonly format?: 'png' | 'jpeg';
	/** When true, capture the full scrollable page instead of the viewport. */
	readonly fullPage?: boolean;
	/** Optional element ref to clip the screenshot to. Mutually exclusive with fullPage. */
	readonly ref?: string;
	/** JPEG quality 0-100 (only used when format is jpeg). */
	readonly quality?: number;
}

/** A captured console message. */
export interface IConsoleMessage {
	readonly level: 'log' | 'info' | 'warning' | 'error' | 'debug';
	readonly text: string;
	readonly url?: string;
	readonly lineNumber?: number;
	readonly timestamp: number;
}

/** A captured network request summary. */
export interface INetworkRequest {
	readonly requestId: string;
	readonly url: string;
	readonly method: string;
	readonly resourceType: string;
	readonly statusCode?: number;
	readonly failed?: boolean;
	readonly errorText?: string;
	readonly timestamp: number;
}

/**
 * Service contract for agent-driven browser automation. Lives in the main
 * process and wraps `BrowserViewMainService` + CDP. The renderer talks to it
 * via the `browserView` IPC channel; the built-in `orbit-ide-browser` MCP
 * server calls it directly in-process.
 *
 * All methods operate on a `BrowserViewId` returned by `BrowserViewMainService.open`.
 * Refs are opaque strings returned by `captureAccessibilitySnapshot` and are
 * invalidated on every main-frame navigation.
 */
export interface IBrowserAutomationService {
	readonly _serviceBrand: undefined;

	/** Lists all currently-open browser tabs across all windows. */
	listViews(): IBrowserViewInfo[];
	/** Returns the full navigation state for a tab (used by `browser_tabs`). */
	getNavigationState(id: BrowserViewId): IBrowserViewFullNavigationState;

	/** Lazily attaches the CDP debugger to a tab (idempotent). */
	attachDebugger(id: BrowserViewId): Promise<void>;
	/** Detaches the CDP debugger if attached. */
	detachDebugger(id: BrowserViewId): Promise<void>;
	/** Sends a CDP command with the centralized security denylist enforced. */
	sendCdpCommand(id: BrowserViewId, method: string, params?: Record<string, unknown>): Promise<unknown>;

	/** Captures an accessibility snapshot and builds the ref map for the tab. */
	captureAccessibilitySnapshot(id: BrowserViewId, opts?: IAccessibilitySnapshotOptions): Promise<IAccessibilitySnapshot>;

	/** Resolves a ref to its current bounds (or throws if the ref is stale). */
	resolveRefBounds(id: BrowserViewId, ref: string): Promise<IBrowserViewBounds>;

	/** Clicks an element by ref (preferred over raw CDP Input.*). */
	clickByRef(id: BrowserViewId, ref: string, opts?: IMouseClickOptions): Promise<void>;
	/** Clicks at absolute viewport coordinates (for `browser_mouse_click_xy`). */
	clickAt(id: BrowserViewId, x: number, y: number, opts?: IMouseClickOptions): Promise<void>;
	/** Hovers an element by ref. */
	hoverByRef(id: BrowserViewId, ref: string): Promise<void>;
	/** Types text into an element by ref (appends to existing value). */
	typeByRef(id: BrowserViewId, ref: string, text: string, opts?: { slowly?: boolean; submit?: boolean }): Promise<void>;
	/** Clears and fills an element by ref. */
	fillByRef(id: BrowserViewId, ref: string, value: string): Promise<void>;
	/** Selects options in a `<select>` by ref. */
	selectOptionByRef(id: BrowserViewId, ref: string, values: readonly string[]): Promise<void>;
	/** Presses a keyboard key (e.g. `Enter`, `PageDown`, `ArrowDown`). */
	pressKey(id: BrowserViewId, key: string, opts?: IKeyDispatchOptions): Promise<void>;
	/** Scrolls the page or a specific element. */
	scroll(id: BrowserViewId, opts: IScrollOptions): Promise<void>;
	/** Drags from one ref to another. */
	dispatchDrag(id: BrowserViewId, opts: IDragOptions): Promise<void>;

	/** Highlights an element by ref (visual grounding for the agent). */
	highlightByRef(id: BrowserViewId, ref: string): Promise<void>;
	/** Clears any active highlight. */
	clearHighlight(id: BrowserViewId): Promise<void>;

	/**
	 * Captures a screenshot of the browser tab.
	 *
	 * Viewport PNG (default) uses native `webContents.capturePage()` (Retina-
	 * correct). Full-page / element / JPEG use CDP `Page.captureScreenshot`
	 * with CSS-pixel clips (`cssContentSize` / `cssVisualViewport`). Never
	 * uses the deprecated device-pixel `contentSize` as a CSS clip.
	 */
	captureScreenshot(id: BrowserViewId, opts?: IScreenshotOptions): Promise<{ data: string; mimeType: 'image/png' | 'image/jpeg' }>;

	/** Locks or unlocks a tab for automation. When locked, user pointer events are blocked. */
	setAutomationLocked(id: BrowserViewId, locked: boolean): Promise<void>;
	/** Returns whether a tab is currently automation-locked. */
	isAutomationLocked(id: BrowserViewId): boolean;

	/** Returns buffered console messages (requires debugger attached). */
	getConsoleMessages(id: BrowserViewId): IConsoleMessage[];
	/** Returns buffered network requests (requires debugger attached). */
	getNetworkLog(id: BrowserViewId): INetworkRequest[];

	/**
	 * Lightweight health check for a tab. Returns whether the underlying
	 * `webContents` is alive and the debugger can be reached. Used by the
	 * built-in MCP server to surface actionable errors instead of generic
	 * "tool failed" messages.
	 */
	healthCheck(id: BrowserViewId): { alive: boolean; debuggerAttached: boolean; url: string; error?: string };

	/**
	 * Writes a large tool response (e.g. a huge accessibility snapshot or CDP
	 * payload) to a temp file and returns its path + a short summary, so the
	 * MCP tool result stays within model context limits. Returns `null` when
	 * the payload is small enough to inline (under `thresholdBytes`).
	 */
	spillLargeResponse(id: BrowserViewId, payload: string, label: string, thresholdBytes?: number): Promise<{ filePath: string; summary: string } | null>;

	/**
	 * Writes a screenshot (base64) under the automation spill directory using
	 * a sanitized `filename`. Returns the absolute path, or `null` on failure.
	 */
	saveScreenshotFile(id: BrowserViewId, base64Data: string, filename: string, mimeType: string): Promise<string | null>;

	/**
	 * Serializes automation work for a single tab. Concurrent snapshot/click
	 * calls on the same viewId corrupt the shared ref map; callers that may
	 * run in parallel (read-only MCP tools) must go through this queue.
	 */
	runExclusive<T>(id: BrowserViewId, fn: () => Promise<T>): Promise<T>;

	/**
	 * Tears down all automation sessions: unlocks tabs, clears highlights,
	 * detaches CDP debuggers, and clears per-tab state. Called when the
	 * Browser Automation setting is turned off.
	 */
	releaseAllAutomation(): Promise<void>;

	/** Clears all automation state for a tab (refs, lock, buffers). Called on tab close. */
	clearState(id: BrowserViewId): void;
}
