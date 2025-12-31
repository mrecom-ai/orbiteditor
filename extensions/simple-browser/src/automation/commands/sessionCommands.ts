/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { SessionOptions } from '../automationTypes';

export function registerSessionCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	// Create new session
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.createSession',
			async (url?: string, options?: SessionOptions) => {
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
			}
		)
	);

	// Close session
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.closeSession',
			async (sessionId?: string) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				const result = await automationService.closeSession(sessionId);
				return result;
			}
		)
	);

	// List sessions
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.listSessions',
			async () => {
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
			}
		)
	);

	// Switch session
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.switchSession',
			async (sessionId?: string) => {
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
				} else {
					return { success: false, error: 'Session not found' };
				}
			}
		)
	);

	// Get stats
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.getStats',
			async () => {
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
			}
		)
	);
}
