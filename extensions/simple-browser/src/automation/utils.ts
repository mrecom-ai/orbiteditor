/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const randomStr = Math.random().toString(36).substring(2, 15);
	return `session_${timestamp}_${randomStr}`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate CSS selector (basic validation)
 */
export function isValidSelector(selector: string): boolean {
	// Basic validation - check if selector is not empty and doesn't have obvious syntax errors
	if (!selector || selector.trim().length === 0) {
		return false;
	}
	// Check for common invalid patterns
	if (selector.includes('>>') || selector.includes('<<')) {
		return false;
	}
	return true;
}
