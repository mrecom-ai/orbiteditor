/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../../../base/common/uri.js';
import { ChatMessage } from '../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolCallParams, ToolResult } from '../../../../../common/toolsServiceTypes.js';
import { RawToolCallObj } from '../../../../../common/sendLLMMessageTypes.js';
import { getBasename, getRelative, pathStringToUri } from './fileUtils.js';
import { resolveExplorationToolName } from './explorationTools.js';
import { resolveLegacyToolName } from '../constants/legacyToolNameMap.js';

export type ToolLogLineMeta = {
	text: string;
	isActive: boolean;
	isError: boolean;
	isRejected: boolean;
	onClick?: () => void;
	tooltip?: string;
};

/** Minimal accessor surface used for workspace-relative tool log labels. */
export type ToolLogAccessor = {
	get(service: 'IWorkspaceContextService'): {
		getWorkspace(): { folders: Array<{ uri: { fsPath: string } }> };
		isInsideWorkspace(uri: URI): boolean;
	};
};

type ToolMessage = ChatMessage & { role: 'tool' };
type ReadToolMessage = ToolMessage & { name: 'Read' };
type ReadTextResult = Extract<ToolResult<'Read'>, { kind: 'text' }>;

const truncate = (value: string, maxLen: number): string => {
	if (value.length <= maxLen) return value;
	return `${value.slice(0, maxLen - 1)}…`;
};

const formatLineRange = (startLine: number, endLine: number): string => {
	if (startLine <= 0 || endLine <= 0) return '';
	if (startLine === endLine) return ` L${startLine}`;
	return ` L${startLine}-${endLine}`;
};

const parsePositiveInt = (value: string | undefined): number | undefined => {
	if (value === undefined || value === '') return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return Math.floor(parsed);
};

const hasToolParams = (msg: ToolMessage): boolean => {
	return msg.type !== 'invalid_params' && msg.type !== 'tool_request';
};

const getReadParams = (msg: ReadToolMessage): BuiltinToolCallParams['Read'] | undefined => {
	if (msg.type === 'invalid_params' || msg.type === 'tool_request') {
		return undefined;
	}
	return (msg as { params: BuiltinToolCallParams['Read'] }).params;
};

const getToolParams = (msg: ToolMessage): unknown | undefined => {
	if (msg.type === 'invalid_params' || msg.type === 'tool_request') {
		return undefined;
	}
	return (msg as { params: unknown }).params;
};

const getReadTextResult = (msg: ReadToolMessage): ReadTextResult | undefined => {
	if (msg.type !== 'success') return undefined;
	const result = msg.result as ToolResult<'Read'>;
	return result.kind === 'text' ? result : undefined;
};

const isReadTextSuccess = (
	msg: ReadToolMessage,
): msg is ReadToolMessage & { type: 'success'; result: ReadTextResult } => {
	return getReadTextResult(msg) !== undefined;
};

const resolveToolUri = (value: unknown): URI | undefined => {
	if (value instanceof URI) return value;
	if (typeof value === 'string') {
		try {
			return pathStringToUri(value);
		} catch {
			return undefined;
		}
	}
	return undefined;
};

const getReadLineRangeFromCommitted = (msg: ReadToolMessage): string => {
	if (isReadTextSuccess(msg) && msg.result.fileContents) {
		const returnedLines = msg.result.fileContents.split('\n').length;
		if (returnedLines > 0) {
			const endLine = msg.result.firstLineNumber + returnedLines - 1;
			return formatLineRange(msg.result.firstLineNumber, endLine);
		}
	}

	if (hasToolParams(msg) && getReadParams(msg)) {
		const params = getReadParams(msg)!;
		const startLine = params.offset;
		const limit = params.limit;
		if (startLine > 0 && limit > 0) {
			return formatLineRange(startLine, startLine + limit - 1);
		}
	}

	return '';
};

const getReadLineRangeFromStreaming = (tool: RawToolCallObj): string => {
	const offset = parsePositiveInt(tool.rawParams.offset as string | undefined) ?? 1;
	const limit = parsePositiveInt(tool.rawParams.limit as string | undefined);
	if (limit) {
		return formatLineRange(offset, offset + limit - 1);
	}
	return '';
};

const getWorkspaceLabel = (accessor: ToolLogAccessor): string => {
	const workspaceContextService = accessor.get('IWorkspaceContextService');
	const folders = workspaceContextService.getWorkspace().folders;
	if (folders.length === 1) {
		return getBasename(folders[0].uri.fsPath);
	}
	return 'workspace';
};

const resolvePathBasename = (pathStr: string | undefined): string => {
	if (!pathStr) return '';
	try {
		return getBasename(pathStringToUri(pathStr).fsPath);
	} catch {
		return getBasename(pathStr);
	}
};

export const formatCommittedExplorationToolLog = (
	msg: ToolMessage,
	accessor: ToolLogAccessor,
	openFile: (uri: URI, range?: [number, number]) => void,
): ToolLogLineMeta => {
	const toolName = resolveExplorationToolName(msg.name) ?? msg.name;
	const isRejected = msg.type === 'rejected';
	const isActive = msg.type === 'running_now';

	if (msg.type === 'tool_error') {
		const errorText = typeof (msg as { result: unknown }).result === 'string'
			? (msg as { result: string }).result
			: String((msg as { result: unknown }).result);
		return {
			text: truncate(`${toolName} failed: ${errorText}`, 120),
			isActive: false,
			isError: true,
			isRejected: false,
		};
	}

	if (msg.type === 'invalid_params') {
		return {
			text: truncate(`${toolName} failed: ${msg.content}`, 120),
			isActive: false,
			isError: true,
			isRejected: false,
		};
	}

	if (toolName === 'Read') {
		const readMsg = msg as ReadToolMessage;
		const readParams = getReadParams(readMsg);
		const uri = readParams?.uri ?? resolveToolUri(readMsg.rawParams?.path ?? readMsg.rawParams?.uri);
		const basename = uri
			? getBasename(uri.fsPath)
			: resolvePathBasename((readMsg.rawParams?.path ?? readMsg.rawParams?.uri) as string | undefined);
		const lineRange = getReadLineRangeFromCommitted(readMsg);
		const tooltip = uri ? getRelative(uri, accessor) : undefined;
		const readTextResult = getReadTextResult(readMsg);
		let range: [number, number] | undefined;
		if (readTextResult?.fileContents) {
			const returnedLines = readTextResult.fileContents.split('\n').length;
			if (returnedLines > 0) {
				range = [readTextResult.firstLineNumber, readTextResult.firstLineNumber + returnedLines - 1];
			}
		}

		return {
			text: `Read ${basename}${lineRange}`,
			isActive,
			isError: false,
			isRejected,
			tooltip,
			onClick: uri ? () => openFile(uri, range) : undefined,
		};
	}

	if (toolName === 'read_lint_errors') {
		const lintParams = getToolParams(msg) as BuiltinToolCallParams['read_lint_errors'] | undefined;
		const uri = lintParams?.uri ?? resolveToolUri(msg.rawParams?.uri);
		const basename = uri
			? getBasename(uri.fsPath)
			: resolvePathBasename(msg.rawParams?.uri as string | undefined);

		return {
			text: `Read lints ${basename}`,
			isActive,
			isError: false,
			isRejected,
			tooltip: uri ? getRelative(uri, accessor) : undefined,
			onClick: uri ? () => openFile(uri) : undefined,
		};
	}

	if (toolName === 'Glob') {
		const globParams = getToolParams(msg) as BuiltinToolCallParams['Glob'] | undefined;
		const pattern = globParams?.globPattern ?? (msg.rawParams?.glob_pattern as string | undefined) ?? '';
		const workspace = getWorkspaceLabel(accessor);
		const patternLabel = pattern ? `\`${pattern}\`` : 'files';
		return {
			text: `Searched files ${patternLabel} in ${workspace}`,
			isActive,
			isError: false,
			isRejected,
		};
	}

	if (toolName === 'Grep') {
		const grepParams = getToolParams(msg) as BuiltinToolCallParams['Grep'] | undefined;
		const pattern = grepParams?.pattern ?? (msg.rawParams?.pattern as string | undefined) ?? '';
		const patternLabel = pattern ? `\`${truncate(pattern, 60)}\`` : 'pattern';
		return {
			text: `Grepped ${patternLabel}`,
			isActive,
			isError: false,
			isRejected,
		};
	}

	return {
		text: toolName,
		isActive,
		isError: false,
		isRejected,
	};
};

export const formatStreamingExplorationToolLog = (
	tool: RawToolCallObj,
	accessor: ToolLogAccessor,
): ToolLogLineMeta => {
	const effectiveName = resolveLegacyToolName(tool.name);
	const toolName = resolveExplorationToolName(effectiveName) ?? effectiveName;
	const isActive = !tool.isDone;
	const pathStr = (tool.rawParams.path ?? tool.rawParams.uri) as string | undefined;

	if (toolName === 'Read') {
		const basename = resolvePathBasename(pathStr);
		const lineRange = getReadLineRangeFromStreaming(tool);
		const verb = isActive ? 'Reading' : 'Read';
		let uri: URI | undefined;
		try {
			if (pathStr) uri = pathStringToUri(pathStr);
		} catch { /* ignore */ }

		return {
			text: `${verb} ${basename}${lineRange}`,
			isActive,
			isError: false,
			isRejected: false,
			tooltip: uri ? getRelative(uri, accessor) : undefined,
		};
	}

	if (toolName === 'read_lint_errors') {
		const basename = resolvePathBasename((tool.rawParams.uri as string | undefined) ?? pathStr);
		const verb = isActive ? 'Reading lints' : 'Read lints';
		return {
			text: `${verb} ${basename}`,
			isActive,
			isError: false,
			isRejected: false,
		};
	}

	if (toolName === 'Glob') {
		const pattern = (tool.rawParams.glob_pattern as string | undefined) ?? '';
		const workspace = getWorkspaceLabel(accessor);
		const patternLabel = pattern ? `\`${pattern}\`` : 'files';
		const verb = isActive ? 'Searching' : 'Searched';
		return {
			text: `${verb} files ${patternLabel} in ${workspace}`,
			isActive,
			isError: false,
			isRejected: false,
		};
	}

	if (toolName === 'Grep') {
		const pattern = (tool.rawParams.pattern as string | undefined) ?? '';
		const patternLabel = pattern ? `\`${truncate(pattern, 60)}\`` : 'pattern';
		const verb = isActive ? 'Grepping' : 'Grepped';
		return {
			text: `${verb} ${patternLabel}`,
			isActive,
			isError: false,
			isRejected: false,
		};
	}

	return {
		text: isActive ? `Running ${toolName}` : toolName,
		isActive,
		isError: false,
		isRejected: false,
	};
};
