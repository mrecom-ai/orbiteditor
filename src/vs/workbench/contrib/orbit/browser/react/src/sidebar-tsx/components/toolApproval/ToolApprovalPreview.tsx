/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName, BuiltinToolCallParams } from '../../../../../../common/toolsServiceTypes.js';
import { resolveBuiltinToolNameLoose } from '../../../../../../common/prompt/prompts.js';
import { removeMCPToolNamePrefix } from '../../../../../../common/mcpServiceTypes.js';
import { ShellApprovalPreview } from './previews/ShellApprovalPreview.js';
import { McpApprovalPreview } from './previews/McpApprovalPreview.js';
import { BrowserOpenApprovalPreview } from './previews/BrowserOpenApprovalPreview.js';
import { GenericApprovalPreview } from './previews/GenericApprovalPreview.js';

/**
 * True when this MCP tool request is opening a browser tab (navigate with no
 * existing viewId, or browser_tabs action "new"), OR when a non-navigate
 * browser tool is being run with no tabs open (tagged with the
 * `__orbitAutoOpenBrowser` sentinel by the approval gate so the MCP server
 * auto-opens a tab on the approved run). Used for the clean "Open browser"
 * approval card.
 */
export function isBrowserOpenToolRequest(toolMessage: ToolMessage<ToolName>): boolean {
	if (toolMessage.mcpServerName !== 'orbit-ide-browser') {
		return false;
	}
	const name = removeMCPToolNamePrefix(toolMessage.name);
	const params = (('params' in toolMessage ? (toolMessage as any).params : undefined)
		?? toolMessage.rawParams
		?? {}) as Record<string, unknown>;
	// Non-navigate tool auto-open: the approval gate set the sentinel because no
	// tabs are open and the tool would otherwise fail with "No browser tab is open".
	if (name !== 'browser_navigate' && name !== 'browser_tabs' && params.__orbitAutoOpenBrowser === true) {
		return true;
	}
	if (name === 'browser_navigate') {
		// Opening a new tab or first tab (no viewId to reuse).
		return params.newTab === true || typeof params.viewId !== 'string' || !params.viewId;
	}
	if (name === 'browser_tabs') {
		return params.action === 'new';
	}
	return false;
}

/**
 * Routes a pending tool request to the right preview component.
 *
 * Routing rules:
 *  - orbit-ide-browser open-tab tools → BrowserOpenApprovalPreview
 *  - other MCP tools → McpApprovalPreview
 *  - Shell / AwaitShell → ShellApprovalPreview
 *  - everything else → GenericApprovalPreview
 */
export const ToolApprovalPreview = ({
	toolMessage,
}: {
	toolMessage: ToolMessage<ToolName>,
}) => {
	if (toolMessage.mcpServerName === 'orbit-ide-browser' && isBrowserOpenToolRequest(toolMessage)) {
		const params = (('params' in toolMessage ? (toolMessage as any).params : undefined)
			?? toolMessage.rawParams
			?? {}) as Record<string, unknown>;
		const name = removeMCPToolNamePrefix(toolMessage.name);
		const isAutoOpen = name !== 'browser_navigate' && name !== 'browser_tabs' && params.__orbitAutoOpenBrowser === true;
		return (
			<BrowserOpenApprovalPreview
				url={isAutoOpen ? undefined : (typeof params.url === 'string' ? params.url : undefined)}
				position={isAutoOpen ? 'active' : (params.position === 'active' || params.position === 'side' ? params.position : undefined)}
				isNewTab={isAutoOpen || name === 'browser_tabs' || params.newTab === true}
				toolName={isAutoOpen ? name : undefined}
			/>
		);
	}

	// MCP tools get the server-name + params preview
	if (toolMessage.mcpServerName) {
		return (
			<McpApprovalPreview
				toolName={toolMessage.name}
				mcpServerName={toolMessage.mcpServerName}
				params={'params' in toolMessage ? (toolMessage as any).params : undefined}
				rawParams={toolMessage.rawParams}
			/>
		);
	}

	const resolvedName = resolveBuiltinToolNameLoose(toolMessage.name);

	if (resolvedName === 'Shell' || resolvedName === 'AwaitShell') {
		const params = ('params' in toolMessage ? (toolMessage as any).params : undefined) as
			| BuiltinToolCallParams['Shell']
			| BuiltinToolCallParams['AwaitShell']
			| undefined;
		if (params) {
			return <ShellApprovalPreview toolName={resolvedName} params={params} />;
		}
	}

	// Fallback for Read, Glob, Grep, TodoWrite, plan tools, etc.
	return <GenericApprovalPreview toolMessage={toolMessage} />;
};