/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChevronRight, CirclePlus } from 'lucide-react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { LEGACY_TOOL_NAME_MAP } from '../../constants/builtinToolNameToComponent.js';
import { BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { voidOpenFileFn } from '../../utils/fileUtils.js';
import { CopyButton, useEditToolStreamState } from '../../../markdown/ApplyBlockHoverButtons.js';
import { getApplyBoxId } from '../../../markdown/ChatMarkdownRender.js';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { ToolRequestAcceptRejectButtons } from '../chatComponents/ToolRequestAcceptRejectButtons.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { getFileIcon } from '../../utils/fileIcons.js';
import { CircleSpinner } from '../icons/CircleSpinner.js';

const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-1'>
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
	</div>
}

const getEditToolPath = (params: { path?: URI, uri?: URI } | undefined) => params?.path ?? params?.uri

export const EditToolCardHeader = ({ toolMessage, isRunning, threadId, messageIdx, content, isExpanded, onToggleExpand, hasContent }: {
	toolMessage: { name: string, type: string, params?: { path?: URI, uri?: URI }, rawParams?: Record<string, unknown> },
	isRunning: boolean,
	threadId: string,
	messageIdx: number,
	content: string,
	isExpanded: boolean,
	onToggleExpand: () => void,
	hasContent: boolean
}) => {
	const accessor = useAccessor()

	// Helper function to recursively extract text from React elements
	const extractTextFromReactNode = (node: any): string => {
		if (typeof node === 'string') return node;
		if (typeof node === 'number') return String(node);
		if (!node) return '';

	if (React.isValidElement(node)) {
		// For React elements, try to extract text from props
		const props = (node.props || {}) as any;
		// Check for common text props (verb for StreamingIndicator, children, etc.)
		if (props.verb) return String(props.verb);
		if (props.children) return extractTextFromReactNode(props.children);
		}

		if (Array.isArray(node)) {
			return node.map(extractTextFromReactNode).join('');
		}

		return String(node);
	};

	// Get plain title text - extract from any React element structure
	const titleRaw = getTitle(toolMessage)
	const titleText = extractTextFromReactNode(titleRaw)

	// Handle case where params might be undefined during early streaming
	const mappedToolName = (LEGACY_TOOL_NAME_MAP[toolMessage.name] ?? toolMessage.name) as BuiltinToolName
	const { desc1, desc1Info } = (toolMessage.type !== 'invalid_params' && toolMessage.params)
		? toolNameToDesc(mappedToolName, toolMessage.params as any, accessor, toolMessage.rawParams)
		: { desc1: '', desc1Info: undefined }

	const statusIconMeta = getToolStatusIconMeta(toolMessage)
	const params = toolMessage.type !== 'invalid_params' ? toolMessage.params : undefined
	const filePath = getEditToolPath(params)
	const desc1OnClick = filePath ? () => voidOpenFileFn(filePath, accessor) : undefined

	// Check if this is an awaiting approval state
	const isAwaitingApproval = toolMessage.type === 'tool_request'

	// Get just the filename from desc1 (without path)
	// desc1 is a ReactNode, so we need to handle it properly
	const filenameStr = typeof desc1 === 'string' ? (desc1.split('/').pop() || desc1) : String(desc1 || '')
	const displayFilename = filenameStr || 'Untitled'

	// Determine if we should show shimmer (when running/streaming)
	const shouldShowShimmer = toolMessage.type === 'running_now' || (toolMessage.type === 'tool_request' && isRunning)

	return (
		<>
			<div
				className={`
					flex items-center justify-between gap-2
					px-2.5 py-2
					${hasContent ? 'cursor-pointer' : ''}
					select-none
					transition-all duration-200 group
					relative
				`}
				onClick={hasContent ? onToggleExpand : undefined}
				style={{
					background: isExpanded
						? 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.3)'
						: isAwaitingApproval
							? 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.2)'
							: 'transparent',
					borderBottom: isExpanded
						? '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)'
						: 'none',
					transition: 'background 150ms ease-out, border-bottom 150ms ease-out',
					minHeight: '32px',
				}}
			>
				{/* Left: Loading Spinner (when running) OR Chevron + Icon (when complete) */}
				<div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
					{/* Loading Spinner - shows ONLY when tool is running/streaming */}
					{shouldShowShimmer ? (
						<CircleSpinner 
							size={12} 
							className="text-void-fg-3/70 flex-shrink-0" 
						/>
					) : (
						<>
							{/* Chevron - only visible on hover when has content */}
							{hasContent && toolMessage.type !== 'tool_request' && (
								<ChevronRight
									className={`
										text-void-fg-4/40 
										opacity-0 group-hover:opacity-100
										${isExpanded ? 'rotate-90 !opacity-100 text-void-fg-3/60' : ''}
										transition-all duration-200 ease-out
									`}
									size={10}
									strokeWidth={2.5}
									style={{ marginRight: '-2px' }}
								/>
							)}

							{/* File Icon - shows ONLY when tool is complete (not running) */}
							{getFileIcon(filenameStr, 13)}
						</>
					)}

					{/* Filename with shimmer when running */}
					<div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
						{shouldShowShimmer ? (
							<span
								className={`text-void-fg-3/85 text-[10px] truncate font-medium ${desc1OnClick ? 'cursor-pointer hover:text-void-fg-2 transition-colors' : ''}`}
								onClick={(e) => {
									if (desc1OnClick) {
										e.stopPropagation();
										desc1OnClick();
									}
								}}
								{...(desc1Info ? {
									'data-tooltip-id': 'void-tooltip',
									'data-tooltip-content': desc1Info,
									'data-tooltip-place': 'top',
									'data-tooltip-delay-show': 1000,
								} : {})}
							>
								<TextShimmer duration={1.2}>
									{displayFilename}
								</TextShimmer>
							</span>
						) : (
							<span
								className={`text-void-fg-3/85 text-[10px] truncate font-medium ${desc1OnClick ? 'cursor-pointer hover:text-void-fg-2 transition-colors' : ''}`}
								onClick={(e) => {
									if (desc1OnClick) {
										e.stopPropagation();
										desc1OnClick();
									}
								}}
								{...(desc1Info ? {
									'data-tooltip-id': 'void-tooltip',
									'data-tooltip-content': desc1Info,
									'data-tooltip-place': 'top',
									'data-tooltip-delay-show': 1000,
								} : {})}
							>
								{displayFilename}
							</span>
						)}
					</div>
				</div>

				{/* Right: Action buttons */}
				<div className="flex items-center gap-1.5 flex-shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
					{toolMessage.type === 'tool_request' && (
						<ToolRequestAcceptRejectButtons
							toolName={toolMessage.name}
							toolId={toolMessage.id}
							threadId={threadId}
						/>
					)}
					{toolMessage.type === 'success' && filePath && content && (
						<EditToolHeaderButtons
							applyBoxId={getApplyBoxId({
								threadId: threadId,
								messageIdx: messageIdx,
								tokenIdx: 'N/A',
							})}
							uri={filePath}
							codeStr={content}
							threadId={threadId}
						/>
					)}
				</div>
			</div>
		</>
	)
}
