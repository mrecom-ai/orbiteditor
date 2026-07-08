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
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { ToolHeaderWrapper } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { EditToolChildren } from '../editTool/EditToolChildren.js';
import { titleOfBuiltinToolName, loadingTitleWrapper } from '../../constants/toolTitles.js';
import { resolveLegacyToolName } from '../../constants/legacyToolNameMap.js';
import { EditToolStreamingHeader } from '../editTool/EditToolStreamingHeader.js';
import { EditToolContentPanel } from '../editTool/EditToolContentPanel.js';
import { getEditToolPathParam } from '../editTool/editToolDisplayData.js';
import { computeNonEditStreamingDisplayCode, computeStreamingEditToolCardState } from '../editTool/streamingEditToolState.js';

export const StreamingTool = ({ toolCallSoFar }: { toolCallSoFar: RawToolCallObj }) => {
	const accessor = useAccessor()

	const rawParams = toolCallSoFar?.rawParams ?? {}
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

	const effectiveToolName = resolveLegacyToolName(toolName)
	const editToolCardState = computeStreamingEditToolCardState(toolCallSoFar)
	const fallbackCode = computeNonEditStreamingDisplayCode(toolName, rawParams)

	let title: React.ReactNode = 'Tool'
	if (isABuiltinToolName(effectiveToolName)) {
		const toolInfo = (titleOfBuiltinToolName as any)[effectiveToolName]
		title = toolInfo?.running || toolInfo?.proposed || toolInfo?.done || effectiveToolName
	} else {
		title = loadingTitleWrapper(`Calling ${removeMCPToolNamePrefix(toolName)}`)
	}

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

	const displayCode = editToolCardState?.code ?? fallbackCode
	const hasAnyContent = !!(displayCode && displayCode.length > 0)

	if (editToolCardState) {
		const {
			editToolType,
			code,
			oldString,
			newString,
			displayFilename,
			showFileIcon,
			diffStats,
			contentDependencyKey,
			phase,
			useStreamingCode,
			streamingText,
			isStreamingCode,
			showDiff,
			loadingMessage,
			hasDisplayableContent,
		} = editToolCardState

		return (
			<EditToolCardWrapper isRunning={true}>
				<EditToolStreamingHeader
					uri={uri}
					displayFilename={displayFilename}
					additions={diffStats.additions}
					deletions={diffStats.deletions}
					showFileIcon={showFileIcon}
				/>

				<EditToolContentPanel
					dependencyKey={contentDependencyKey}
					isStreaming={!isDone}
					hideControls={!isDone}
					nonInteractive={!isDone}
					hasDisplayableContent={hasDisplayableContent}
					isRunning={true}
					innerContent={{
						uri,
						type: editToolType,
						code,
						oldString,
						newString,
						phase,
						loadingMessage,
						showDiff,
						useStreamingCode,
						streamingText,
						isStreamingCode,
					}}
				/>
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
						code={displayCode}
						type={'rewrite'}
					/>
				</ToolChildrenWrapper>
			) : null}
		</ToolHeaderWrapper>
	)
}
