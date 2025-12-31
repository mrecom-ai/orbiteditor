/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Maximum script length to prevent extremely long scripts
 */
const MAX_SCRIPT_LENGTH = 10000;

/**
 * Default timeout for evaluation operations (30 seconds)
 */
export const DEFAULT_EVAL_TIMEOUT = 30000;

/**
 * Patterns that might indicate dangerous operations
 */
const DANGEROUS_PATTERNS = [
	/while\s*\(\s*true\s*\)/gi,           // Infinite loops
	/for\s*\(\s*;\s*;\s*\)/gi,            // Infinite for loops
	/setInterval\s*\(/gi,                 // Intervals without clear cleanup
	/eval\s*\(/gi,                        // Nested eval
	/Function\s*\(/gi,                    // Dynamic function creation
	/document\.write\s*\(/gi,             // Document.write can break page
	/location\s*=\s*['"]javascript:/gi,   // JavaScript protocol
	/\.innerHTML\s*=.*<script/gi,         // Script injection
];

/**
 * Validation result for script input
 */
export interface ValidationResult {
	isValid: boolean;
	error?: string;
	warnings?: string[];
}

/**
 * Options for script evaluation
 */
export interface EvaluationOptions {
	timeout?: number;
	showResult?: boolean;
	safeMode?: boolean;
}

/**
 * Validates JavaScript script for safety and length
 */
export function validateScript(script: string, safeMode: boolean = true): ValidationResult {
	const warnings: string[] = [];

	// Check length
	if (script.length === 0) {
		return {
			isValid: false,
			error: 'Script cannot be empty'
		};
	}

	if (script.length > MAX_SCRIPT_LENGTH) {
		return {
			isValid: false,
			error: `Script exceeds maximum length of ${MAX_SCRIPT_LENGTH} characters`
		};
	}

	// Check for dangerous patterns only in safe mode
	if (safeMode) {
		for (const pattern of DANGEROUS_PATTERNS) {
			if (pattern.test(script)) {
				warnings.push(`Potentially dangerous pattern detected: ${pattern.source}`);
			}
		}

		// If we have warnings, add a note
		if (warnings.length > 0) {
			warnings.push('Consider reviewing the script or disabling safe mode if intentional.');
		}
	}

	return {
		isValid: true,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Formats evaluation result for display
 */
export function formatResult(result: any): string {
	if (result === undefined) {
		return 'undefined';
	}

	if (result === null) {
		return 'null';
	}

	// Handle primitive types
	if (typeof result === 'string') {
		return `"${result}"`;
	}

	if (typeof result === 'number' || typeof result === 'boolean') {
		return String(result);
	}

	// Handle functions
	if (typeof result === 'function') {
		return '[Function]';
	}

	// Handle objects and arrays
	if (typeof result === 'object') {
		try {
			// For arrays, show a compact format if small
			if (Array.isArray(result)) {
				if (result.length === 0) {
					return '[]';
				}
				if (result.length <= 5 && result.every(item => typeof item !== 'object')) {
					return JSON.stringify(result);
				}
				return JSON.stringify(result, null, 2);
			}

			// For objects, pretty print with indentation
			const keys = Object.keys(result);
			if (keys.length === 0) {
				return '{}';
			}

			// If object is small and flat, keep it compact
			if (keys.length <= 3 && keys.every(key => typeof result[key] !== 'object')) {
				return JSON.stringify(result);
			}

			// Otherwise, pretty print
			return JSON.stringify(result, null, 2);
		} catch (error) {
			// Handle circular references or other JSON errors
			return '[Object: Unable to stringify - circular reference or complex structure]';
		}
	}

	return String(result);
}

/**
 * Displays evaluation result to user
 */
export async function displayResult(result: any, outputChannel?: vscode.OutputChannel): Promise<void> {
	const formatted = formatResult(result);

	// If output channel provided, log there
	if (outputChannel) {
		outputChannel.appendLine('--- Evaluation Result ---');
		outputChannel.appendLine(formatted);
		outputChannel.appendLine('');
		outputChannel.show(true); // Show without taking focus
	}

	// For short results, also show as information message
	if (formatted.length <= 100) {
		vscode.window.showInformationMessage(`Result: ${formatted}`);
	} else {
		// For long results, show notification that result is in output channel
		vscode.window.showInformationMessage(
			'Evaluation complete. Result displayed in output channel.',
			'Show Output'
		).then(selection => {
			if (selection === 'Show Output' && outputChannel) {
				outputChannel.show();
			}
		});
	}
}

/**
 * Displays error to user with helpful context
 */
export function displayError(error: string, context?: string): void {
	let message = error;
	if (context) {
		message = `${context}: ${error}`;
	}

	vscode.window.showErrorMessage(`Browser Automation: ${message}`);
}

/**
 * Displays warnings to user
 */
export async function displayWarnings(warnings: string[]): Promise<boolean> {
	if (warnings.length === 0) {
		return true;
	}

	const warningMessage = warnings.join('\n');
	const selection = await vscode.window.showWarningMessage(
		`Script Safety Warning:\n${warningMessage}`,
		{ modal: true },
		'Continue Anyway',
		'Cancel'
	);

	return selection === 'Continue Anyway';
}

/**
 * Validates CSS selector syntax (basic check)
 */
export function validateSelector(selector: string): ValidationResult {
	if (!selector || selector.trim().length === 0) {
		return {
			isValid: false,
			error: 'Selector cannot be empty'
		};
	}

	// Basic validation - check for obvious syntax errors
	try {
		// Check for unmatched brackets or quotes
		const openBrackets = (selector.match(/\[/g) || []).length;
		const closeBrackets = (selector.match(/\]/g) || []).length;
		if (openBrackets !== closeBrackets) {
			return {
				isValid: false,
				error: 'Unmatched square brackets in selector'
			};
		}

		const openParens = (selector.match(/\(/g) || []).length;
		const closeParens = (selector.match(/\)/g) || []).length;
		if (openParens !== closeParens) {
			return {
				isValid: false,
				error: 'Unmatched parentheses in selector'
			};
		}

		// Check for dangerous patterns
		if (selector.includes('..')) {
			return {
				isValid: false,
				error: 'Invalid selector syntax: consecutive dots'
			};
		}

		return { isValid: true };
	} catch (error) {
		return {
			isValid: false,
			error: 'Invalid selector syntax'
		};
	}
}

/**
 * Validates timeout value
 */
export function validateTimeout(timeout?: number): ValidationResult {
	if (timeout === undefined) {
		return { isValid: true };
	}

	if (typeof timeout !== 'number' || isNaN(timeout)) {
		return {
			isValid: false,
			error: 'Timeout must be a number'
		};
	}

	if (timeout < 0) {
		return {
			isValid: false,
			error: 'Timeout cannot be negative'
		};
	}

	if (timeout > 300000) { // 5 minutes max
		return {
			isValid: false,
			error: 'Timeout cannot exceed 5 minutes (300000ms)'
		};
	}

	return { isValid: true };
}

/**
 * Common script snippets for quick access
 */
export const COMMON_SNIPPETS = [
	{ label: 'Get page title', script: 'document.title' },
	{ label: 'Get current URL', script: 'window.location.href' },
	{ label: 'Get page dimensions', script: '({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })' },
	{ label: 'Check if element exists', script: 'document.querySelector("SELECTOR") !== null' },
	{ label: 'Count elements', script: 'document.querySelectorAll("SELECTOR").length' },
	{ label: 'Get all links', script: 'Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent, href: a.href }))' },
	{ label: 'Get all images', script: 'Array.from(document.querySelectorAll("img")).map(img => ({ src: img.src, alt: img.alt }))' },
	{ label: 'Get meta description', script: 'document.querySelector(\'meta[name="description"]\')?.content' },
	{ label: 'Get all headings', script: 'Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(h => ({ level: h.tagName, text: h.textContent }))' },
	{ label: 'Scroll to bottom', script: 'window.scrollTo(0, document.body.scrollHeight)' },
];
