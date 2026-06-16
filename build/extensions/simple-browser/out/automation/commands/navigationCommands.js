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
exports.registerNavigationCommands = registerNavigationCommands;
const vscode = __importStar(require("vscode"));
function registerNavigationCommands(context, automationService) {
    // Navigate to URL
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.navigate', async (sessionId, url, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                // Auto-create session if none exists
                sessionId = await automationService.ensureActiveSession();
                if (!sessionId) {
                    return { success: false, error: 'No active session' };
                }
            }
        }
        if (!url) {
            url = await vscode.window.showInputBox({
                prompt: 'Enter URL to navigate to',
                placeHolder: 'https://example.com'
            });
            if (!url) {
                return { success: false, error: 'No URL provided' };
            }
        }
        // Disabled progress notification for production - execute silently
        const result = await automationService.navigate(sessionId, url, options);
        return result;
    }));
    // Go back in history
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.back', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (!sessionId) {
                    return { success: false, error: 'No active session' };
                }
            }
        }
        const result = await automationService.goBack(sessionId);
        return result;
    }));
    // Go forward in history
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.forward', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (!sessionId) {
                    return { success: false, error: 'No active session' };
                }
            }
        }
        const result = await automationService.goForward(sessionId);
        return result;
    }));
    // Reload current page
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.reload', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                sessionId = await automationService.ensureActiveSession();
                if (!sessionId) {
                    return { success: false, error: 'No active session' };
                }
            }
        }
        const result = await automationService.reload(sessionId);
        return result;
    }));
    // Get current URL
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.getUrl', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.getUrl(sessionId);
    }));
}
//# sourceMappingURL=navigationCommands.js.map