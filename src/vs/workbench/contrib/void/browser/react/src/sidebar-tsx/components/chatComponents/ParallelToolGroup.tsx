/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { ChatMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { IsRunningType } from '../../../../../chatThreadService.js';
import { ChatBubble, ChatBubbleProps } from './ChatBubble.js';
import { BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';

type ParallelToolGroupProps = {
	messages: Array<{ message: ChatMessage, index: number }>,
	previousMessages: ChatMessage[],
	threadId: string,
	currCheckpointIdx: number | undefined,
	isRunning: IsRunningType,
	scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>,
	scrollToBottomCallback: (() => void) | null,
}

export const ParallelToolGroup = React.memo(({
	messages,
	previousMessages,
	threadId,
	currCheckpointIdx,
	isRunning,
	scrollContainerRef,
	scrollToBottomCallback,
}: ParallelToolGroupProps) => {
	const [isExpanded, setIsExpanded] = useState(true);

	// Check if all tools in the group are completed (success, error, rejected, or invalid - not running)
	const allToolsCompleted = messages.every(({ index }) => {
		const msg = previousMessages[index];
		if (msg.role !== 'tool') return false;
		// Tool is completed if it's success, error, rejected, or invalid_params (not running_now or tool_request)
		return msg.type === 'success' || msg.type === 'tool_error' || msg.type === 'rejected' || msg.type === 'invalid_params';
	});

	// Check if any tools have errors or invalid params
	const hasErrors = messages.some(({ index }) => {
		const msg = previousMessages[index];
		return msg.role === 'tool' && (msg.type === 'tool_error' || msg.type === 'invalid_params');
	});

	// Count successful vs failed tools
	const toolStats = messages.reduce((acc, { index }) => {
		const msg = previousMessages[index];
		if (msg.role === 'tool') {
			if (msg.type === 'success') acc.success++;
			else if (msg.type === 'tool_error') acc.error++;
			else if (msg.type === 'rejected') acc.rejected++;
			else if (msg.type === 'invalid_params') acc.invalid++;
		}
		return acc;
	}, { success: 0, error: 0, rejected: 0, invalid: 0 });

	// Auto-collapse when all tools complete (only on first completion)
	const [hasCollapsed, setHasCollapsed] = useState(false);
	useEffect(() => {
		if (allToolsCompleted && !hasCollapsed) {
			setIsExpanded(false);
			setHasCollapsed(true);
		}
	}, [allToolsCompleted, hasCollapsed]);

	// Generate smart summary by grouping tool types
	const generateSummary = (): string => {
		const toolCounts: Record<string, number> = {};

		// Only count successful tools for the main summary
		messages.forEach(({ index }) => {
			const msg = previousMessages[index];
			if (msg.role === 'tool' && msg.type === 'success') {
				const toolName = (msg as any).name;
				toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
			}
		});

		// Map tool names to readable summaries
		const summaryParts: string[] = [];

		const toolNameMap: Record<string, (count: number) => string> = {
			'read_file': (count) => `Read ${count} file${count !== 1 ? 's' : ''}`,
			'ls_dir': (count) => `Listed ${count} folder${count !== 1 ? 's' : ''}`,
			'get_dir_tree': (count) => `Listed ${count} tree${count !== 1 ? 's' : ''}`,
			'search_pathnames_only': (count) => `Searched filenames ${count} time${count !== 1 ? 's' : ''}`,
			'search_for_files': (count) => `Searched ${count} time${count !== 1 ? 's' : ''}`,
			'search_in_file': (count) => `Searched in ${count} file${count !== 1 ? 's' : ''}`,
			'create_file_or_folder': (count) => `Created ${count} item${count !== 1 ? 's' : ''}`,
			'delete_file_or_folder': (count) => `Deleted ${count} item${count !== 1 ? 's' : ''}`,
			'edit_file': (count) => `Edited ${count} file${count !== 1 ? 's' : ''}`,
			'rewrite_file': (count) => `Rewrote ${count} file${count !== 1 ? 's' : ''}`,
			'run_command': (count) => `Ran ${count} command${count !== 1 ? 's' : ''}`,
			'run_persistent_command': (count) => `Ran ${count} command${count !== 1 ? 's' : ''}`,
			'read_lint_errors': (count) => `Read errors from ${count} file${count !== 1 ? 's' : ''}`,

			'browser_navigate': (count) => `Navigated ${count} time${count !== 1 ? 's' : ''}`,
			'browser_get_url': (count) => `Got URL ${count} time${count !== 1 ? 's' : ''}`,
			'browser_click': (count) => `Clicked ${count} time${count !== 1 ? 's' : ''}`,
			'browser_type': (count) => `Typed ${count} time${count !== 1 ? 's' : ''}`,
			'browser_fill': (count) => `Filled ${count} field${count !== 1 ? 's' : ''}`,
			'browser_wait_for_selector': (count) => `Waited ${count} time${count !== 1 ? 's' : ''}`,
			'browser_screenshot': (count) => `Captured ${count} screenshot${count !== 1 ? 's' : ''}`,
			'browser_get_content': (count) => `Got content ${count} time${count !== 1 ? 's' : ''}`,
			'browser_extract_text': (count) => `Extracted text ${count} time${count !== 1 ? 's' : ''}`,
			'browser_evaluate': (count) => `Evaluated JS ${count} time${count !== 1 ? 's' : ''}`,
		};

		Object.entries(toolCounts).forEach(([toolName, count]) => {
			if (toolNameMap[toolName]) {
				summaryParts.push(toolNameMap[toolName](count));
			} else {
				// For MCP or unknown tools
				summaryParts.push(`${toolName} (${count})`);
			}
		});

		let summary = summaryParts.length > 0 ? summaryParts.join(', ') : `${messages.length} tool${messages.length !== 1 ? 's' : ''}`;

		// Add error/rejected/invalid info if present
		const statusParts: string[] = [];
		if (toolStats.error > 0) {
			statusParts.push(`${toolStats.error} failed`);
		}
		if (toolStats.rejected > 0) {
			statusParts.push(`${toolStats.rejected} canceled`);
		}
		if (toolStats.invalid > 0) {
			statusParts.push(`${toolStats.invalid} invalid`);
		}

		if (statusParts.length > 0) {
			summary += ` (${statusParts.join(', ')})`;
		}

		return summary;
	};

	const summary = allToolsCompleted ? generateSummary() : '';

	return (
		<div className="flex flex-col">
		{/* Collapsible header - only show when completed */}
		{allToolsCompleted && (
			<div
				className={`flex items-center justify-between gap-1.5 text-[13px] font-medium cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity py-0.5 ${hasErrors ? 'text-void-warning' : 'text-void-fg-3'}`}
				onClick={() => setIsExpanded(!isExpanded)}
				data-tooltip-id='void-tooltip'
				data-tooltip-content={`${toolStats.success} succeeded${toolStats.error > 0 ? `, ${toolStats.error} failed` : ''}${toolStats.rejected > 0 ? `, ${toolStats.rejected} canceled` : ''}${toolStats.invalid > 0 ? `, ${toolStats.invalid} invalid` : ''}`}
				data-tooltip-place='top'
			>
				<span className="truncate flex items-center gap-1.5">
					{hasErrors && <AlertTriangle size={12} className="flex-shrink-0" />}
					{summary}
				</span>
				<ChevronRight
					className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
					size={13}
				/>
			</div>
		)}

			{/* Tool list */}
			<div className={`flex flex-col gap-0.5 ${allToolsCompleted && !isExpanded ? 'hidden' : ''}`}>
				{messages.map(({ index, message }) => {
					// Use stable keys based on message content
					const messageKey = `tool-${index}-${message.role}-${(message as any).name || 'unknown'}`

					return (
						<div key={messageKey}>
							<ChatBubble
								currCheckpointIdx={currCheckpointIdx}
								chatMessage={previousMessages[index]}
								messageIdx={index}
								isCommitted={true}
								chatIsRunning={isRunning}
								threadId={threadId}
								_scrollToBottom={scrollToBottomCallback}
							/>
						</div>
				)
				})}
			</div>
		</div>
	)
});
