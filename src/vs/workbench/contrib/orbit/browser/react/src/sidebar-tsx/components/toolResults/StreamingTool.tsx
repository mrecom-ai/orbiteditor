/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { RawToolCallObj } from '../../../../../../common/sendLLMMessageTypes.js';
import { useAccessor } from '../../../util/services.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { removeMCPToolNamePrefix } from '../../../../../../common/mcpServiceTypes.js';
import { getBasename, getRelative, voidOpenFileFn, pathStringToUri } from '../../utils/fileUtils.js';
import { StrReplaceDiffEditor } from '../../../util/inputs.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ToolHeaderWrapper } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { EditToolChildren } from '../editTool/EditToolChildren.js';
import { titleOfBuiltinToolName, loadingTitleWrapper } from '../../constants/toolTitles.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { CircleSpinner } from '../icons/CircleSpinner.js';
import { LEGACY_TOOL_NAME_MAP } from '../../constants/builtinToolNameToComponent.js';

export const StreamingTool = ({ toolCallSoFar }: { toolCallSoFar: RawToolCallObj }) => {
	const accessor = useAccessor()

	const rawParams = toolCallSoFar?.rawParams ?? {}
	const doneParams = toolCallSoFar?.doneParams ?? []
	const isDone = toolCallSoFar?.isDone ?? false

	const pathStr = (rawParams.path ?? rawParams.uri) as string | undefined
	let uri: URI | undefined
	try {
		if (pathStr && typeof pathStr === 'string') {
			uri = pathStringToUri(pathStr)
		}
	} catch (e) {
		console.warn('Failed to parse path for StreamingTool:', e)
	}

	const toolName = toolCallSoFar.name
	if (!toolName) return null

	const effectiveToolName = LEGACY_TOOL_NAME_MAP[toolName] ?? toolName
	const isEditTool = effectiveToolName === 'StrReplace' || effectiveToolName === 'Write'

	let title: React.ReactNode = 'Tool'
	if (isABuiltinToolName(effectiveToolName)) {
		const toolInfo = (titleOfBuiltinToolName as any)[effectiveToolName]
		title = toolInfo?.running || toolInfo?.proposed || toolInfo?.done || effectiveToolName
	} else {
		title = loadingTitleWrapper(`Calling ${removeMCPToolNamePrefix(toolName)}`)
	}

	const pathDone = doneParams.includes('path') || doneParams.includes('uri')

	let desc1: string = '...'
	if (pathStr) {
		try {
			desc1 = getBasename(pathStringToUri(pathStr).fsPath)
		} catch {
			desc1 = getBasename(pathStr)
		}
	} else if (rawParams.command) {
		desc1 = `"${rawParams.command}"`
	} else if (rawParams.query) {
		desc1 = `"${rawParams.query}"`
	}

	const desc1OnClick = uri ? () => voidOpenFileFn(uri, accessor) : undefined

	const oldString = (rawParams.old_string ?? '') as string
	const newString = (rawParams.new_string ?? '') as string
	const writeContents = (rawParams.contents ?? '') as string
	const legacyBlocks = (rawParams.search_replace_blocks ?? rawParams.new_content ?? '') as string

	const code = effectiveToolName === 'StrReplace'
		? (oldString || newString)
		: effectiveToolName === 'Write'
			? writeContents
			: legacyBlocks

	const canShowStrReplaceDiff = effectiveToolName === 'StrReplace'
		&& oldString.length > 0
		&& doneParams.includes('new_string')

	const contentParamNames = effectiveToolName === 'StrReplace'
		? ['old_string', 'new_string']
		: effectiveToolName === 'Write'
			? ['contents']
			: ['search_replace_blocks', 'new_content']
	const contentDone = contentParamNames.some(name => doneParams.includes(name))

	const hasAnyContent = !!(code && code.length > 0)
	const shouldShowContent = isEditTool && (hasAnyContent || (!isDone && pathDone))

	if (isEditTool) {
		const displayFilename = desc1 && desc1 !== '...' ? desc1 : (pathDone ? 'Preparing...' : 'Loading...')

		return (
			<EditToolCardWrapper isRunning={true}>
				<div className="flex items-center justify-between px-2.5 py-2 cursor-default" style={{ minHeight: '32px' }}>
					<div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
						<CircleSpinner
							size={12}
							className="text-void-fg-4/70 flex-shrink-0"
						/>
						<span
							className={`text-void-fg-4/85 text-[10px] truncate font-medium ${desc1OnClick ? 'cursor-pointer hover:text-void-fg-2 transition-colors' : ''}`}
							onClick={desc1OnClick}
						>
							<TextShimmer duration={1.2}>
								{displayFilename}
							</TextShimmer>
						</span>
					</div>
				</div>

				{(shouldShowContent || (!isDone && uri)) && uri && (
					<div className="px-2.5 py-1.5" style={{
						borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)',
						background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.25)'
					}}>
						<div className="!select-text cursor-auto">
							<SmallProseWrapper>
								{hasAnyContent && canShowStrReplaceDiff && uri ? (
									<StrReplaceDiffEditor uri={uri} oldString={oldString} newString={newString} />
								) : hasAnyContent ? (
									<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
								) : (
									<div className="text-void-fg-4/60 text-[10px] py-2 animate-pulse flex items-center gap-1.5">
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
										<span className="ml-1">{!pathDone ? 'Determining file...' : !contentDone ? 'Generating code...' : 'Processing...'}</span>
									</div>
								)}
							</SmallProseWrapper>
						</div>
					</div>
				)}
			</EditToolCardWrapper>
		)
	}

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
