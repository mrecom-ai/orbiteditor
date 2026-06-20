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
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { ToolHeaderWrapper } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { EditToolChildren } from '../editTool/EditToolChildren.js';
import { titleOfBuiltinToolName, loadingTitleWrapper } from '../../constants/toolTitles.js';
import { LEGACY_TOOL_NAME_MAP } from '../../constants/builtinToolNameToComponent.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { VsCodeFileIcon } from '../../utils/fileIcons.js';
import { EditToolDiffStats } from '../editTool/EditToolDiffStats.js';
import { StreamingCodeView } from '../editTool/StreamingCodeView.js';
import { UnifiedDiffView } from '../editTool/UnifiedDiffView.js';
import { EditToolExpandableContent } from '../editTool/EditToolExpandableContent.js';
import { computeDiffStats } from '../editTool/unifiedDiffUtils.js';
import {
	CONTENTS_PARAM_NAMES,
	getEditToolContentType,
	getEditToolPathParam,
	getStrReplaceStreamingContent,
	hasAnyDoneParam,
	hasAnyParam,
	LEGACY_BLOCKS_PARAM_NAMES,
	NEW_STRING_PARAM_NAMES,
	OLD_STRING_PARAM_NAMES,
	PATH_PARAM_NAMES,
	pickStringParam,
} from '../editTool/editToolDisplayData.js';

export const StreamingTool = ({ toolCallSoFar }: { toolCallSoFar: RawToolCallObj }) => {
	const accessor = useAccessor()

	const rawParams = toolCallSoFar?.rawParams ?? {}
	const doneParams = toolCallSoFar?.doneParams ?? []
	const isDone = toolCallSoFar?.isDone ?? false

	const pathParam = getEditToolPathParam(rawParams)
	const pathStr = typeof pathParam === 'string' ? pathParam : undefined
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
	const editToolType = getEditToolContentType(toolName)
	const isEditTool = effectiveToolName === 'StrReplace' || effectiveToolName === 'Write' || editToolType === 'legacy-diff'

	let title: React.ReactNode = 'Tool'
	if (isABuiltinToolName(effectiveToolName)) {
		const toolInfo = (titleOfBuiltinToolName as any)[effectiveToolName]
		title = toolInfo?.running || toolInfo?.proposed || toolInfo?.done || effectiveToolName
	} else {
		title = loadingTitleWrapper(`Calling ${removeMCPToolNamePrefix(toolName)}`)
	}

	const pathDone = hasAnyDoneParam(doneParams, PATH_PARAM_NAMES)

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

	const oldString = pickStringParam(rawParams, OLD_STRING_PARAM_NAMES) ?? ''
	const newString = pickStringParam(rawParams, NEW_STRING_PARAM_NAMES) ?? ''
	const writeContents = pickStringParam(rawParams, CONTENTS_PARAM_NAMES) ?? pickStringParam(rawParams, ['newContent', 'new_content']) ?? ''
	const legacyBlocks = pickStringParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES) ?? ''

	const code = editToolType === 'strReplace'
		? (oldString || newString)
		: editToolType === 'rewrite'
			? writeContents
			: legacyBlocks

	const canShowStrReplaceDiff = editToolType === 'strReplace'
		&& oldString.length > 0
		&& (hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES) || hasAnyParam(rawParams, NEW_STRING_PARAM_NAMES) || isDone)

	const contentDone = editToolType === 'strReplace'
		? hasAnyDoneParam(doneParams, OLD_STRING_PARAM_NAMES) || hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES)
		: editToolType === 'rewrite'
			? hasAnyDoneParam(doneParams, CONTENTS_PARAM_NAMES) || hasAnyDoneParam(doneParams, ['newContent', 'new_content'])
			: hasAnyDoneParam(doneParams, LEGACY_BLOCKS_PARAM_NAMES)

	const hasPath = !!(pathStr && pathStr.length > 0)
	const hasAnyContent = !!(code && code.length > 0)
	const contentsFieldStarted = editToolType === 'rewrite' && (hasAnyParam(rawParams, CONTENTS_PARAM_NAMES) || hasAnyParam(rawParams, ['newContent', 'new_content']))
	const oldStringFieldStarted = editToolType === 'strReplace' && hasAnyParam(rawParams, OLD_STRING_PARAM_NAMES)
	const newStringFieldStarted = editToolType === 'strReplace' && hasAnyParam(rawParams, NEW_STRING_PARAM_NAMES)
	const legacyBlocksFieldStarted = editToolType === 'legacy-diff' && hasAnyParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES)
	const oldStringComplete = hasAnyDoneParam(doneParams, OLD_STRING_PARAM_NAMES)
	const newStringComplete = hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES)

	const streamingContent = editToolType === 'strReplace'
		? getStrReplaceStreamingContent({
			oldString,
			newString,
			oldStringFieldStarted,
			oldStringComplete,
			newStringFieldStarted,
			newStringComplete,
		})
		: editToolType === 'rewrite'
			? writeContents
			: code

	const diffStats = (editToolType === 'strReplace' || editToolType === 'rewrite') && (hasAnyContent || contentsFieldStarted || oldStringFieldStarted || newStringFieldStarted)
		? computeDiffStats(
			editToolType === 'strReplace' ? oldString : '',
			editToolType === 'strReplace' ? newString : writeContents,
		)
		: { additions: 0, deletions: 0 }

	const showStrReplaceDiff = editToolType === 'strReplace' && canShowStrReplaceDiff
	const showWriteDiff = editToolType === 'rewrite' && writeContents.length > 0
	const showEmptyWrite = editToolType === 'rewrite' && contentsFieldStarted && contentDone && writeContents.length === 0

	const hasStartedCodeField = contentsFieldStarted || oldStringFieldStarted || newStringFieldStarted || legacyBlocksFieldStarted
	const isActivelyStreamingCode = !isDone && (
		contentsFieldStarted
		|| oldStringFieldStarted
		|| newStringFieldStarted
		|| legacyBlocksFieldStarted
	)

	const showContentPanel = isEditTool
	const contentDependencyKey = `${effectiveToolName}:${editToolType}:${oldString}:${newString}:${writeContents}:${legacyBlocks}:${isDone}`

	if (isEditTool) {
		const displayFilename = desc1 && desc1 !== '...' ? desc1 : (pathDone || hasPath ? 'Preparing...' : 'Loading...')

		return (
			<EditToolCardWrapper isRunning={true} className="edit-tool-card-streaming">
				<div
					className="flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-default pointer-events-none select-none"
					style={{
						minHeight: '28px',
						borderBottom: showContentPanel
							? '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.12)'
							: 'none',
					}}
				>
					<div className="edit-tool-card-header-main flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
						{(pathDone || hasPath) && (
							<VsCodeFileIcon
								uri={uri}
								filename={displayFilename}
								size={16}
								className="edit-tool-card-header-icon"
							/>
						)}
						<TextShimmer
							className="edit-tool-card-header-filename text-void-fg-4/90 text-[11px] font-medium"
							duration={1.5}
						>
							{displayFilename}
						</TextShimmer>
						<EditToolDiffStats additions={diffStats.additions} deletions={diffStats.deletions} />
					</div>
				</div>

				{showContentPanel && (
					<div className="pointer-events-none select-none">
						<EditToolExpandableContent
							dependencyKey={contentDependencyKey}
							isStreaming={isActivelyStreamingCode}
							defaultExpandState="expanded"
							hideControls={true}
						>
							{(maxHeight) => (
								showStrReplaceDiff ? (
									<UnifiedDiffView
										uri={uri}
										oldString={oldString}
										newString={newString}
										maxHeight={maxHeight}
									/>
								) : showWriteDiff ? (
									<UnifiedDiffView
										uri={uri}
										oldString=""
										newString={writeContents}
										maxHeight={maxHeight}
									/>
								) : showEmptyWrite ? (
									<StreamingCodeView content="" isStreaming={!isDone} emptyLabel="Empty file" />
								) : isActivelyStreamingCode || hasStartedCodeField ? (
									<StreamingCodeView content={streamingContent} isStreaming={!isDone} />
								) : (
									<div className="text-void-fg-4/60 text-[10px] py-3 px-3 animate-pulse flex items-center gap-1.5">
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
										<div className="w-1 h-1 bg-void-fg-4/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
										<span className="ml-1">{!hasPath ? 'Determining file...' : !contentDone && !hasStartedCodeField ? 'Generating code...' : 'Processing...'}</span>
									</div>
								)
							)}
						</EditToolExpandableContent>
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
