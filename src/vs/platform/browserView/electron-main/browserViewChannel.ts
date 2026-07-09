/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Copyright (c) Orbit Editor. All rights reserved.
 *  Licensed under the Apache License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import { BrowserViewMainService } from './browserViewMainService.js';
import { BrowserAutomationMainService } from './browserAutomationMainService.js';

/**
 * IPC channel that exposes `BrowserViewMainService` to the renderer process.
 *
 * The renderer-side proxy is created with `context: nativeHostService.windowId`. IMPORTANT:
 * `ProxyChannel.toService` only injects that context for `call` (method invocations) — for
 * `listen` (event subscriptions) it calls `channel.listen(eventName)` with NO context arg
 * (see `propertyIsEvent` branch in `ProxyChannel.toService`). So `ctx` here is `undefined`
 * for every event subscription. We therefore return the UNFILTERED service event; per-window
 * filtering is unnecessary because every renderer consumer already filters by `e.id`, and a
 * single VS Code window only ever owns views it created.
 *
 * Automation commands (attachDebugger, sendCdpCommand, listViews, getNavigationState) are
 * routed to `BrowserAutomationMainService`, which owns the CDP sessions and ref maps. The
 * browser-view service remains the single owner of `WebContentsView` lifetimes.
 */
export class BrowserViewChannel implements IServerChannel {

	constructor(
		private readonly service: BrowserViewMainService,
		private readonly automationService: BrowserAutomationMainService,
	) { }

	listen<T>(_ctx: unknown, event: string, _arg?: any): Event<T> {
		switch (event) {
			case 'onDidNavigate':
				return this.service.onDidNavigate as unknown as Event<T>;
			case 'onDidTitleChange':
				return this.service.onDidTitleChange as unknown as Event<T>;
			case 'onDidFaviconChange':
				return this.service.onDidFaviconChange as unknown as Event<T>;
			case 'onDidLoadingStateChange':
				return this.service.onDidLoadingStateChange as unknown as Event<T>;
			case 'onDidClose':
				return this.service.onDidClose as unknown as Event<T>;
			case 'onDidFocusView':
				return this.service.onDidFocusView as unknown as Event<T>;
			case 'onDidBrowserShortcut':
				return this.service.onDidBrowserShortcut as unknown as Event<T>;
			case 'onDidAutomationLockChange':
				return this.automationService.onDidAutomationLockChange as unknown as Event<T>;
			default:
				throw new Error(`Event not found: ${event}`);
		}
	}

	async call(ctx: unknown, command: string, arg?: any): Promise<any> {
		// ProxyChannel.toService sends `arg = [context, ...methodArgs]` when a context is
		// configured. We normalize both array and single-value shapes.
		const args: any[] = Array.isArray(arg) ? arg : [arg];
		const windowId = this.toWindowId(args[0] ?? ctx);
		// `a(0)` returns the first *method* arg (skipping the context at args[0]).
		const a = (i: number) => args[i + 1];
		switch (command) {
			case 'open': {
				const id = a(0) as string;
				const options = a(1) as any;
				return this.service.open(windowId, id, options);
			}
			case 'close':
				return this.service.close(windowId, a(0));
			case 'navigate':
				return this.service.navigate(windowId, a(0), a(1));
			case 'goBack':
				return this.service.goBack(windowId, a(0));
			case 'goForward':
				return this.service.goForward(windowId, a(0));
			case 'reload':
				return this.service.reload(windowId, a(0));
			case 'stop':
				return this.service.stop(windowId, a(0));
			case 'setZoomFactor':
				return this.service.setZoomFactor(windowId, a(0), a(1));
			case 'getZoomFactor':
				return this.service.getZoomFactor(windowId, a(0));
			case 'findInPage':
				return this.service.findInPage(windowId, a(0), a(1), a(2));
			case 'stopFindInPage':
				return this.service.stopFindInPage(windowId, a(0));
			case 'setBounds':
				return this.service.setBounds(windowId, a(0), a(1));
			case 'setVisible':
				return this.service.setVisible(windowId, a(0), a(1));
			case 'focus':
				return this.service.focus(windowId, a(0));
			case 'blur':
				return this.service.blur(windowId, a(0));
			case 'setIgnoreMenuShortcuts':
				return this.service.setIgnoreMenuShortcuts(windowId, a(0), a(1));
			case 'bringToFront':
				return this.service.bringToFront(windowId, a(0));
			case 'executeJavaScript':
				return this.service.executeJavaScript(windowId, a(0), a(1));
			case 'screenshot':
				return this.service.screenshot(windowId, a(0));
			case 'runPicker':
				return this.service.runPicker(windowId, a(0));
			case 'teardownPicker':
				return this.service.teardownPicker(windowId, a(0));
			// --- Automation passthroughs (windowId is irrelevant; these are global) ---
			case 'listViews':
				return this.automationService.listViews();
			case 'getNavigationState':
				return this.automationService.getNavigationState(a(0));
			case 'attachDebugger':
				return this.automationService.attachDebugger(a(0));
			case 'detachDebugger':
				return this.automationService.detachDebugger(a(0));
			case 'sendCdpCommand':
				return this.automationService.sendCdpCommand(a(0), a(1), a(2));
			case 'setAutomationLocked':
				return this.automationService.setAutomationLocked(a(0), a(1) === true);
			case 'isAutomationLocked':
				return this.automationService.isAutomationLocked(a(0));
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}

	private toWindowId(ctx: unknown): number {
		if (typeof ctx === 'number') {
			return ctx;
		}
		if (ctx && typeof (ctx as any).windowId === 'number') {
			return (ctx as any).windowId;
		}
		throw new Error('BrowserViewChannel requires a numeric windowId context');
	}

	dispose(): void {
		// Services own their own disposables; nothing to do here.
	}
}
