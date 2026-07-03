/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { ToolApprovalType } from '../../../../../../common/toolsServiceTypes.js';

/**
 * Friendly, human-readable labels for the tool approval surface.
 *
 * The backend approval types are lowercase technical strings (`edits`,
 * `terminal`, `MCP tools`). These helpers map them to the copy shown in the
 * UI so we keep the technical identifiers out of the rendered card.
 */

/** Friendly noun phrase for an approval category, e.g. "Terminal commands". */
export const getApprovalTypeLabel = (type: ToolApprovalType): string => {
	switch (type) {
		case 'edits': return 'Code edits';
		case 'terminal': return 'Terminal commands';
		case 'MCP tools': return 'MCP tools';
		default: return type;
	}
};

/**
 * Label for the "always allow" toggle in the footer.
 * e.g. "Always allow terminal commands" — matches the Settings page phrasing.
 */
export const getAutoApproveLabel = (type: ToolApprovalType): string => {
	switch (type) {
		case 'edits': return 'Always allow code edits';
		case 'terminal': return 'Always allow terminal commands';
		case 'MCP tools': return 'Always allow MCP tools';
		default: return `Always allow ${type}`;
	}
};

/** Short verb for the primary action, customized per category. */
export const getApproveActionLabel = (type: ToolApprovalType | undefined): string => {
	switch (type) {
		case 'edits': return 'Approve';
		case 'terminal': return 'Approve';
		case 'MCP tools': return 'Approve';
		default: return 'Approve';
	}
};

/** aria-label for the approve button, including the category for screen readers. */
export const getApproveAriaLabel = (type: ToolApprovalType | undefined): string => {
	const label = getApprovalTypeLabel(type ?? 'MCP tools');
	return `Approve ${label.toLowerCase()}`;
};

/** aria-label for the deny button, including the category for screen readers. */
export const getDenyAriaLabel = (type: ToolApprovalType | undefined): string => {
	const label = getApprovalTypeLabel(type ?? 'MCP tools');
	return `Deny ${label.toLowerCase()}`;
};