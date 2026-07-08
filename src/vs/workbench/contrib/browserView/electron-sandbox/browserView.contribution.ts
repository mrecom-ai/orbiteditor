/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { BrowserEditorInput, IBrowserEditorInputData } from './browserEditorInput.js';
import { BrowserEditorInputSerializer } from './browserEditorInputSerializer.js';
import { BrowserEditorPane, BrowserEditorActiveContext } from './browserEditorPane.js';
import { BrowserViewOverlayManager } from './overlayManager.js';
import { resolveBrowserNavigationTarget } from '../../../../platform/browserView/common/browserView.js';

// Register the editor pane with the VS Code editor registry.
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			BrowserEditorPane,
			BrowserEditorPane.ID,
			localize('browser.editor.label', "Browser")
		),
		[new SyncDescriptor(BrowserEditorInput)]
	);

// Register the editor serializer so browser tabs can be persisted/restored across sessions.
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(BrowserEditorInputSerializer.ID, BrowserEditorInputSerializer);

// Overlay manager hides the native WebContentsView when a context menu is shown so the menu
// isn't covered by the always-on-top native view.
registerWorkbenchContribution2(
	BrowserViewOverlayManager.ID,
	BrowserViewOverlayManager,
	WorkbenchPhase.AfterRestored
);

/**
 * Internal command that opens a URL in the integrated native browser. External callers
 * (e.g. the trimmed `simple-browser` extension) invoke this as `_browserView.openEditor`.
 *
 * Usage: `executeCommand('_browserView.openEditor', url: string, options?: { title?: string; homeUrl?: string; preview?: boolean; pinned?: boolean; preserveFocus?: boolean; viewColumn?: number })`
 *
 * `viewColumn` accepts the extension-host `vscode.ViewColumn` values: `Beside` (-2) opens in a
 * new group to the side (so a Ctrl-clicked link keeps the source file visible), anything else
 * opens in the active group.
 */
CommandsRegistry.registerCommand('_browserView.openEditor', function (accessor: ServicesAccessor, url: string | URI, options?: { title?: string; homeUrl?: string; preview?: boolean; pinned?: boolean; preserveFocus?: boolean; viewColumn?: number }) {
	const editorService = accessor.get(IEditorService);

	const normalizedUrl = typeof url === 'string' ? url : url.toString(true);
	if (!normalizedUrl) {
		throw new Error('_browserView.openEditor: a url is required');
	}

	const resolvedUrl = resolveBrowserNavigationTarget(normalizedUrl);

	const data: IBrowserEditorInputData = {
		url: resolvedUrl,
		title: options?.title,
		homeUrl: options?.homeUrl ? resolveBrowserNavigationTarget(options.homeUrl) : resolvedUrl,
	};
	const input = new BrowserEditorInput(data);

	// vscode.ViewColumn.Beside === -2. Map it to a side group; everything else (Active/undefined)
	// falls back to the active group.
	const group = options?.viewColumn === -2 ? SIDE_GROUP : ACTIVE_GROUP;

	return editorService.openEditor(input, {
		pinned: options?.pinned ?? true,
		inactive: options?.preview ?? false,
		preserveFocus: options?.preserveFocus,
	}, group);
});

/**
 * Returns the active `BrowserEditorPane` if one is focused, or `undefined`. Used by the
 * browser-scoped commands below so they no-op when no browser tab is active.
 */
function activeBrowserPane(accessor: ServicesAccessor): BrowserEditorPane | undefined {
	const editorService = accessor.get(IEditorService);
	const pane = editorService.activeEditorPane;
	return pane instanceof BrowserEditorPane ? pane : undefined;
}

CommandsRegistry.registerCommand('_browserView.findInPage', accessor => {
	activeBrowserPane(accessor)?.openFind();
});

CommandsRegistry.registerCommand('_browserView.closeFindInPage', accessor => {
	activeBrowserPane(accessor)?.closeFind();
});

CommandsRegistry.registerCommand('_browserView.zoomIn', accessor => {
	activeBrowserPane(accessor)?.zoomBy(0.1);
});

CommandsRegistry.registerCommand('_browserView.zoomOut', accessor => {
	activeBrowserPane(accessor)?.zoomBy(-0.1);
});

CommandsRegistry.registerCommand('_browserView.zoomReset', accessor => {
	activeBrowserPane(accessor)?.setZoom(1);
});

CommandsRegistry.registerCommand('_browserView.goBack', accessor => {
	activeBrowserPane(accessor)?.goBack();
});

CommandsRegistry.registerCommand('_browserView.goForward', accessor => {
	activeBrowserPane(accessor)?.goForward();
});

CommandsRegistry.registerCommand('_browserView.reload', accessor => {
	activeBrowserPane(accessor)?.toggleReloadOrStop();
});

CommandsRegistry.registerCommand('_browserView.focusAddressBar', accessor => {
	activeBrowserPane(accessor)?.focusAddressBar();
});

/**
 * Browser-scoped keybindings. These only fire when a browser editor pane is the active pane and
 * its page has focus (`browserEditorActive`), so they never clash with the workbench's global
 * bindings (e.g. Cmd+F opens the workbench Find widget in a code editor, but find-in-page in a
 * browser tab). The weight sits above the default workbench bindings so the browser wins when
 * both are active; the `when` clause keeps them inert everywhere else.
 */
const browserActive = ContextKeyExpr.equals(BrowserEditorActiveContext.key, true);
const browserWeight = KeybindingWeight.WorkbenchContrib + 1;

KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.findInPage',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.KeyF,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.closeFindInPage',
	weight: browserWeight,
	when: ContextKeyExpr.and(browserActive),
	primary: KeyCode.Escape,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.zoomIn',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.Equal,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.zoomOut',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.Minus,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.zoomReset',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.Digit0,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.reload',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.KeyR,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.focusAddressBar',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.CtrlCmd | KeyCode.KeyL,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.goBack',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.Alt | KeyCode.LeftArrow,
});
KeybindingsRegistry.registerKeybindingRule({
	id: '_browserView.goForward',
	weight: browserWeight,
	when: browserActive,
	primary: KeyMod.Alt | KeyCode.RightArrow,
});
