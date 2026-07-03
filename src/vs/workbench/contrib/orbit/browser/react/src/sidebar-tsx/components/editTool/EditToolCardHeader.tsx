/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { toolNameToDesc } from '../../constants/toolHelpers.js';
import { LEGACY_TOOL_NAME_MAP } from '../../constants/builtinToolNameToComponent.js';
import { BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { voidOpenFileFn } from '../../utils/fileUtils.js';
import { CopyButton, useEditToolStreamState } from '../../../markdown/ApplyBlockHoverButtons.js';
import { getApplyBoxId } from '../../../markdown/ChatMarkdownRender.js';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { VsCodeFileIcon } from '../../utils/fileIcons.js';
import { EditToolDiffStats } from './EditToolDiffStats.js';

const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-1'>
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
	</div>
}

const getEditToolPath = (params: { path?: URI, uri?: URI } | undefined) => params?.path ?? params?.uri

export const EditToolCardHeader = ({ toolMessage, isRunning, threadId, messageIdx, content, additions, deletions, hasContent }: {
	toolMessage: { id: string, name: string, type: string, params?: { path?: URI, uri?: URI }, rawParams?: Record<string, unknown> },
	isRunning: boolean,
	threadId: string,
	messageIdx: number,
	content: string,
	additions?: number,
	deletions?: number,
	hasContent: boolean
}) => {
	const accessor = useAccessor()

	const mappedToolName = (LEGACY_TOOL_NAME_MAP[toolMessage.name] ?? toolMessage.name) as BuiltinToolName
	const { desc1, desc1Info } = (toolMessage.type !== 'invalid_params' && toolMessage.params)
		? toolNameToDesc(mappedToolName, toolMessage.params as any, accessor, toolMessage.rawParams)
		: { desc1: '', desc1Info: undefined }

	const params = toolMessage.type !== 'invalid_params' ? toolMessage.params : undefined
	const filePath = getEditToolPath(params)
	const desc1OnClick = filePath ? () => voidOpenFileFn(filePath, accessor) : undefined

	const isAwaitingApproval = toolMessage.type === 'tool_request'
	const shouldShowShimmer = toolMessage.type === 'running_now' || (toolMessage.type === 'tool_request' && isRunning)

	const filenameStr = typeof desc1 === 'string' ? (desc1.split('/').pop() || desc1) : String(desc1 || '')
	const displayFilename = filenameStr || 'Untitled'

	return (
		<div
			className="flex items-center justify-between gap-2 px-3 py-2 select-none transition-all duration-200 relative"
			style={{
				background: isAwaitingApproval
					? 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.15)'
					: 'transparent',
				borderBottom: hasContent
					? '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)'
					: 'none',
				minHeight: '32px',
			}}
		>
			<div className="edit-tool-card-header-main flex items-center gap-1 min-w-0 overflow-hidden">
				<VsCodeFileIcon
					uri={filePath}
					filename={displayFilename}
					size={16}
					className="edit-tool-card-header-icon"
				/>

				{shouldShowShimmer ? (
					<TextShimmer
						className="edit-tool-card-header-filename text-void-fg-4/90 text-[12px] font-medium"
						duration={1.5}
					>
						{displayFilename}
					</TextShimmer>
				) : (
					<span
						className={`edit-tool-card-header-filename text-void-fg-4/90 text-[12px] truncate font-medium ${desc1OnClick ? 'cursor-pointer hover:text-void-fg-2 transition-colors' : ''}`}
						onClick={desc1OnClick}
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

				<EditToolDiffStats additions={additions ?? 0} deletions={deletions ?? 0} />
			</div>

			<div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
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
	)
}
