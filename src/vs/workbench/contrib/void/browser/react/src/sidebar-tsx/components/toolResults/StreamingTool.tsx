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

	// Special handling for edit_file/rewrite_file: use card design
	if (isEditTool) {
		return (
			<EditToolCardWrapper isRunning={true}>
				{/* Card Header - always shown with shimmer animation and proper minimum height */}
				<div className="flex items-center justify-between px-3 py-3 min-h-[52px] cursor-default">
					<div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
						{/* Show chevron when content is visible or will be visible */}
						{shouldShowContent && (
							<ChevronRight
								className="flex-shrink-0 text-void-fg-4 rotate-90"
								size={14}
							/>
						)}
						<span className="font-medium text-void-fg-1 text-[13px] leading-tight flex-shrink-0 shimmer-text-streaming">{title}</span>
						{desc1 && desc1 !== '...' ? (
							<span
								className={`text-void-fg-3 text-[12px] leading-tight truncate shimmer-text-streaming ${desc1OnClick ? 'hover:text-void-fg-2 transition-colors cursor-pointer' : ''}`}
								onClick={desc1OnClick}
							>
								• {desc1}
							</span>
						) : (
							/* Always show loading indicator when filename not available yet */
							<span className="text-void-fg-4 text-[12px] leading-tight animate-pulse">• {uriDone ? 'Preparing...' : 'Loading file...'}</span>
						)}
					</div>
				</div>

				{/* Card Content - show during streaming with progressive updates */}
				{(shouldShowContent || (!isDone && uri)) && uri && (
					<div className="px-3 py-3 border-t border-void-border-3/20">
						<div className="!select-text cursor-auto">
							<SmallProseWrapper>
								{hasAnyContent ? (
									/* Use rewrite format during streaming to avoid diff computation overhead */
									<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
								) : (
									/* Show loading placeholder when waiting for content to stream */
									<div className="text-void-fg-4 text-[13px] py-3 animate-pulse flex items-center gap-2">
										<div className="w-1.5 h-1.5 bg-void-fg-4 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
										<div className="w-1.5 h-1.5 bg-void-fg-4 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
										<div className="w-1.5 h-1.5 bg-void-fg-4 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
										<span className="ml-1">{!uriDone ? 'Determining file...' : !contentDone ? 'Generating code...' : 'Processing...'}</span>
									</div>
								)}
							</SmallProseWrapper>
						</div>
					</div>
				)}

				{/* Shimmer animation styles - using unique class name to avoid conflicts */}
				<style>{`
					.shimmer-text-streaming {
						background: linear-gradient(
							90deg,
							var(--vscode-void-fg-1) 0%,
							var(--vscode-void-fg-2) 50%,
							var(--vscode-void-fg-1) 100%
						);
						background-size: 200% 100%;
						background-clip: text;
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						animation: shimmer-streaming 2s ease-in-out infinite;
					}
					@keyframes shimmer-streaming {
						0% { background-position: 200% 0; }
						100% { background-position: -200% 0; }
					}
				`}</style>
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
