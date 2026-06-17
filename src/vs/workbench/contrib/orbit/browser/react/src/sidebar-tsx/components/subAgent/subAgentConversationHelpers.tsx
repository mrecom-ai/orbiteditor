/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChatMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { resolveBuiltinToolNameLoose } from '../../../../../../common/prompt/prompts.js';
import { useAccessor } from '../../../util/services.js';
import { toolNameToDesc } from '../../constants/toolHelpers.js';

export type SubAgentExplorationStats = {
	fileCount: number;
	searchCount: number;
	toolCount: number;
};

const RUNNING_VERBS: Partial<Record<BuiltinToolName, string>> = {
	Read: 'Reading',
	Glob: 'Globbing',
	Grep: 'Grepping',
	StrReplace: 'Editing',
	Write: 'Writing',
	Shell: 'Running',
	AwaitShell: 'Awaiting',
	read_lint_errors: 'Reading lints',
	TodoWrite: 'Updating todos',
};

const DONE_VERBS: Partial<Record<BuiltinToolName, string>> = {
	Read: 'Read',
	Glob: 'Globbed',
	Grep: 'Grepped',
	StrReplace: 'Edited',
	Write: 'Wrote',
	Shell: 'Ran',
	AwaitShell: 'Polled',
	read_lint_errors: 'Read lints',
	TodoWrite: 'Updated todos',
};

const INVALID_ACTIVITY = new Set(['(value not received yet...)', 'interrupted...', '']);

export const computeSubAgentExplorationStats = (messages: readonly ChatMessage[]): SubAgentExplorationStats => {
	let fileCount = 0;
	let searchCount = 0;
	let toolCount = 0;

	for (const msg of messages) {
		if (msg.role !== 'tool') continue;
		if (msg.type === 'invalid_params' || msg.type === 'tool_request') continue;
		if (msg.name === 'task') continue;
		toolCount++;
		if (msg.name === 'Read') fileCount++;
		if (msg.name === 'Grep' || msg.name === 'Glob') searchCount++;
	}

	return { fileCount, searchCount, toolCount };
};

export const formatExplorationStatsLine = (stats: SubAgentExplorationStats): string | undefined => {
	if (stats.toolCount === 0) return undefined;
	const parts: string[] = [];
	if (stats.fileCount > 0) {
		parts.push(`Explored ${stats.fileCount} file${stats.fileCount !== 1 ? 's' : ''}`);
	}
	if (stats.searchCount > 0) {
		parts.push(`${stats.searchCount} search${stats.searchCount !== 1 ? 'es' : ''}`);
	}
	if (parts.length === 0) {
		parts.push(`${stats.toolCount} tool${stats.toolCount !== 1 ? 's' : ''} used`);
	}
	return parts.join(', ');
};

const isToolMessage = (msg: ChatMessage): msg is ChatMessage & { role: 'tool' } => msg.role === 'tool';

const findLastToolMessage = (messages: readonly ChatMessage[] | undefined): (ChatMessage & { role: 'tool' }) | undefined => {
	if (!messages) return undefined;
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (!isToolMessage(msg)) continue;
		if (msg.type === 'invalid_params' || msg.type === 'tool_request') continue;
		if (msg.name === 'task') continue;
		return msg;
	}
	return undefined;
};

const findLastToolByName = (
	messages: readonly ChatMessage[] | undefined,
	toolName: string,
): (ChatMessage & { role: 'tool' }) | undefined => {
	if (!messages) return undefined;
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (!isToolMessage(msg)) continue;
		if (msg.type === 'invalid_params' || msg.type === 'tool_request') continue;
		if (msg.name === toolName || resolveBuiltinToolNameLoose(msg.name) === resolveBuiltinToolNameLoose(toolName)) {
			return msg;
		}
	}
	return undefined;
};

const desc1ToString = (desc1: React.ReactNode): string => {
	if (typeof desc1 === 'string') return desc1;
	if (desc1 == null) return '';
	return '';
};

const formatToolStatus = (
	toolMsg: ChatMessage & { role: 'tool' },
	accessor: ReturnType<typeof useAccessor>,
	running: boolean,
): string => {
	const resolved = resolveBuiltinToolNameLoose(toolMsg.name) as BuiltinToolName | undefined;
	const { desc1 } = toolNameToDesc(
		toolMsg.name,
		toolMsg.type !== 'invalid_params' && toolMsg.type !== 'tool_request' ? toolMsg.params as any : undefined,
		accessor,
		toolMsg.rawParams,
	);
	const detail = desc1ToString(desc1);
	const verb = running
		? (resolved ? RUNNING_VERBS[resolved] : undefined) ?? toolMsg.name
		: (resolved ? DONE_VERBS[resolved] : undefined) ?? toolMsg.name;
	if (detail) return `${verb} · ${detail}`;
	return verb;
};

export const formatSubAgentLiveStatus = (opts: {
	liveActivity?: string;
	conversation?: readonly ChatMessage[];
	accessor: ReturnType<typeof useAccessor>;
	isRunning: boolean;
}): string | undefined => {
	const { liveActivity, conversation, accessor, isRunning } = opts;
	const activity = liveActivity?.trim();

	if (isRunning) {
		if (activity && !INVALID_ACTIVITY.has(activity)) {
			const matchingTool = findLastToolByName(conversation, activity);
			if (matchingTool) {
				return formatToolStatus(matchingTool, accessor, true);
			}
			const resolved = resolveBuiltinToolNameLoose(activity) as BuiltinToolName | undefined;
			const verb = resolved ? RUNNING_VERBS[resolved] : undefined;
			return verb ?? activity;
		}
		return 'Planning next moves';
	}

	const lastTool = findLastToolMessage(conversation);
	if (lastTool) {
		return formatToolStatus(lastTool, accessor, false);
	}

	return undefined;
};

export const getSubAgentToolActivityLabel = (
	msg: ChatMessage & { role: 'tool' },
	accessor: ReturnType<typeof useAccessor>,
): string | undefined => {
	if (msg.type === 'invalid_params' || msg.type === 'tool_request') return undefined;
	return formatToolStatus(msg, accessor, msg.type === 'running_now');
};
