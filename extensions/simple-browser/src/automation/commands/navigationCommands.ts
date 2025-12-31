/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { NavigationOptions } from '../automationTypes';

export function registerNavigationCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	// Navigate to URL
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.navigate',
			async (sessionId?: string, url?: string, options?: NavigationOptions) => {
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
				const result = await automationService.navigate(sessionId!, url!, options);
				return result;
			}
		)
	);

	// Go back in history
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.back',
			async (sessionId?: string) => {
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
			}
		)
	);

	// Go forward in history
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.forward',
			async (sessionId?: string) => {
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
			}
		)
	);

	// Reload current page
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.reload',
			async (sessionId?: string) => {
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
			}
		)
	);

	// Get current URL
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.getUrl',
			async (sessionId?: string) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.getUrl(sessionId);
			}
		)
	);
}
