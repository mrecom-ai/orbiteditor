/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { Cookie } from '../automationTypes';

export function registerCookieCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	// Get cookies
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.getCookies',
			async (sessionId?: string, urls?: string[]) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.getCookies(sessionId, urls);
			}
		)
	);

	// Set cookies
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.setCookies',
			async (sessionId?: string, cookies?: Cookie[]) => {
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
			}
		)
	);

	// Clear cookies
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.clearCookies',
			async (sessionId?: string) => {
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
			}
		)
	);
}
