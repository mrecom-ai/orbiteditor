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
exports.registerCookieCommands = registerCookieCommands;
const vscode = __importStar(require("vscode"));
function registerCookieCommands(context, automationService) {
    // Get cookies
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.getCookies', async (sessionId, urls) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        return automationService.getCookies(sessionId, urls);
    }));
    // Set cookies
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.setCookies', async (sessionId, cookies) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        if (!cookies) {
            return { success: false, error: 'No cookies provided' };
        }
        return automationService.setCookies(sessionId, cookies);
    }));
    // Clear cookies
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.clearCookies', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        const result = await automationService.clearCookies(sessionId);
        if (result.success) {
        }
        return result;
    }));
}
//# sourceMappingURL=cookieCommands.js.map