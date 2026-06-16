"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionId = generateSessionId;
exports.isValidUrl = isValidUrl;
exports.isValidSelector = isValidSelector;
/**
 * Generate a unique session ID
 */
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${randomStr}`;
}
/**
 * Validate URL format
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validate CSS selector (basic validation)
 */
function isValidSelector(selector) {
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
//# sourceMappingURL=utils.js.map