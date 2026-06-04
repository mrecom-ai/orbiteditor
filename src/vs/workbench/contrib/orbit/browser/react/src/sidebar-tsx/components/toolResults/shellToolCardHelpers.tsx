/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolCallParams, BuiltinToolResultType } from '../../../../../../common/toolsServiceTypes.js';

const truncate = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1) + '…');

export type ShellCardMeta = {
	title: string;
	metaTags: string[];
	commandLine: string | null;
	outputText: string;
	statusLine: { icon: 'success' | 'running' | 'error' | 'background' | 'timeout' | 'pattern' | 'sleep'; text: string } | null;
	shellId: string | null;
};

export const getShellCardTitle = (
	toolName: 'Shell' | 'AwaitShell',
	params: BuiltinToolCallParams['Shell'] | BuiltinToolCallParams['AwaitShell'],
): string => {
	if (toolName === 'Shell') {
		const shellParams = params as BuiltinToolCallParams['Shell'];
		if (shellParams.description?.trim()) return shellParams.description.trim();
		const cmd = shellParams.command.trim();
		if (!cmd) return 'Run command';
		const firstLine = cmd.split('\n')[0]?.trim() ?? cmd;
		return truncate(firstLine, 48);
	}
	const awaitParams = params as BuiltinToolCallParams['AwaitShell'];
	if (awaitParams.pattern) return 'Wait for output pattern';
	if (awaitParams.shellId) return 'Poll shell output';
	return 'Await';
};

export const getShellCardMetaTags = (
	toolName: 'Shell' | 'AwaitShell',
	params: BuiltinToolCallParams['Shell'] | BuiltinToolCallParams['AwaitShell'],
): string[] => {
	const tags: string[] = [];
	if (toolName === 'Shell') {
		const shellParams = params as BuiltinToolCallParams['Shell'];
		if (shellParams.workingDirectory) tags.push('cd');
		if (shellParams.blockUntilMs === 0) tags.push('bg');
		else if (shellParams.blockUntilMs > 0) tags.push(`${Math.round(shellParams.blockUntilMs / 1000)}s`);
		if (shellParams.notifyOnOutput) tags.push('notify');
	} else {
		const awaitParams = params as BuiltinToolCallParams['AwaitShell'];
		if (awaitParams.shellId) tags.push('poll');
		else tags.push('sleep');
		if (awaitParams.pattern) tags.push('pattern');
		if (awaitParams.blockUntilMs === 0) tags.push('now');
		else if (awaitParams.blockUntilMs > 0) tags.push(`${Math.round(awaitParams.blockUntilMs / 1000)}s`);
	}
	return tags;
};

export const getShellCardCommandLine = (
	toolName: 'Shell' | 'AwaitShell',
	params: BuiltinToolCallParams['Shell'] | BuiltinToolCallParams['AwaitShell'],
): string | null => {
	if (toolName === 'Shell') {
		const shellParams = params as BuiltinToolCallParams['Shell'];
		return shellParams.command?.trim() || null;
	}
	const awaitParams = params as BuiltinToolCallParams['AwaitShell'];
	if (awaitParams.pattern && awaitParams.shellId) {
		return `# await pattern: ${awaitParams.pattern}`;
	}
	if (awaitParams.shellId) {
		return `# await shell_id=${awaitParams.shellId.slice(0, 8)}…`;
	}
	return `# await ${awaitParams.blockUntilMs}ms`;
};

export const getShellCardOutput = (
	toolMessage: Exclude<ToolMessage<'Shell' | 'AwaitShell'>, { type: 'invalid_params' | 'tool_request' }>,
	liveOutput: string | null,
	resultString: string,
): string => {
	if (toolMessage.type === 'tool_error') {
		return typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? 'Command failed');
	}
	if (toolMessage.type === 'rejected') {
		return 'Command canceled.';
	}
	if (toolMessage.type === 'running_now') {
		return liveOutput ?? '';
	}
	if (toolMessage.type === 'success') {
		return resultString;
	}
	return '';
};

export const getShellCardStatus = (
	toolName: 'Shell' | 'AwaitShell',
	toolMessage: Exclude<ToolMessage<'Shell' | 'AwaitShell'>, { type: 'invalid_params' | 'tool_request' }>,
): ShellCardMeta['statusLine'] => {
	if (toolMessage.type === 'running_now') {
		return { icon: 'running', text: toolName === 'Shell' ? 'Running command…' : 'Awaiting…' };
	}
	if (toolMessage.type === 'tool_error') {
		return { icon: 'error', text: 'Command failed' };
	}
	if (toolMessage.type === 'rejected') {
		return { icon: 'error', text: 'Canceled' };
	}
	if (toolMessage.type !== 'success') return null;

	if (toolName === 'Shell') {
		const result = toolMessage.result as BuiltinToolResultType['Shell'];
		if (result.kind === 'backgrounded') {
			return { icon: 'background', text: `Running in background${result.pid ? ` · pid ${result.pid}` : ''}` };
		}
		if (result.kind === 'done') {
			return { icon: 'success', text: `Finished · exit code ${result.exitCode ?? 0}` };
		}
		return { icon: 'timeout', text: `Still running after ${result.elapsedMs ?? 0}ms` };
	}

	const result = toolMessage.result as BuiltinToolResultType['AwaitShell'];
	if (result.kind === 'notfound') {
		return { icon: 'error', text: result.error ?? 'Shell not found' };
	}
	if (result.matchedPattern) {
		return { icon: 'pattern', text: `Pattern matched · ${result.runningForMs}ms` };
	}
	if (result.kind === 'done') {
		return { icon: 'success', text: `Finished · exit code ${result.exitCode ?? 0}` };
	}
	if (!toolMessage.params.shellId) {
		return { icon: 'sleep', text: `Waited ${result.runningForMs}ms` };
	}
	return { icon: 'timeout', text: `Still running · ${result.runningForMs}ms` };
};

/** Lightweight shell syntax highlighting for the command line */
export const ShellCommandHighlight = ({ command }: { command: string }) => {
	const parts: React.ReactNode[] = [];
	const tokenRe = /(\s+|&&|\|\||\||;|>>?|\$[A-Za-z_][A-Za-z0-9_]*|"[^"]*"|'[^']*'|\S+)/g;
	let match: RegExpExecArray | null;
	let i = 0;
	while ((match = tokenRe.exec(command)) !== null) {
		const token = match[0];
		const key = `t-${i++}`;
		if (/^\s+$/.test(token)) {
			parts.push(token);
			continue;
		}
		if (/^(cd|export|npm|node|yarn|pnpm|bun|python|python3|go|cargo|make|git|docker|kubectl|curl|wget|echo|sleep|cat|ls|mkdir|rm|cp|mv|grep|rg|find|tail|head|chmod|bash|sh|zsh)$/.test(token)) {
			parts.push(<span key={key} className="text-[#E5A07B]">{token}</span>);
		} else if (/^(&&|\|\||\||;|>>?)$/.test(token)) {
			parts.push(<span key={key} className="text-void-fg-4 opacity-70">{token}</span>);
		} else if (/^["']/.test(token)) {
			parts.push(<span key={key} className="text-[#98C379]">{token}</span>);
		} else if (/^\$/.test(token)) {
			parts.push(<span key={key} className="text-[#61AFEF]">{token}</span>);
		} else if (/^-?\d+$/.test(token)) {
			parts.push(<span key={key} className="text-[#61AFEF]">{token}</span>);
		} else {
			parts.push(<span key={key} className="text-void-fg-2">{token}</span>);
		}
	}
	return <>{parts}</>;
};

export const ShellOutputLine = ({ line }: { line: string }) => {
	const trimmed = line.trim();
	let className = 'text-void-fg-3/85 whitespace-pre-wrap break-words';
	if (/Build success|⚡|success in \d+ms/i.test(trimmed)) {
		className = 'text-void-fg-2/95 whitespace-pre-wrap break-words';
	}
	if (/Build complete|✅|✔|passing|Finished · exit/i.test(trimmed)) {
		className = 'text-[#98C379]/95 whitespace-pre-wrap break-words';
	}
	if (/error|failed|Error|FAILED/i.test(trimmed) && !/0 errors/i.test(trimmed)) {
		className = 'text-[#E06C75]/90 whitespace-pre-wrap break-words';
	}
	if (/still (running|alive)|Pattern matched|background/i.test(trimmed)) {
		className = 'text-[#E5C07B]/90 whitespace-pre-wrap break-words';
	}
	return <div className={className}>{line.length === 0 ? '\u00A0' : line}</div>;
};
