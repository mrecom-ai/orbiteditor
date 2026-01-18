/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChevronRight, CirclePlus } from 'lucide-react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { voidOpenFileFn } from '../../utils/fileUtils.js';
import { CopyButton, useEditToolStreamState } from '../../../markdown/ApplyBlockHoverButtons.js';
import { getApplyBoxId } from '../../../markdown/ChatMarkdownRender.js';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { ToolRequestAcceptRejectButtons } from '../chatComponents/ToolRequestAcceptRejectButtons.js';

const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, toolName, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string, toolName: 'edit_file' | 'rewrite_file' }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-1'>
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
	</div>
}

export const EditToolCardHeader = ({ toolMessage, isRunning, threadId, messageIdx, content, isExpanded, onToggleExpand, hasContent }: {
	toolMessage: ToolMessage<'edit_file' | 'rewrite_file'>,
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
	const { desc1, desc1Info } = (toolMessage.type !== 'invalid_params' && toolMessage.params)
		? toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
		: { desc1: '', desc1Info: undefined }

	const statusIconMeta = getToolStatusIconMeta(toolMessage)
	const params = toolMessage.type !== 'invalid_params' ? toolMessage.params : undefined
	const desc1OnClick = params?.uri ? () => voidOpenFileFn(params.uri, accessor) : undefined

	return (
		<>
			<div
				className={`
					flex items-center justify-between
					px-3 py-2.5
					${hasContent ? 'cursor-pointer' : ''}
					select-none
					transition-all duration-200 group
				`}
				onClick={hasContent ? onToggleExpand : undefined}
				style={{
					background: hasContent && isExpanded
						? 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.5)'
						: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0)',
					borderBottom: hasContent && isExpanded
						? '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.25)'
						: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0)',
					transition: 'background 200ms ease-out, border-bottom 200ms ease-out'
				}}
			>
				{/* Left: Chevron + Title + Filename */}
				<div className="flex items-center gap-2 min-w-0 overflow-hidden">
					{/* Chevron Icon */}
					<div style={{ width: '12px', height: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{hasContent && toolMessage.type !== 'tool_request' && (
							<ChevronRight
								className={`text-void-fg-4/50 ${isExpanded ? 'rotate-90 text-void-fg-3/70' : 'group-hover:text-void-fg-3/60'}`}
								style={{ transition: 'transform 300ms ease-out, color 200ms ease-out' }}
								size={12}
								strokeWidth={2.5}
							/>
						)}
						{toolMessage.type === 'tool_request' && (
							<CirclePlus size={12} className='text-void-fg-3/60' strokeWidth={2} />
						)}
						{toolMessage.type !== 'tool_request' && !hasContent && statusIconMeta?.icon && (
							<div className="opacity-50" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								{statusIconMeta.icon}
							</div>
						)}
					</div>

					{/* Title and Filename on same line - simple, no shimmer */}
					<div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-[12px]">
						{/* Title */}
						<span className="text-void-fg-3 opacity-70 whitespace-nowrap flex-shrink-0">
							{titleText}
						</span>

						{/* Separator and Filename */}
						{desc1 && (
							<>
								<span className="text-void-fg-3 opacity-50 flex-shrink-0">•</span>
								<span
									className={`text-void-fg-3 opacity-50 truncate ${desc1OnClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
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
									{desc1}
								</span>
							</>
						)}
					</div>
				</div>

				{/* Right: Action buttons */}
				<div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
					{toolMessage.type === 'tool_request' && (
						<ToolRequestAcceptRejectButtons
							toolName={toolMessage.name}
							toolId={toolMessage.id}
							threadId={threadId}
						/>
					)}
					{toolMessage.type === 'success' && params?.uri && content && (
						<EditToolHeaderButtons
							applyBoxId={getApplyBoxId({
								threadId: threadId,
								messageIdx: messageIdx,
								tokenIdx: 'N/A',
							})}
							uri={params.uri}
							codeStr={content}
							toolName={toolMessage.name}
							threadId={threadId}
						/>
					)}
				</div>
			</div>
		</>
	)
}
