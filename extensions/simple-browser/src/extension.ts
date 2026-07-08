/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Thin launcher for the integrated native browser.
 *
 * The actual browser is implemented in the Orbit workbench as a `WebContentsView`-backed
 * editor pane (see `src/vs/workbench/contrib/browserView/`). This extension only forwards
 * the two public commands (`simpleBrowser.show` and `simpleBrowser.api.open`) and the
 * external-URI-opener registration to the workbench-internal `_browserView.openEditor`
 * command, so existing callers (keybindings, link openers, other extensions) keep working.
 */

const openApiCommand = 'simpleBrowser.api.open';
const showCommand = 'simpleBrowser.show';
const internalOpenCommand = '_browserView.openEditor';

/** Webview panel type used by the old webview-based Simple Browser (now replaced by the native editor). */
const legacyWebviewViewType = 'simpleBrowser.view';
const defaultUrl = 'https://www.google.com/';

const enabledHosts = new Set<string>([
	'localhost',
	'127.0.0.1',
	'[0:0:0:0:0:0:0:1]',
	'[::1]',
	'0.0.0.0',
	'[0:0:0:0:0:0:0:0]',
	'[::]'
]);

const openerId = 'simpleBrowser.open';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand(showCommand, async (url?: string) => {
		const target = url && url.length > 0 ? url : defaultUrl;
		await vscode.commands.executeCommand(internalOpenCommand, target, { pinned: true });
	}));

	context.subscriptions.push(vscode.commands.registerCommand(openApiCommand, async (url: vscode.Uri, showOptions?: {
		preserveFocus?: boolean;
		viewColumn?: vscode.ViewColumn;
	}) => {
		await vscode.commands.executeCommand(internalOpenCommand, url.toString(true), {
			pinned: true,
			preserveFocus: showOptions?.preserveFocus,
			viewColumn: showOptions?.viewColumn,
		});
	}));

	context.subscriptions.push(vscode.window.registerExternalUriOpener(openerId, {
		canOpenExternalUri(uri: vscode.Uri) {
			const originalUri = new URL(uri.toString(true));
			if (enabledHosts.has(originalUri.hostname)) {
				return isWeb()
					? vscode.ExternalUriOpenerPriority.Default
					: vscode.ExternalUriOpenerPriority.Option;
			}
			return vscode.ExternalUriOpenerPriority.None;
		},
		openExternalUri(resolveUri: vscode.Uri) {
			// Open beside the active text editor so the source stays visible, matching the old
			// webview-based Simple Browser's placement.
			return vscode.commands.executeCommand(internalOpenCommand, resolveUri.toString(true), {
				pinned: true,
				viewColumn: vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
			});
		}
	}, {
		schemes: ['http', 'https'],
		label: vscode.l10n.t("Open in simple browser"),
	}));

	// Migration: a workspace saved with the previous webview-based Simple Browser still has
	// `simpleBrowser.view` panels in its editor layout. Without a serializer VS Code shows a
	// broken "cannot be restored" placeholder. Re-open the persisted URL in the native browser
	// editor instead and discard the placeholder panel.
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(legacyWebviewViewType, {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown) {
			const url = (state && typeof (state as { url?: unknown }).url === 'string')
				? (state as { url: string }).url
				: defaultUrl;
			panel.dispose();
			await vscode.commands.executeCommand(internalOpenCommand, url, { pinned: true });
		}
	}));
}

function isWeb(): boolean {
	return typeof navigator !== 'undefined' && vscode.env.uiKind === vscode.UIKind.Web;
}

export function deactivate() { }
