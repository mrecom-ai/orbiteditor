/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../../base/common/uri.js';
import { useAccessor } from '../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from './toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../components/toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../components/toolWrappers/ToolChildrenWrapper.js';
import { ListableToolItem } from '../components/toolWrappers/ListableToolItem.js';
import { SmallProseWrapper } from '../components/wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../markdown/ChatMarkdownRender.js';
import { voidOpenFileFn, getRelative } from '../utils/fileUtils.js';
import { ResultWrapper } from '../types/toolWrapperTypes.js';
/** Built-in directory listing tools removed from the agent API; kept for historical chat threads only. */
export const REMOVED_DIRECTORY_LISTING_TOOL_NAMES = ['ls_dir', 'get_dir_tree'] as const
export type RemovedDirectoryListingToolName = (typeof REMOVED_DIRECTORY_LISTING_TOOL_NAMES)[number]

export const isRemovedDirectoryListingToolName = (toolName: string): toolName is RemovedDirectoryListingToolName => {
	return (REMOVED_DIRECTORY_LISTING_TOOL_NAMES as readonly string[]).includes(toolName)
}

const GetDirTreeLegacyWrapper: ResultWrapper<string> = ({ toolMessage }) => {
	const accessor = useAccessor()
	const title = getTitle(toolMessage)
	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)

	if (toolMessage.type === 'tool_request') return null

	const isRejected = toolMessage.type === 'rejected'
	const { params } = toolMessage
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1Info,
		isError: false,
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
	}

	if (params && 'uri' in params && params.uri) {
		const rel = getRelative(params.uri as URI, accessor)
		if (rel) componentParams.info = `Only search in ${rel}`
	}

	if (toolMessage.type === 'success') {
		const { result } = toolMessage as { result: { str: string } }
		componentParams.children = <ToolChildrenWrapper>
			<SmallProseWrapper>
				<ChatMarkdownRender
					string={`\`\`\`\n${result.str}\n\`\`\``}
					chatMessageLocation={undefined}
					isApplyEnabled={false}
					isLinkDetectionEnabled={true}
				/>
			</SmallProseWrapper>
		</ToolChildrenWrapper>
	} else if (toolMessage.type === 'tool_error') {
		componentParams.desc1 = typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? '')
		componentParams.isError = true
	} else if (toolMessage.type === 'running_now') {
		componentParams.isRunning = true
	}

	return <ToolHeaderWrapper {...componentParams} />
}

const LsDirLegacyWrapper: ResultWrapper<string> = ({ toolMessage }) => {
	const accessor = useAccessor()
	const title = getTitle(toolMessage)
	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)

	if (toolMessage.type === 'tool_request') return null

	const isRejected = toolMessage.type === 'rejected'
	const { params } = toolMessage
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1Info,
		isError: false,
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
	}

	if (params && 'uri' in params && params.uri) {
		const rel = getRelative(params.uri as URI, accessor)
		if (rel) componentParams.info = `Only search in ${rel}`
	}

	if (toolMessage.type === 'success') {
		const { result } = toolMessage as {
			result: {
				children?: { name: string; uri: URI; isDirectory: boolean }[] | null
				hasNextPage?: boolean
				itemsRemaining?: number
			}
		}
		componentParams.numResults = result.children?.length
		componentParams.hasNextPage = result.hasNextPage
		componentParams.children = !result.children || result.children.length === 0 ? undefined
			: <ToolChildrenWrapper>
				{result.children.map((child, i) => (
					<ListableToolItem
						key={i}
						name={`${child.name}${child.isDirectory ? '/' : ''}`}
						className='w-full overflow-auto'
						onClick={() => { voidOpenFileFn(child.uri, accessor) }}
					/>
				))}
				{result.hasNextPage &&
					<ListableToolItem
						name={`Results truncated (${result.itemsRemaining} remaining).`}
						isSmall={true}
						className='w-full overflow-auto'
					/>
				}
			</ToolChildrenWrapper>
	} else if (toolMessage.type === 'tool_error') {
		componentParams.desc1 = typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? '')
		componentParams.isError = true
	} else if (toolMessage.type === 'running_now') {
		componentParams.isRunning = true
	}

	return <ToolHeaderWrapper {...componentParams} />
}

export const removedDirectoryListingToolRenderers: Record<RemovedDirectoryListingToolName, ResultWrapper<string>> = {
	get_dir_tree: GetDirTreeLegacyWrapper,
	ls_dir: LsDirLegacyWrapper,
}

export const getRemovedDirectoryListingToolRenderer = (toolName: string): ResultWrapper<string> | undefined => {
	if (!isRemovedDirectoryListingToolName(toolName)) return undefined
	return removedDirectoryListingToolRenderers[toolName]
}