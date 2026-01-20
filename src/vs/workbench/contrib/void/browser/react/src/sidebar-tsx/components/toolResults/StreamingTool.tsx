/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { RawToolCallObj } from '../../../../../../common/sendLLMMessageTypes.js';
import { useAccessor } from '../../../util/services.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { removeMCPToolNamePrefix } from '../../../../../../common/mcpServiceTypes.js';
import { getBasename, voidOpenFileFn, getRelative } from '../../utils/fileUtils.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ToolHeaderWrapper } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { EditToolChildren } from '../editTool/EditToolChildren.js';
import { titleOfBuiltinToolName, loadingTitleWrapper } from '../../constants/toolTitles.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { getFileIcon } from '../../utils/fileIcons.js';
import { CircleSpinner } from '../icons/CircleSpinner.js';

export const StreamingTool = ({ toolCallSoFar }: { toolCallSoFar: RawToolCallObj }) => {
	const accessor = useAccessor()

	// Defensive null checks for streaming state
	const rawParams = toolCallSoFar?.rawParams ?? {}
	const doneParams = toolCallSoFar?.doneParams ?? []
	const isDone = toolCallSoFar?.isDone ?? false

	// Safely parse URI
	let uri: URI | undefined
	try {
		if (rawParams.uri && typeof rawParams.uri === 'string') {
			uri = URI.parse(rawParams.uri)
		}
	} catch (e) {
		console.warn('Failed to parse URI for StreamingTool:', e)
	}

	const toolName = toolCallSoFar.name
	if (!toolName) return null

	const isEditTool = toolName === 'edit_file' || toolName === 'rewrite_file'

	// Get title with proper loading state
	let title: React.ReactNode = 'Tool'
	if (isABuiltinToolName(toolName)) {
		const toolInfo = (titleOfBuiltinToolName as any)[toolName]
		title = toolInfo?.running || toolInfo?.proposed || toolInfo?.done || toolName
	} else {
		// For MCP tools
		title = loadingTitleWrapper(`Calling ${removeMCPToolNamePrefix(toolName)}`)
	}

	const uriDone = doneParams.includes('uri')
	const uriStr = rawParams['uri'] as string | undefined

	// Build desc1 based on what's available
	let desc1: string = '...'
	if (uriStr) {
		try {
			desc1 = getBasename(uriStr)
		} catch {
			desc1 = uriStr
		}
	} else if (rawParams.command) {
		desc1 = `"${rawParams.command}"`
	} else if (rawParams.query) {
		desc1 = `"${rawParams.query}"`
	}

	const desc1OnClick = uri ? () => voidOpenFileFn(uri, accessor) : undefined

	// Get the code being generated - check all possible parameter key variations
	const code = (
		rawParams.search_replace_blocks ??
		rawParams.new_content ??
		rawParams['search_replace_blocks'] ??
		rawParams['new_content'] ??
		''
	) as string

	// Determine content parameter name and streaming state
	const contentParamName = toolName === 'edit_file' ? 'search_replace_blocks' : 'new_content'
	const contentDone = doneParams.includes(contentParamName)

	// Check if we have any content to display (even partial)
	const hasAnyContent = !!(code && code.length > 0)

	// Show content if we have any data OR if we're still streaming (not done yet)
	const shouldShowContent = isEditTool && (hasAnyContent || (!isDone && uriDone))

	// DIAGNOSTIC: Log every render with content details
	console.log('[StreamingTool] Render', {
		toolName,
		codeLength: code.length,
		codePreview: code.substring(0, 50),
		hasAnyContent,
		shouldShowContent,
		isDone,
		contentDone,
		uriDone,
		doneParams,
		timestamp: Date.now()
	})

	// Special handling for edit_file/rewrite_file: use card design matching EditToolCardHeader
	if (isEditTool) {
		// Get clean filename (no path)
		const displayFilename = desc1 && desc1 !== '...' ? desc1 : (uriDone ? 'Preparing...' : 'Loading...')
		
		return (
			<EditToolCardWrapper isRunning={true}>
				{/* Card Header - matching EditToolCardHeader design */}
				<div className="flex items-center justify-between px-2.5 py-2 cursor-default" style={{ minHeight: '32px' }}>
					<div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
						{/* Loading Spinner - ONLY show spinner during streaming, NO file icon */}
						<CircleSpinner 
							size={12} 
							className="text-void-fg-3/70 flex-shrink-0" 
						/>
						
						{/* Filename with shimmer animation - no title prefix */}
						{desc1 && desc1 !== '...' ? (
							<span
								className={`text-void-fg-3/85 text-[10px] truncate font-medium ${desc1OnClick ? 'cursor-pointer hover:text-void-fg-2 transition-colors' : ''}`}
								onClick={desc1OnClick}
							>
								<TextShimmer duration={1.2}>
									{displayFilename}
								</TextShimmer>
							</span>
						) : (
							/* Loading indicator */
							<span className="text-void-fg-3/65 text-[10px] truncate font-medium">
								<TextShimmer duration={1.2}>
									{displayFilename}
								</TextShimmer>
							</span>
						)}
					</div>
				</div>

				{/* Card Content - show during streaming with progressive updates */}
				{(shouldShowContent || (!isDone && uri)) && uri && (
					<div className="px-2.5 py-1.5" style={{
						borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)',
						background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.25)'
					}}>
						<div className="!select-text cursor-auto">
							<SmallProseWrapper>
								{hasAnyContent ? (
									/* Use rewrite format during streaming to avoid diff computation overhead */
									<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
								) : (
									/* Show loading placeholder when waiting for content to stream */
									<div className="text-void-fg-3/60 text-[10px] py-2 animate-pulse flex items-center gap-1.5">
										<div className="w-1 h-1 bg-void-fg-3/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
										<div className="w-1 h-1 bg-void-fg-3/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
										<div className="w-1 h-1 bg-void-fg-3/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
										<span className="ml-1">{!uriDone ? 'Determining file...' : !contentDone ? 'Generating code...' : 'Processing...'}</span>
									</div>
								)}
							</SmallProseWrapper>
						</div>
					</div>
				)}
			</EditToolCardWrapper>
		)
	}

	// For non-edit tools, use the standard ToolHeaderWrapper
	return (
		<ToolHeaderWrapper
			title={title}
			desc1={desc1}
			desc1OnClick={desc1OnClick}
			desc1Info={uri ? getRelative(uri, accessor) : undefined}
			isOpen={hasAnyContent}
			isRunning={true}
		>
			{hasAnyContent && uri ? (
				<ToolChildrenWrapper>
					<EditToolChildren
						uri={uri}
						code={code}
						type={'rewrite'}
					/>
				</ToolChildrenWrapper>
			) : null}
		</ToolHeaderWrapper>
	)
}
