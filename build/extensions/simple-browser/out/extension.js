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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
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
const enabledHosts = new Set([
    'localhost',
    '127.0.0.1',
    '[0:0:0:0:0:0:0:1]',
    '[::1]',
    '0.0.0.0',
    '[0:0:0:0:0:0:0:0]',
    '[::]'
]);
const openerId = 'simpleBrowser.open';
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand(showCommand, async (url) => {
        const target = url && url.length > 0 ? url : defaultUrl;
        await vscode.commands.executeCommand(internalOpenCommand, target, { pinned: true });
    }));
    context.subscriptions.push(vscode.commands.registerCommand(openApiCommand, async (url, showOptions) => {
        await vscode.commands.executeCommand(internalOpenCommand, url.toString(true), {
            pinned: true,
            preserveFocus: showOptions?.preserveFocus,
            viewColumn: showOptions?.viewColumn,
        });
    }));
    context.subscriptions.push(vscode.window.registerExternalUriOpener(openerId, {
        canOpenExternalUri(uri) {
            const originalUri = new URL(uri.toString(true));
            if (enabledHosts.has(originalUri.hostname)) {
                return isWeb()
                    ? vscode.ExternalUriOpenerPriority.Default
                    : vscode.ExternalUriOpenerPriority.Option;
            }
            return vscode.ExternalUriOpenerPriority.None;
        },
        openExternalUri(resolveUri) {
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
        async deserializeWebviewPanel(panel, state) {
            const url = (state && typeof state.url === 'string')
                ? state.url
                : defaultUrl;
            panel.dispose();
            await vscode.commands.executeCommand(internalOpenCommand, url, { pinned: true });
        }
    }));
}
function isWeb() {
    return typeof navigator !== 'undefined' && vscode.env.uiKind === vscode.UIKind.Web;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map