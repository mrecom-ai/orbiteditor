/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { ClickOptions, TypeOptions } from '../automationTypes';

export function registerInteractionCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	// Click element
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.click',
			async (sessionId?: string, selector?: string, options?: ClickOptions) => {
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
			}
		)
	);

	// Type text into element
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.type',
			async (sessionId?: string, selector?: string, text?: string, options?: TypeOptions) => {
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
			}
		)
	);

	// Fill form field
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.fill',
			async (sessionId?: string, selector?: string, value?: string) => {
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
			}
		)
	);

	// Press keyboard key
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.press',
			async (sessionId?: string, key?: string) => {
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
			}
		)
	);

	// Hover over element
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.hover',
			async (sessionId?: string, selector?: string) => {
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
			}
		)
	);

	// Select dropdown option
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.select',
			async (sessionId?: string, selector?: string, value?: string) => {
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
			}
		)
	);
}
