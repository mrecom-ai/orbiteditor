/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { useAccessor } from '../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from './toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../components/toolHeaders/ToolHeaderWrapper.js';
import { ResultWrapper } from '../types/toolWrapperTypes.js';
import { RawToolParamsObj } from '../../../../../common/sendLLMMessageTypes.js';

/** Built-in browser automation tools removed from the agent API; kept for historical chat threads only. */
export const REMOVED_BROWSER_TOOL_NAMES = [
	'browser_navigate',
	'browser_click',
	'browser_type',
	'browser_fill',
	'browser_screenshot',
	'browser_get_content',
	'browser_extract_text',
	'browser_evaluate',
	'browser_wait_for_selector',
	'browser_get_url',
	'browser_snapshot',
] as const

export type RemovedBrowserToolName = (typeof REMOVED_BROWSER_TOOL_NAMES)[number]

export const isRemovedBrowserToolName = (toolName: string): toolName is RemovedBrowserToolName => {
	return (REMOVED_BROWSER_TOOL_NAMES as readonly string[]).includes(toolName)
}

const getLegacyBrowserDesc = (toolName: RemovedBrowserToolName, rawParams?: RawToolParamsObj): string => {
	if (!rawParams) return ''
	switch (toolName) {
		case 'browser_navigate':
			return typeof rawParams.url === 'string' ? rawParams.url : ''
		case 'browser_click':
		case 'browser_type':
		case 'browser_fill':
		case 'browser_extract_text':
		case 'browser_wait_for_selector':
			return typeof rawParams.selector === 'string' ? rawParams.selector : ''
		case 'browser_evaluate': {
			const script = typeof rawParams.script === 'string' ? rawParams.script.replace(/\s+/g, ' ').trim() : ''
			return script.length > 80 ? `${script.slice(0, 80)}...` : script
		}
		case 'browser_screenshot':
			return rawParams.full_page === 'true' || rawParams.full_page === true ? 'full page' : 'viewport'
		case 'browser_get_content':
			return 'current page'
		case 'browser_get_url':
			return 'current URL'
		case 'browser_snapshot':
			return rawParams.interesting_only === 'false' || rawParams.interesting_only === false ? 'full DOM' : 'interactive elements'
		default:
			return ''
	}
}

const RemovedBrowserToolLegacyWrapper: ResultWrapper<string> = ({ toolMessage }) => {
	const accessor = useAccessor()
	const title = getTitle(toolMessage)
	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)

	if (toolMessage.type === 'tool_request') return null

	const isRejected = toolMessage.type === 'rejected'
	const legacyDesc = isRemovedBrowserToolName(toolMessage.name)
		? getLegacyBrowserDesc(toolMessage.name, toolMessage.rawParams)
		: ''

	const componentParams: ToolHeaderParams = {
		title,
		desc1: desc1 || legacyDesc,
		desc1Info,
		isError: toolMessage.type === 'tool_error',
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
		info: 'Browser automation tool (removed)',
	}

	if (toolMessage.type === 'tool_error') {
		componentParams.desc1 = typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? '')
	} else if (toolMessage.type === 'running_now') {
		componentParams.isRunning = true
	}

	return <ToolHeaderWrapper {...componentParams} />
}

export const removedBrowserToolRenderers: Record<RemovedBrowserToolName, ResultWrapper<string>> = {
	browser_navigate: RemovedBrowserToolLegacyWrapper,
	browser_click: RemovedBrowserToolLegacyWrapper,
	browser_type: RemovedBrowserToolLegacyWrapper,
	browser_fill: RemovedBrowserToolLegacyWrapper,
	browser_screenshot: RemovedBrowserToolLegacyWrapper,
	browser_get_content: RemovedBrowserToolLegacyWrapper,
	browser_extract_text: RemovedBrowserToolLegacyWrapper,
	browser_evaluate: RemovedBrowserToolLegacyWrapper,
	browser_wait_for_selector: RemovedBrowserToolLegacyWrapper,
	browser_get_url: RemovedBrowserToolLegacyWrapper,
	browser_snapshot: RemovedBrowserToolLegacyWrapper,
}

export const getRemovedBrowserToolRenderer = (toolName: string): ResultWrapper<string> | undefined => {
	if (!isRemovedBrowserToolName(toolName)) return undefined
	return removedBrowserToolRenderers[toolName]
}