/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { removeMCPToolNamePrefix } from '../../../../../../common/mcpServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { CodeChildren } from '../toolWrappers/CodeChildren.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { CopyButton } from '../../../markdown/ApplyBlockHoverButtons.js';

type WrapperProps<T extends ToolName> = { toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>, messageIdx: number, threadId: string }

export const MCPToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')

	// Do not show tool_request type - approval buttons are shown separately
	if (toolMessage.type === 'tool_request') return null

	const title = getTitle(toolMessage)
	const desc1 = removeMCPToolNamePrefix(toolMessage.name)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)

	const isError = false
	const isRejected = toolMessage.type === 'rejected'
	const isRunning = toolMessage.type === 'running_now'
	const { rawParams, params } = toolMessage

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
	if (params) {
		try {
			const paramsStr = JSON.stringify(params, null, 2)
			componentParams.desc2 = <CopyButton codeStr={paramsStr} toolTipName={`Copy inputs: ${paramsStr}`} />
		} catch (e) {
			console.warn('Failed to stringify MCP tool params:', e)
		}
	}

	componentParams.info = !toolMessage.mcpServerName ? 'MCP tool not found' : undefined

	// Handle different tool states
	if (toolMessage.type === 'success') {
		const { result } = toolMessage
		try {
			const resultStr = result ? mcpService.stringifyResult(result) : 'null'
			componentParams.children = (
				<ToolChildrenWrapper>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={`\`\`\`json\n${resultStr}\n\`\`\``}
							chatMessageLocation={undefined}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ToolChildrenWrapper>
			)
		} catch (e) {
			console.error('Error rendering MCP tool result:', e)
			componentParams.children = (
				<ToolChildrenWrapper>
					<CodeChildren>
						{String(result)}
					</CodeChildren>
				</ToolChildrenWrapper>
			)
		}
	}
	else if (toolMessage.type === 'tool_error') {
		const { result } = toolMessage
		componentParams.desc1 = typeof result === 'string' ? result : String(result)
		componentParams.isError = true
	}
	else if (toolMessage.type === 'running_now') {
		// Show loading state - icon already shows spinner
		componentParams.isRunning = true
	}

	return <ToolHeaderWrapper {...componentParams} />
}
