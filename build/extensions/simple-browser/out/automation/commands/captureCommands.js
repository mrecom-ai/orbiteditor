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
exports.registerCaptureCommands = registerCaptureCommands;
const vscode = __importStar(require("vscode"));
function registerCaptureCommands(context, automationService) {
    // Take screenshot
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.screenshot', async (sessionId, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.screenshot(sessionId, options);
    }));
    // Generate PDF
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.pdf', async (sessionId, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.pdf(sessionId, options);
    }));
    // Get page HTML content
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.getContent', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.getContent(sessionId);
    }));
    // Get page title
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.getTitle', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.getTitle(sessionId);
    }));
    // Extract text from element
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.extractText', async (sessionId, selector) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to extract text from',
                placeHolder: '.content'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        return automationService.extractText(sessionId, selector);
    }));
    // Extract HTML from element
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.extractHTML', async (sessionId, selector) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to extract HTML from',
                placeHolder: '.article'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        return automationService.extractHTML(sessionId, selector);
    }));
    // Get accessibility snapshot
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.snapshot', async (sessionId, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.snapshot(sessionId, options);
    }));
}
//# sourceMappingURL=captureCommands.js.map