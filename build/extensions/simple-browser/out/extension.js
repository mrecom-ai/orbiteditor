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
const vscode = __importStar(require("vscode"));
const simpleBrowserManager_1 = require("./simpleBrowserManager");
const simpleBrowserView_1 = require("./simpleBrowserView");
const browserAutomationService_1 = require("./automation/browserAutomationService");
const navigationCommands_1 = require("./automation/commands/navigationCommands");
const interactionCommands_1 = require("./automation/commands/interactionCommands");
const captureCommands_1 = require("./automation/commands/captureCommands");
const evaluationCommands_1 = require("./automation/commands/evaluationCommands");
const sessionCommands_1 = require("./automation/commands/sessionCommands");
const cookieCommands_1 = require("./automation/commands/cookieCommands");
const openApiCommand = 'simpleBrowser.api.open';
const showCommand = 'simpleBrowser.show';
const enabledHosts = new Set([
    'localhost',
    // localhost IPv4
    '127.0.0.1',
    // localhost IPv6
    '[0:0:0:0:0:0:0:1]',
    '[::1]',
    // all interfaces IPv4
    '0.0.0.0',
    // all interfaces IPv6
    '[0:0:0:0:0:0:0:0]',
    '[::]'
]);
const openerId = 'simpleBrowser.open';
function activate(context) {
    // Initialize browser automation service first
    const automationService = new browserAutomationService_1.BrowserAutomationService(context);
    context.subscriptions.push(automationService);
    // Create manager with automation service reference
    const manager = new simpleBrowserManager_1.SimpleBrowserManager(context.extensionUri, automationService);
    context.subscriptions.push(manager);
    // Store manager globally for automation commands to access
    global.simpleBrowserManager = manager;
    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(simpleBrowserView_1.SimpleBrowserView.viewType, {
        deserializeWebviewPanel: async (panel, state) => {
            manager.restore(panel, state);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand(showCommand, async (url) => {
        // Use default URL (Google) if no URL is provided
        if (!url) {
            url = 'https://www.google.com/';
        }
        manager.show(url);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(openApiCommand, async (url, showOptions) => {
        manager.show(url, showOptions);
    }));
    context.subscriptions.push(vscode.window.registerExternalUriOpener(openerId, {
        canOpenExternalUri(uri) {
            // We have to replace the IPv6 hosts with IPv4 because URL can't handle IPv6.
            const originalUri = new URL(uri.toString(true));
            if (enabledHosts.has(originalUri.hostname)) {
                return isWeb()
                    ? vscode.ExternalUriOpenerPriority.Default
                    : vscode.ExternalUriOpenerPriority.Option;
            }
            return vscode.ExternalUriOpenerPriority.None;
        },
        openExternalUri(resolveUri) {
            manager.show(resolveUri, {
                viewColumn: vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active
            });
        }
    }, {
        schemes: ['http', 'https'],
        label: vscode.l10n.t("Open in simple browser"),
    }));
    // Register automation commands (automationService already initialized above)
    (0, navigationCommands_1.registerNavigationCommands)(context, automationService);
    (0, interactionCommands_1.registerInteractionCommands)(context, automationService);
    (0, captureCommands_1.registerCaptureCommands)(context, automationService);
    (0, evaluationCommands_1.registerEvaluationCommands)(context, automationService);
    (0, sessionCommands_1.registerSessionCommands)(context, automationService);
    (0, cookieCommands_1.registerCookieCommands)(context, automationService);
}
function isWeb() {
    return typeof navigator !== 'undefined' && vscode.env.uiKind === vscode.UIKind.Web;
}
//# sourceMappingURL=extension.js.map