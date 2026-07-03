/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName, BuiltinToolCallParams } from '../../../../../../common/toolsServiceTypes.js';
import { resolveBuiltinToolNameLoose } from '../../../../../../common/prompt/prompts.js';
import { ShellApprovalPreview } from './previews/ShellApprovalPreview.js';
import { McpApprovalPreview } from './previews/McpApprovalPreview.js';
import { GenericApprovalPreview } from './previews/GenericApprovalPreview.js';

/**
 * Routes a pending tool request to the right preview component.
 *
 * Routing rules:
 *  - MCP tools (mcpServerName set) → McpApprovalPreview
 *  - Shell / AwaitShell → ShellApprovalPreview (the highest-impact change:
 *    ShellToolCard returns null for tool_request, so previously the command
 *    was buried in a one-line desc)
 *  - everything else → GenericApprovalPreview (Read, Glob, Grep, etc.)
 *
 * StrReplace / Write never reach here — ChatBubble routes their tool_request
 * to the edit-tool card, which composes `ToolApprovalActions` directly.
 */
export const ToolApprovalPreview = ({
	toolMessage,
}: {
	toolMessage: ToolMessage<ToolName>,
}) => {
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