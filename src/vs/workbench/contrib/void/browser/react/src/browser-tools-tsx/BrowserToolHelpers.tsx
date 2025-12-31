/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolMessage } from '../../../../common/chatThreadServiceTypes.js';

// Type definitions for browser tools
export type BrowserToolName =
	| 'browser_navigate'
	| 'browser_click'
	| 'browser_type'
	| 'browser_fill'
	| 'browser_screenshot'
	| 'browser_get_content'
	| 'browser_extract_text'
	| 'browser_evaluate'
	| 'browser_wait_for_selector'
	| 'browser_get_url';

export type BrowserToolVariant = 'navigation' | 'interaction' | 'capture' | 'evaluation';

// Categorizes tools by variant
export function getBrowserToolVariant(toolName: BrowserToolName): BrowserToolVariant {
	switch (toolName) {
		case 'browser_navigate':
		case 'browser_get_url':
			return 'navigation';

		case 'browser_click':
		case 'browser_type':
		case 'browser_fill':
		case 'browser_wait_for_selector':
			return 'interaction';

		case 'browser_screenshot':
		case 'browser_get_content':
		case 'browser_extract_text':
			return 'capture';

		case 'browser_evaluate':
			return 'evaluation';

		default:
			const _exhaustive: never = toolName;
			return 'navigation';
	}
}

// Gets the variant-specific border color class
export function getVariantBorderColor(variant: BrowserToolVariant): string {
	switch (variant) {
		case 'navigation':
		case 'interaction':
		case 'capture':
		case 'evaluation':
			return 'border-l-blue-500/20';
	}
}

// Gets the variant-specific icon color class
export function getVariantIconColor(variant: BrowserToolVariant): string {
	switch (variant) {
		case 'navigation':
		case 'interaction':
		case 'capture':
		case 'evaluation':
			return 'text-blue-500';
	}
}

// Extracts primary display content from tool params/results
export function getPrimaryContent<T extends BrowserToolName>(
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>
): string | null {
	const { name, type } = toolMessage;

	if (type === 'tool_request' || type === 'running_now') {
		const params = toolMessage.params as any;

		switch (name) {
			case 'browser_navigate':
				return params.url || null;
			case 'browser_click':
			case 'browser_wait_for_selector':
				return params.selector || null;
			case 'browser_type':
				return `${params.selector}: "${params.text}"` || null;
			case 'browser_fill':
				return `${params.selector}: "${params.value}"` || null;
			case 'browser_screenshot':
				return params.fullPage ? 'Full page screenshot' : 'Viewport screenshot';
			case 'browser_get_content':
				return 'Extracting page content...';
			case 'browser_extract_text':
				return params.selector || null;
			case 'browser_evaluate':
				return params.script ? params.script.substring(0, 60) + (params.script.length > 60 ? '...' : '') : null;
			case 'browser_get_url':
				return 'Getting current URL...';
			default:
				return null;
		}
	}

	if (type === 'success') {
		const result = toolMessage.result as any;

		switch (name) {
			case 'browser_navigate':
			case 'browser_get_url':
				return result.url || null;
			case 'browser_click':
				return result.selector || null;
			case 'browser_type':
				return `Typed ${result.textLength} characters`;
			case 'browser_fill':
				return result.selector || null;
			case 'browser_screenshot':
				return 'Screenshot captured';
			case 'browser_get_content':
				return result.title || 'Page content extracted';
			case 'browser_extract_text':
				return result.text ? `Extracted ${result.text.length} characters` : 'Text extracted';
			case 'browser_evaluate':
				return 'Script executed';
			case 'browser_wait_for_selector':
				return result.selector || null;
			default:
				return null;
		}
	}

	if (type === 'rejected') {
		return 'Tool execution rejected';
	}

	if (type === 'tool_error') {
		return typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result);
	}

	return null;
}

// Determines if tool has expandable preview
export function hasExpandablePreview<T extends BrowserToolName>(
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>
): boolean {
	const { name, type } = toolMessage;

	if (type !== 'success') return false;

	switch (name) {
		case 'browser_screenshot':
		case 'browser_get_content':
		case 'browser_extract_text':
		case 'browser_evaluate':
			return true;
		default:
			return false;
	}
}

// Gets metadata information (file size, timing, etc.)
export function getMetaInfo<T extends BrowserToolName>(
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>
): string | null {
	const { name, type, params } = toolMessage;

	if (type === 'tool_request' || type === 'running_now') {
		const p = params as any;

		switch (name) {
			case 'browser_navigate':
				return `waitUntil=${p.waitUntil}; timeout=${p.timeout}ms`;
			case 'browser_click':
			case 'browser_wait_for_selector':
			case 'browser_extract_text':
				return `timeout=${p.timeout}ms`;
			case 'browser_type':
				return `delay=${p.delayMs}ms; timeout=${p.timeout}ms`;
			case 'browser_fill':
				return `timeout=${p.timeout}ms`;
			default:
				return null;
		}
	}

	if (type === 'success') {
		const result = toolMessage.result as any;

		switch (name) {
			case 'browser_screenshot':
				// Calculate approximate size from base64 string
				const sizeKB = result.base64 ? Math.round(result.base64.length * 0.75 / 1024) : 0;
				return `${sizeKB} KB`;
			case 'browser_get_content':
				const htmlSizeKB = result.html ? Math.round(result.html.length / 1024) : 0;
				return `${htmlSizeKB} KB`;
			case 'browser_extract_text':
				return result.text ? `${result.text.length} chars` : null;
			default:
				return null;
		}
	}

	return null;
}

// Gets human-readable tool title
export function getToolTitle(toolName: BrowserToolName): string {
	switch (toolName) {
		case 'browser_navigate':
			return 'Navigating to';
		case 'browser_click':
			return 'Clicking';
		case 'browser_type':
			return 'Typing into';
		case 'browser_fill':
			return 'Filling';
		case 'browser_screenshot':
			return 'Taking screenshot';
		case 'browser_get_content':
			return 'Getting content';
		case 'browser_extract_text':
			return 'Extracting text';
		case 'browser_evaluate':
			return 'Evaluating script';
		case 'browser_wait_for_selector':
			return 'Waiting for';
		case 'browser_get_url':
			return 'Getting URL';
		default:
			const _exhaustive: never = toolName;
			return toolName;
	}
}
