/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Orbit Editor. All rights reserved.
 *  Licensed under the Apache License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ipcRenderer } from '../../../../base/parts/sandbox/electron-sandbox/globals.js';
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { BROWSER_AUTOMATION_IPC_CHANNELS, IBrowserViewService, resolveBrowserNavigationTarget } from '../../../../platform/browserView/common/browserView.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { BrowserEditorInput, IBrowserEditorInputData } from './browserEditorInput.js';

export interface IBrowserTabInfo {
	readonly id: string;
	readonly url: string;
	readonly title: string;
	readonly isLoading: boolean;
}

export interface IBrowserTabRegistryService {
	readonly _serviceBrand: undefined;
	readonly onDidTabsChange: Event<void>;
	/** Returns metadata for every open browser tab. */
	listTabs(): Promise<IBrowserTabInfo[]>;
	/** Opens a URL in a new tab or navigates an existing tab to it. Returns the tab id. */
	openOrNavigateTab(url: string, opts?: { newTab?: boolean; position?: 'active' | 'side'; background?: boolean }): Promise<string>;
	/** Selects (focuses) a tab by id. */
	selectTab(id: string): Promise<void>;
	/** Closes a tab by id. */
	closeTab(id: string): Promise<void>;
	/** Returns the id of the most recently interacted-with tab, or undefined. */
	getActiveTabId(): string | undefined;
}

export const IBrowserTabRegistryService = createDecorator<IBrowserTabRegistryService>('browserTabRegistryService');

/**
 * Renderer-side registry of open browser tabs. The built-in `orbit-ide-browser`
 * MCP server (in the main process) talks to the native views directly via
 * `BrowserAutomationMainService.listViews()`; this service exists to handle
 * the renderer-side lifecycle: opening tabs into the right editor group,
 * tracking the "last interacted" tab, and closing tabs through the editor
 * service.
 *
 * The agent never calls this directly — it goes through the MCP server, which
 * calls the main-process automation service. The main-process service, when it
 * needs to open a *visible* tab (position: active|side), dispatches a command
 * back to the renderer that lands here.
 */
class BrowserTabRegistryService extends Disposable implements IBrowserTabRegistryService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidTabsChange = this._register(new Emitter<void>());
	readonly onDidTabsChange: Event<void> = this._onDidTabsChange.event;

	/** Id of the tab the agent (or user) most recently interacted with. */
	private _activeTabId: string | undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IBrowserViewService private readonly browserViewService: IBrowserViewService,
	) {
		super();
		// Track which tab is "active" based on editor focus. The active browser
		// editor pane becomes the active tab for agent operations.
		this._register(editorService.onDidActiveEditorChange(() => {
			const input = editorService.activeEditor;
			if (input instanceof BrowserEditorInput) {
				if (this._activeTabId !== input.id) {
					this._activeTabId = input.id;
					this._onDidTabsChange.fire();
				}
			}
		}));
		// Remove closed tabs from the active pointer.
		this._register(editorService.onDidCloseEditor(({ editor }) => {
			if (editor instanceof BrowserEditorInput && this._activeTabId === editor.id) {
				this._activeTabId = undefined;
				this._onDidTabsChange.fire();
			}
		}));

		// Listen for tab-orchestration messages dispatched by the built-in
		// `orbit-ide-browser` MCP server (main process). The server calls
		// `win.sendWhenReady('orbit:browserAutomation:*', ...)`; we handle them
		// here and reply on the requested channel so the server can resolve the
		// open-tab promise with the new BrowserEditorInput id.
		const openTabHandler = (_e: unknown, payload: { url: string; position?: 'active' | 'side'; background?: boolean; replyChannel: string }) => {
			this.openOrNavigateTab(payload.url, {
				newTab: true,
				position: payload.position,
				background: payload.background === true || !payload.position,
			})
				.then(id => ipcRenderer.send(payload.replyChannel, id))
				.catch(() => ipcRenderer.send(payload.replyChannel, ''));
		};
		const selectTabHandler = (_e: unknown, payload: { id: string; replyChannel?: string }) => {
			this.selectTab(payload.id)
				.then(() => {
					if (payload.replyChannel) {
						ipcRenderer.send(payload.replyChannel, true);
					}
				})
				.catch(() => {
					if (payload.replyChannel) {
						ipcRenderer.send(payload.replyChannel, false);
					}
				});
		};
		const closeTabHandler = (_e: unknown, payload: { id: string; replyChannel?: string }) => {
			this.closeTab(payload.id)
				.then(() => {
					if (payload.replyChannel) {
						ipcRenderer.send(payload.replyChannel, true);
					}
				})
				.catch(() => {
					if (payload.replyChannel) {
						ipcRenderer.send(payload.replyChannel, false);
					}
				});
		};
		ipcRenderer.on(BROWSER_AUTOMATION_IPC_CHANNELS.openTab, openTabHandler);
		ipcRenderer.on(BROWSER_AUTOMATION_IPC_CHANNELS.selectTab, selectTabHandler);
		ipcRenderer.on(BROWSER_AUTOMATION_IPC_CHANNELS.closeTab, closeTabHandler);
		this._register({
			dispose: () => {
				ipcRenderer.removeListener(BROWSER_AUTOMATION_IPC_CHANNELS.openTab, openTabHandler);
				ipcRenderer.removeListener(BROWSER_AUTOMATION_IPC_CHANNELS.selectTab, selectTabHandler);
				ipcRenderer.removeListener(BROWSER_AUTOMATION_IPC_CHANNELS.closeTab, closeTabHandler);
			},
		});
	}

	async listTabs(): Promise<IBrowserTabInfo[]> {
		// Prefer main-process views (have live URL/title). Also include any
		// BrowserEditorInput that has not been preloaded yet so the agent sees
		// every tab in the editor model.
		const views = await this.browserViewService.listViews();
		const byId = new Map(views.map(v => [v.id, {
			id: v.id,
			url: v.url,
			title: v.title,
			isLoading: v.isLoading,
		} satisfies IBrowserTabInfo]));
		for (const editor of this.editorService.editors) {
			if (!(editor instanceof BrowserEditorInput) || byId.has(editor.id)) {
				continue;
			}
			byId.set(editor.id, {
				id: editor.id,
				url: editor.url,
				title: editor.getTitle(),
				isLoading: false,
			});
		}
		return Array.from(byId.values());
	}

	async openOrNavigateTab(url: string, opts: { newTab?: boolean; position?: 'active' | 'side'; background?: boolean } = {}): Promise<string> {
		const resolvedUrl = resolveBrowserNavigationTarget(url);
		const existingTabs = await this.listTabs();

		// Reuse an existing tab on the same URL unless newTab was requested.
		if (!opts.newTab) {
			const match = existingTabs.find(t => t.url === resolvedUrl);
			if (match) {
				if (!opts.background) {
					await this.selectTab(match.id);
				}
				this._activeTabId = match.id;
				this._onDidTabsChange.fire();
				return match.id;
			}
		}

		// Open a new browser editor tab. `position: side` opens beside the
		// active editor; `active` opens in the active group and reveals the
		// browser. Omitting `position` (background automation) opens with
		// preserveFocus so the user's current editor keeps keyboard focus.
		// Do NOT set `inactive: true` — that skips loading the pane, so the
		// native WebContentsView never opens and automation has nothing to drive.
		const data: IBrowserEditorInputData = { url: resolvedUrl };
		const input = new BrowserEditorInput(data);
		const group = opts.position === 'side' ? SIDE_GROUP : ACTIVE_GROUP;
		const background = opts.background === true || !opts.position;
		await this.editorService.openEditor(input, {
			pinned: true,
			preserveFocus: background,
		}, group);
		this._activeTabId = input.id;
		this._onDidTabsChange.fire();
		return input.id;
	}

	async selectTab(id: string): Promise<void> {
		// Find the editor input with this id and reveal it.
		for (const group of this.editorGroupsService.groups) {
			for (const editor of group.editors) {
				if (editor instanceof BrowserEditorInput && editor.id === id) {
					await this.editorService.openEditor(editor, { pinned: true }, group.id);
					this._activeTabId = id;
					this._onDidTabsChange.fire();
					return;
				}
			}
		}
		throw new Error(`Browser tab not found: ${id}`);
	}

	async closeTab(id: string): Promise<void> {
		for (const group of this.editorGroupsService.groups) {
			for (const editor of group.editors) {
				if (editor instanceof BrowserEditorInput && editor.id === id) {
					await group.closeEditor(editor);
					if (this._activeTabId === id) {
						this._activeTabId = undefined;
					}
					this._onDidTabsChange.fire();
					return;
				}
			}
		}
		throw new Error(`Browser tab not found: ${id}`);
	}

	getActiveTabId(): string | undefined {
		return this._activeTabId;
	}
}

registerSingleton(IBrowserTabRegistryService, BrowserTabRegistryService, InstantiationType.Delayed);

/**
 * Renderer-side commands the main-process MCP server dispatches (via
 * `mainProcessElectronServer` → renderer) when an agent asks to open/select/
 * close a tab visibly. Background navigation (no `position` param) is handled
 * entirely in the main process via `BrowserViewMainService.navigate`.
 */
CommandsRegistry.registerCommand('orbit.browserAutomation.openTab', function (accessor: ServicesAccessor, url: string, opts?: { newTab?: boolean; position?: 'active' | 'side'; background?: boolean }) {
	return accessor.get(IBrowserTabRegistryService).openOrNavigateTab(url, opts);
});
CommandsRegistry.registerCommand('orbit.browserAutomation.selectTab', function (accessor: ServicesAccessor, id: string) {
	return accessor.get(IBrowserTabRegistryService).selectTab(id);
});
CommandsRegistry.registerCommand('orbit.browserAutomation.closeTab', function (accessor: ServicesAccessor, id: string) {
	return accessor.get(IBrowserTabRegistryService).closeTab(id);
});
CommandsRegistry.registerCommand('orbit.browserAutomation.getActiveTabId', function (accessor: ServicesAccessor) {
	return accessor.get(IBrowserTabRegistryService).getActiveTabId();
});
