/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { RawToolCallObj } from '../../../../../common/sendLLMMessageTypes.js';
import { builtinToolNames, isLLMHiddenBuiltinToolName, resolveBuiltinToolNameLoose } from '../../../../../common/prompt/prompts.js';
import { LEGACY_TOOL_NAME_MAP } from '../constants/legacyToolNameMap.js';

const LEGACY_STREAMING_EDIT_TOOL_NAMES = new Set(Object.keys(LEGACY_TOOL_NAME_MAP));

const normalizeToolNameForPrefix = (name: string): string => name.trim().replace(/[\s-]+/g, '_');

const hasMcpToolName = (mcpToolNames: Iterable<string>, toolName: string): boolean => {
	for (const name of mcpToolNames) {
		if (name === toolName) {
			return true;
		}
	}
	return false;
};

/**
 * Whether a partial tool call from llmInfo should render via StreamingTool.
 * Legacy edit names (edit_file, rewrite_file, …) are not in builtinToolNames
 * but must still stream through the edit-tool card path.
 */
export const isRenderableStreamingToolCall = (
	tool: RawToolCallObj | null | undefined,
	opts: { mcpToolNames: Iterable<string> },
): boolean => {
	if (!tool?.name) {
		return false;
	}
	const toolName = tool.name.trim();
	if (!toolName) {
		return false;
	}
	if (isLLMHiddenBuiltinToolName(toolName)) {
		return false;
	}

	if (LEGACY_STREAMING_EDIT_TOOL_NAMES.has(toolName)) {
		return true;
	}

	if (resolveBuiltinToolNameLoose(toolName, { mcpToolNames: opts.mcpToolNames }) || hasMcpToolName(opts.mcpToolNames, toolName)) {
		return true;
	}

	const normalized = normalizeToolNameForPrefix(toolName);
	const isBuiltinPrefix = normalized ? builtinToolNames.some(name => name.startsWith(normalized)) : true;
	if (isBuiltinPrefix) {
		return false;
	}

	for (const name of opts.mcpToolNames) {
		if (name.startsWith(toolName)) {
			return false;
		}
	}

	return false;
};