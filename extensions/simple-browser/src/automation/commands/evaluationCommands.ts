/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BrowserAutomationService } from '../browserAutomationService';
import { WaitForSelectorOptions, NavigationOptions, EvaluationOptions } from '../automationTypes';
import {
	validateScript,
	validateSelector,
	validateTimeout,
	displayResult,
	displayError,
	displayWarnings,
	COMMON_SNIPPETS,
	DEFAULT_EVAL_TIMEOUT
} from './evaluationHelpers';

/**
 * Output channel for evaluation results
 */
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Get or create output channel for evaluation results
 */
function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Browser Automation');
	}
	return outputChannel;
}

/**
 * Ensures a session exists, creating one if necessary
 * Returns the session ID or undefined if creation failed
 */
async function ensureSession(
	automationService: BrowserAutomationService,
	providedSessionId?: string
): Promise<string | undefined> {
	if (providedSessionId) {
		return providedSessionId;
	}

	// Try to get active session first
	let sessionId = automationService.getActiveSessionId();
	if (sessionId) {
		return sessionId;
	}

	// No active session, try to create one
	sessionId = await automationService.ensureActiveSession();
	if (!sessionId) {
		displayError('Failed to create browser session. Please ensure the browser is accessible.');
		return undefined;
	}

	return sessionId;
}

/**
 * Register evaluation commands for browser automation
 */
export function registerEvaluationCommands(
	context: vscode.ExtensionContext,
	automationService: BrowserAutomationService
) {
	/**
	 * Evaluate JavaScript in browser context
	 *
	 * This command allows executing custom JavaScript in the page context.
	 * It includes safety checks, timeout handling, and result formatting.
	 */
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.evaluate',
			async (sessionId?: string, script?: string, options?: EvaluationOptions) => {
				try {
					// Ensure we have a valid session
					sessionId = await ensureSession(automationService, sessionId);
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}

					// Get script input if not provided
					if (!script) {
						// Offer common snippets first
						const quickPick = await vscode.window.showQuickPick(
							[
								{ label: 'Custom Script', description: 'Enter your own JavaScript' },
								...COMMON_SNIPPETS.map(snippet => ({
									label: snippet.label,
									description: snippet.script.substring(0, 60) + (snippet.script.length > 60 ? '...' : '')
								}))
							],
							{
								placeHolder: 'Select a common script or enter custom JavaScript',
								title: 'JavaScript Evaluation'
							}
						);

						if (!quickPick) {
							return { success: false, error: 'No script selected' };
						}

						if (quickPick.label === 'Custom Script') {
							// Prompt for custom script
							script = await vscode.window.showInputBox({
								prompt: 'Enter JavaScript to evaluate',
								placeHolder: 'document.title',
								title: 'JavaScript Evaluation'
							});
						} else {
							// Use selected snippet
							const snippet = COMMON_SNIPPETS.find(s => s.label === quickPick.label);
							script = snippet?.script;
						}

						if (!script) {
							return { success: false, error: 'No script provided' };
						}
					}

					// Validate script
					const safeMode = options?.safeMode !== false; // Default to true
					const validation = validateScript(script, safeMode);

					if (!validation.isValid) {
						displayError(validation.error || 'Invalid script', 'Script Validation');
						return { success: false, error: validation.error };
					}

					// Show warnings if any
					if (validation.warnings && validation.warnings.length > 0) {
						const shouldContinue = await displayWarnings(validation.warnings);
						if (!shouldContinue) {
							return { success: false, error: 'Operation cancelled by user' };
						}
					}

					// Execute evaluation with timeout
					const timeout = options?.timeout || DEFAULT_EVAL_TIMEOUT;
					const timeoutValidation = validateTimeout(timeout);
					if (!timeoutValidation.isValid) {
						displayError(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
						return { success: false, error: timeoutValidation.error };
					}

					// Execute the script
					const result = await automationService.evaluate(sessionId, script, { timeout });

					if (!result.success) {
						displayError(result.error || 'Script execution failed', 'Evaluation Error');
						return result;
					}

					// Display result if requested (default true for interactive use)
					const showResult = options?.showResult !== false;
					if (showResult) {
						await displayResult(result.data, getOutputChannel());
					}

					return result;

				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
					displayError(errorMsg, 'Evaluation Exception');
					return {
						success: false,
						error: errorMsg
					};
				}
			}
		)
	);

	/**
	 * Wait for a CSS selector to appear in the DOM
	 *
	 * This command waits for an element matching the selector to be present.
	 * Includes selector validation and configurable timeout.
	 */
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.waitForSelector',
			async (sessionId?: string, selector?: string, options?: WaitForSelectorOptions) => {
				try {
					// Ensure we have a valid session
					sessionId = await ensureSession(automationService, sessionId);
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}

					// Get selector input if not provided
					if (!selector) {
						selector = await vscode.window.showInputBox({
							prompt: 'Enter CSS selector to wait for',
							placeHolder: '.results',
							title: 'Wait for Element'
						});

						if (!selector) {
							return { success: false, error: 'No selector provided' };
						}

						// Prompt for timeout if interactive
						if (!options) {
							const timeoutInput = await vscode.window.showInputBox({
								prompt: 'Enter timeout in milliseconds (optional)',
								placeHolder: '30000 (30 seconds)',
								validateInput: (value) => {
									if (value && value.trim() !== '') {
										const num = parseInt(value, 10);
										if (isNaN(num) || num < 0) {
											return 'Please enter a valid positive number';
										}
									}
									return undefined;
								}
							});

							if (timeoutInput && timeoutInput.trim() !== '') {
								options = { timeout: parseInt(timeoutInput, 10) };
							}
						}
					}

					// Validate selector
					const validation = validateSelector(selector);
					if (!validation.isValid) {
						displayError(validation.error || 'Invalid selector', 'Selector Validation');
						return { success: false, error: validation.error };
					}

					// Validate timeout if provided
					if (options?.timeout) {
						const timeoutValidation = validateTimeout(options.timeout);
						if (!timeoutValidation.isValid) {
							displayError(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
							return { success: false, error: timeoutValidation.error };
						}
					}

					// Execute wait for selector
					const result = await automationService.waitForSelector(sessionId, selector, options);

					if (!result.success) {
						displayError(result.error || 'Element not found', 'Wait for Selector');
						return result;
					}

					// Show success notification
					vscode.window.showInformationMessage(`Element found: ${selector}`);
					return result;

				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
					displayError(errorMsg, 'Wait for Selector Exception');
					return {
						success: false,
						error: errorMsg
					};
				}
			}
		)
	);

	/**
	 * Wait for page navigation to complete
	 *
	 * This command waits for the page to finish loading/navigating.
	 * Useful after actions that trigger navigation.
	 */
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'simpleBrowser.automation.waitForNavigation',
			async (sessionId?: string, options?: NavigationOptions) => {
				try {
					// Ensure we have a valid session
					sessionId = await ensureSession(automationService, sessionId);
					if (!sessionId) {
						return { success: false, error: 'No active session' };
					}

					// Prompt for options if interactive and not provided
					if (!options && !sessionId) {
						const waitUntilChoice = await vscode.window.showQuickPick(
							[
								{ label: 'load', description: 'Wait for load event' },
								{ label: 'domcontentloaded', description: 'Wait for DOMContentLoaded event' },
								{ label: 'networkidle0', description: 'Wait for no network connections for 500ms' },
								{ label: 'networkidle2', description: 'Wait for max 2 network connections for 500ms' }
							],
							{
								placeHolder: 'Select navigation wait condition (optional)',
								title: 'Wait for Navigation'
							}
						);

						if (waitUntilChoice) {
							options = {
								waitUntil: waitUntilChoice.label as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
							};
						}
					}

					// Validate timeout if provided
					if (options?.timeout) {
						const timeoutValidation = validateTimeout(options.timeout);
						if (!timeoutValidation.isValid) {
							displayError(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
							return { success: false, error: timeoutValidation.error };
						}
					}

					// Execute wait for navigation
					const result = await automationService.waitForNavigation(sessionId, options);

					if (!result.success) {
						displayError(result.error || 'Navigation timeout', 'Wait for Navigation');
						return result;
					}

					// Show success notification
					const waitType = options?.waitUntil || 'load';
					vscode.window.showInformationMessage(`Navigation complete (${waitType})`);
					return result;

				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
					displayError(errorMsg, 'Wait for Navigation Exception');
					return {
						success: false,
						error: errorMsg
					};
				}
			}
		)
	);

	/**
	 * Dispose output channel on deactivation
	 */
	context.subscriptions.push({
		dispose: () => {
			if (outputChannel) {
				outputChannel.dispose();
				outputChannel = undefined;
			}
		}
	});
}
