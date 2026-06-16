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
exports.registerInteractionCommands = registerInteractionCommands;
const vscode = __importStar(require("vscode"));
function registerInteractionCommands(context, automationService) {
    // Click element
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.click', async (sessionId, selector, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to click',
                placeHolder: 'button#submit'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        return automationService.click(sessionId, selector, options);
    }));
    // Type text into element
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.type', async (sessionId, selector, text, options) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to type into',
                placeHolder: 'input#username'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        if (!text) {
            text = await vscode.window.showInputBox({
                prompt: 'Enter text to type',
                placeHolder: 'Text to type'
            });
            if (!text) {
                return { success: false, error: 'No text provided' };
            }
        }
        return automationService.type(sessionId, selector, text, options);
    }));
    // Fill form field
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.fill', async (sessionId, selector, value) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to fill',
                placeHolder: 'input#email'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        if (!value) {
            value = await vscode.window.showInputBox({
                prompt: 'Enter value to fill',
                placeHolder: 'Value'
            });
            if (!value) {
                return { success: false, error: 'No value provided' };
            }
        }
        return automationService.fill(sessionId, selector, value);
    }));
    // Press keyboard key
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.press', async (sessionId, key) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!key) {
            key = await vscode.window.showInputBox({
                prompt: 'Enter key to press',
                placeHolder: 'Enter, Tab, Escape, etc.'
            });
            if (!key) {
                return { success: false, error: 'No key provided' };
            }
        }
        return automationService.press(sessionId, key);
    }));
    // Hover over element
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.hover', async (sessionId, selector) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to hover',
                placeHolder: '.menu-item'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        return automationService.hover(sessionId, selector);
    }));
    // Select dropdown option
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.select', async (sessionId, selector, value) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector of the select element',
                placeHolder: 'select#country'
            });
            if (!selector) {
                return { success: false, error: 'No selector provided' };
            }
        }
        if (!value) {
            value = await vscode.window.showInputBox({
                prompt: 'Enter option value to select',
                placeHolder: 'us'
            });
            if (!value) {
                return { success: false, error: 'No value provided' };
            }
        }
        return automationService.select(sessionId, selector, value);
    }));
}
//# sourceMappingURL=interactionCommands.js.map