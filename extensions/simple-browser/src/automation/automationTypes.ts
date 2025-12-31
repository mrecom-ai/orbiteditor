/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Result wrapper for automation operations
 */
export interface AutomationResult<T = any> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Browser session information
 */
export interface BrowserSession {
	id: string;
	url: string;
	createdAt: number;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
	fullPage?: boolean;
	type?: 'png' | 'jpeg';
	quality?: number;
	clip?: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

/**
 * PDF generation options
 */
export interface PDFOptions {
	scale?: number;
	displayHeaderFooter?: boolean;
	headerTemplate?: string;
	footerTemplate?: string;
	printBackground?: boolean;
	landscape?: boolean;
	pageRanges?: string;
	format?: string;
	width?: string | number;
	height?: string | number;
	margin?: {
		top?: string | number;
		right?: string | number;
		bottom?: string | number;
		left?: string | number;
	};
}

/**
 * Cookie structure
 */
export interface Cookie {
	name: string;
	value: string;
	domain?: string;
	path?: string;
	expires?: number;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Navigation options
 */
export interface NavigationOptions {
	timeout?: number;
	waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * Wait for selector options
 */
export interface WaitForSelectorOptions {
	visible?: boolean;
	hidden?: boolean;
	timeout?: number;
}

/**
 * Click options
 */
export interface ClickOptions {
	button?: 'left' | 'right' | 'middle';
	clickCount?: number;
	delay?: number;
}

/**
 * Type options
 */
export interface TypeOptions {
	delay?: number;
}

/**
 * Session creation options
 */
export interface SessionOptions {
	viewport?: {
		width: number;
		height: number;
	};
	userAgent?: string;
}

/**
 * Evaluation options
 */
export interface EvaluationOptions {
	timeout?: number;
	showResult?: boolean;
	safeMode?: boolean;
}
