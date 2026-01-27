/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { CopyButton } from '../../../markdown/ApplyBlockHoverButtons.js';

type WrapperProps<T extends ToolName> = { 
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>, 
	messageIdx: number, 
	threadId: string 
}

/**
 * Generic Tool Wrapper - Simplified rendering for non-builtin tools (including MCP)
 * Shows tool name, status, params, and result in a clean, consistent format
 */
export const GenericToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')

	// Do not show tool_request type - approval buttons are shown separately
	if (toolMessage.type === 'tool_request') return null

	const title = getTitle(toolMessage)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)

	const isRejected = toolMessage.type === 'rejected'
	const isRunning = toolMessage.type === 'running_now'
	const isError = toolMessage.type === 'tool_error'
	const { rawParams, params, name } = toolMessage

	// Format params for display
	let paramsDisplay: string | undefined
	try {
		if (params && Object.keys(params).length > 0) {
			paramsDisplay = JSON.stringify(params, null, 2)
		} else if (rawParams && Object.keys(rawParams).length > 0) {
			paramsDisplay = JSON.stringify(rawParams, null, 2)
		}
	} catch {
		paramsDisplay = undefined
	}

	// Build description line
	let desc1: React.ReactNode = ''
	if (isError && typeof toolMessage.result === 'string') {
		desc1 = toolMessage.result.substring(0, 100) + (toolMessage.result.length > 100 ? '...' : '')
	} else if (toolMessage.mcpServerName) {
		desc1 = toolMessage.mcpServerName
	} else {
		desc1 = name
	}

	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isError,
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
		isRunning,
	}

	// Add copy button for params
	if (paramsDisplay) {
		componentParams.desc2 = <CopyButton codeStr={paramsDisplay} toolTipName="Copy inputs" />
	}

	// Handle different tool states
	if (toolMessage.type === 'success') {
		const { result } = toolMessage
		try {
			// Format result for display
			let resultStr: string
			if (typeof result === 'string') {
				resultStr = result
			} else if (result && typeof result === 'object') {
				// For MCP tools, use the stringifyResult method
				if (toolMessage.mcpServerName) {
					resultStr = mcpService.stringifyResult(result)
				} else {
					resultStr = JSON.stringify(result, null, 2)
				}
			} else {
				resultStr = String(result) || 'No result'
			}

			componentParams.children = (
				<ToolChildrenWrapper>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={`\`\`\`\n${resultStr}\n\`\`\``}
							chatMessageLocation={undefined}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ToolChildrenWrapper>
			)
		} catch (e) {
			componentParams.children = (
				<ToolChildrenWrapper>
					<pre className="text-void-fg-3 text-xs whitespace-pre-wrap">{String(result)}</pre>
				</ToolChildrenWrapper>
			)
		}
	}

	return <ToolHeaderWrapper {...componentParams} />
}
