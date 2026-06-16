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
exports.registerEvaluationCommands = registerEvaluationCommands;
const vscode = __importStar(require("vscode"));
const evaluationHelpers_1 = require("./evaluationHelpers");
/**
 * Output channel for evaluation results
 */
let outputChannel;
/**
 * Get or create output channel for evaluation results
 */
function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Browser Automation');
    }
    return outputChannel;
}
/**
 * Ensures a session exists, creating one if necessary
 * Returns the session ID or undefined if creation failed
 */
async function ensureSession(automationService, providedSessionId) {
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
        (0, evaluationHelpers_1.displayError)('Failed to create browser session. Please ensure the browser is accessible.');
        return undefined;
    }
    return sessionId;
}
/**
 * Register evaluation commands for browser automation
 */
function registerEvaluationCommands(context, automationService) {
    /**
     * Evaluate JavaScript in browser context
     *
     * This command allows executing custom JavaScript in the page context.
     * It includes safety checks, timeout handling, and result formatting.
     */
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.evaluate', async (sessionId, script, options) => {
        try {
            // Ensure we have a valid session
            sessionId = await ensureSession(automationService, sessionId);
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
            // Get script input if not provided
            if (!script) {
                // Offer common snippets first
                const quickPick = await vscode.window.showQuickPick([
                    { label: 'Custom Script', description: 'Enter your own JavaScript' },
                    ...evaluationHelpers_1.COMMON_SNIPPETS.map(snippet => ({
                        label: snippet.label,
                        description: snippet.script.substring(0, 60) + (snippet.script.length > 60 ? '...' : '')
                    }))
                ], {
                    placeHolder: 'Select a common script or enter custom JavaScript',
                    title: 'JavaScript Evaluation'
                });
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
                }
                else {
                    // Use selected snippet
                    const snippet = evaluationHelpers_1.COMMON_SNIPPETS.find(s => s.label === quickPick.label);
                    script = snippet?.script;
                }
                if (!script) {
                    return { success: false, error: 'No script provided' };
                }
            }
            // Validate script
            const safeMode = options?.safeMode !== false; // Default to true
            const validation = (0, evaluationHelpers_1.validateScript)(script, safeMode);
            if (!validation.isValid) {
                (0, evaluationHelpers_1.displayError)(validation.error || 'Invalid script', 'Script Validation');
                return { success: false, error: validation.error };
            }
            // Show warnings if any
            if (validation.warnings && validation.warnings.length > 0) {
                const shouldContinue = await (0, evaluationHelpers_1.displayWarnings)(validation.warnings);
                if (!shouldContinue) {
                    return { success: false, error: 'Operation cancelled by user' };
                }
            }
            // Execute evaluation with timeout
            const timeout = options?.timeout || evaluationHelpers_1.DEFAULT_EVAL_TIMEOUT;
            const timeoutValidation = (0, evaluationHelpers_1.validateTimeout)(timeout);
            if (!timeoutValidation.isValid) {
                (0, evaluationHelpers_1.displayError)(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
                return { success: false, error: timeoutValidation.error };
            }
            // Execute the script
            const result = await automationService.evaluate(sessionId, script, { timeout });
            if (!result.success) {
                (0, evaluationHelpers_1.displayError)(result.error || 'Script execution failed', 'Evaluation Error');
                return result;
            }
            // Display result if requested (default true for interactive use)
            const showResult = options?.showResult !== false;
            if (showResult) {
                await (0, evaluationHelpers_1.displayResult)(result.data, getOutputChannel());
            }
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
            (0, evaluationHelpers_1.displayError)(errorMsg, 'Evaluation Exception');
            return {
                success: false,
                error: errorMsg
            };
        }
    }));
    /**
     * Wait for a CSS selector to appear in the DOM
     *
     * This command waits for an element matching the selector to be present.
     * Includes selector validation and configurable timeout.
     */
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.waitForSelector', async (sessionId, selector, options) => {
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
            const validation = (0, evaluationHelpers_1.validateSelector)(selector);
            if (!validation.isValid) {
                (0, evaluationHelpers_1.displayError)(validation.error || 'Invalid selector', 'Selector Validation');
                return { success: false, error: validation.error };
            }
            // Validate timeout if provided
            if (options?.timeout) {
                const timeoutValidation = (0, evaluationHelpers_1.validateTimeout)(options.timeout);
                if (!timeoutValidation.isValid) {
                    (0, evaluationHelpers_1.displayError)(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
                    return { success: false, error: timeoutValidation.error };
                }
            }
            // Execute wait for selector
            const result = await automationService.waitForSelector(sessionId, selector, options);
            if (!result.success) {
                (0, evaluationHelpers_1.displayError)(result.error || 'Element not found', 'Wait for Selector');
                return result;
            }
            // Show success notification
            vscode.window.showInformationMessage(`Element found: ${selector}`);
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
            (0, evaluationHelpers_1.displayError)(errorMsg, 'Wait for Selector Exception');
            return {
                success: false,
                error: errorMsg
            };
        }
    }));
    /**
     * Wait for page navigation to complete
     *
     * This command waits for the page to finish loading/navigating.
     * Useful after actions that trigger navigation.
     */
    context.subscriptions.push(vscode.commands.registerCommand('simpleBrowser.automation.waitForNavigation', async (sessionId, options) => {
        try {
            // Ensure we have a valid session
            sessionId = await ensureSession(automationService, sessionId);
            if (!sessionId) {
                return { success: false, error: 'No active session' };
            }
            // Prompt for options if interactive and not provided
            if (!options && !sessionId) {
                const waitUntilChoice = await vscode.window.showQuickPick([
                    { label: 'load', description: 'Wait for load event' },
                    { label: 'domcontentloaded', description: 'Wait for DOMContentLoaded event' },
                    { label: 'networkidle0', description: 'Wait for no network connections for 500ms' },
                    { label: 'networkidle2', description: 'Wait for max 2 network connections for 500ms' }
                ], {
                    placeHolder: 'Select navigation wait condition (optional)',
                    title: 'Wait for Navigation'
                });
                if (waitUntilChoice) {
                    options = {
                        waitUntil: waitUntilChoice.label
                    };
                }
            }
            // Validate timeout if provided
            if (options?.timeout) {
                const timeoutValidation = (0, evaluationHelpers_1.validateTimeout)(options.timeout);
                if (!timeoutValidation.isValid) {
                    (0, evaluationHelpers_1.displayError)(timeoutValidation.error || 'Invalid timeout', 'Timeout Validation');
                    return { success: false, error: timeoutValidation.error };
                }
            }
            // Execute wait for navigation
            const result = await automationService.waitForNavigation(sessionId, options);
            if (!result.success) {
                (0, evaluationHelpers_1.displayError)(result.error || 'Navigation timeout', 'Wait for Navigation');
                return result;
            }
            // Show success notification
            const waitType = options?.waitUntil || 'load';
            vscode.window.showInformationMessage(`Navigation complete (${waitType})`);
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
            (0, evaluationHelpers_1.displayError)(errorMsg, 'Wait for Navigation Exception');
            return {
                success: false,
                error: errorMsg
            };
        }
    }));
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
//# sourceMappingURL=evaluationCommands.js.map