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
exports.registerSessionCommands = registerSessionCommands;
const vscode = __importStar(require("vscode"));
function registerSessionCommands(context, automationService) {
    // Create new session
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.createSession', async (url, options) => {
        if (!url) {
            url = await vscode.window.showInputBox({
                prompt: 'Enter URL for new session',
                placeHolder: 'https://example.com',
                value: 'https://www.google.com'
            });
            if (!url) {
                return { success: false, error: 'No URL provided' };
            }
        }
        const result = await automationService.createSession(url, options);
        return result;
    }));
    // Close session
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.closeSession', async (sessionId) => {
        if (!sessionId) {
            sessionId = automationService.getActiveSessionId();
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
        }
        const result = await automationService.closeSession(sessionId);
        return result;
    }));
    // List sessions
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.listSessions', async () => {
        const sessions = automationService.listSessions();
        if (sessions.length === 0) {
            return { success: true, data: [] };
        }
        const items = sessions.map(session => ({
            label: session.id,
            description: session.url,
            detail: `Created: ${new Date(session.createdAt).toLocaleString()}`
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a session to switch to'
        });
        if (selected) {
            automationService.setActiveSession(selected.label);
        }
        return { success: true, data: sessions };
    }));
    // Switch session
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.switchSession', async (sessionId) => {
        if (!sessionId) {
            const sessions = automationService.listSessions();
            if (sessions.length === 0) {
                return { success: false, error: 'No sessions available' };
            }
            const items = sessions.map(session => ({
                label: session.id,
                description: session.url,
                detail: `Created: ${new Date(session.createdAt).toLocaleString()}`
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a session to switch to'
            });
            if (!selected) {
                return { success: false, error: 'No session selected' };
            }
            sessionId = selected.label;
        }
        const success = automationService.setActiveSession(sessionId);
        if (success) {
            return { success: true };
        }
        else {
            return { success: false, error: 'Session not found' };
        }
    }));
    // Get stats
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.getStats', async () => {
        const stats = automationService.getStats();
        // Disabled dialog for production - stats returned silently
        // const message = `
        // Automation Statistics:
        // ━━━━━━━━━━━━━━━━━━━━
        // Total Commands: ${stats.totalCommands}
        // ✓ Successful: ${stats.successfulCommands}
        // ✗ Failed: ${stats.failedCommands}
        // Success Rate: ${stats.totalCommands > 0 ? ((stats.successfulCommands / stats.totalCommands) * 100).toFixed(1) : 0}%
        //
        // Sessions:
        // • Created: ${stats.sessions.created}
        // • Closed: ${stats.sessions.closed}
        // • Active: ${stats.sessions.active}
        // ${stats.lastCommandTime ? '\nLast Command: ' + new Date(stats.lastCommandTime).toLocaleString() : ''}
        // `.trim();
        //
        // await vscode.window.showInformationMessage(
        // 	'Automation Statistics',
        // 	{ modal: true, detail: message },
        // 	'OK'
        // );
        return { success: true, data: stats };
    }));
}
//# sourceMappingURL=sessionCommands.js.map