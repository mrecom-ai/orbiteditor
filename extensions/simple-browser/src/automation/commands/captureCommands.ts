/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { ScreenshotOptions, PDFOptions } from '../automationTypes';

export function registerCaptureCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	// Take screenshot
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.screenshot',
			async (sessionId?: string, options?: ScreenshotOptions) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.screenshot(sessionId, options);
			}
		)
	);

	// Generate PDF
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.pdf',
			async (sessionId?: string, options?: PDFOptions) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.pdf(sessionId, options);
			}
		)
	);

	// Get page HTML content
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.getContent',
			async (sessionId?: string) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.getContent(sessionId);
			}
		)
	);

	// Get page title
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.getTitle',
			async (sessionId?: string) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.getTitle(sessionId);
			}
		)
	);

	// Extract text from element
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.extractText',
			async (sessionId?: string, selector?: string) => {
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
			}
		)
	);

	// Extract HTML from element
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.extractHTML',
			async (sessionId?: string, selector?: string) => {
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
			}
		)
	);

	// Get accessibility snapshot
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.snapshot',
			async (sessionId?: string, options?: { interestingOnly?: boolean }) => {
				if (!sessionId) {
					sessionId = automationService.getActiveSessionId();
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}
				}
				return automationService.snapshot(sessionId, options);
			}
		)
	);
}
