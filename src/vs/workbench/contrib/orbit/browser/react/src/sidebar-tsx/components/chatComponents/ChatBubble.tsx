/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChatMessage, TodoItem } from '../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { IsRunningType } from '../../../../../chatThreadService.js';
import { isLLMHiddenBuiltinToolName, resolveBuiltinToolNameLoose } from '../../../../../../common/prompt/prompts.js';
import ErrorBoundary from '../../ErrorBoundary.js';
import { UserMessageComponent } from '../messages/UserMessageComponent.js';
import { AssistantMessageComponent } from '../messages/AssistantMessageComponent.js';
import { InvalidTool } from '../toolResults/InvalidTool.js';
import { CanceledTool } from '../toolResults/CanceledTool.js';
import { PendingToolRequest } from './PendingToolRequest.js';
import { Checkpoint } from './Checkpoint.js';
import { GenericToolWrapper } from '../toolResults/GenericToolWrapper.js';
import { builtinToolNameToComponent, LEGACY_TOOL_NAME_MAP } from '../../constants/builtinToolNameToComponent.js';
import { ResultWrapper } from '../../types/toolWrapperTypes.js';

export type ChatBubbleProps = {
	chatMessage: ChatMessage,
	messageIdx: number,
	isCommitted: boolean,
	chatIsRunning: IsRunningType,
	threadId: string,
	currCheckpointIdx: number | undefined,
	_scrollToBottom: (() => void) | null,
	threadTodos?: TodoItem[],
	isAgentRunning?: boolean,
}

export const ChatBubble = (props: ChatBubbleProps) => {
	return <ErrorBoundary>
		<_ChatBubble {...props} />
	</ErrorBoundary>
}

const _ChatBubble = React.memo(({ threadId, chatMessage, currCheckpointIdx, isCommitted, messageIdx, chatIsRunning, _scrollToBottom, threadTodos, isAgentRunning }: ChatBubbleProps) => {
	const role = chatMessage.role

	const isCheckpointGhost = messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning

	if (role === 'user') {
		return <UserMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			currCheckpointIdx={currCheckpointIdx}
			messageIdx={messageIdx}
			_scrollToBottom={_scrollToBottom}
			threadTodos={threadTodos}
			isAgentRunning={isAgentRunning}
		/>
	}
	else if (role === 'assistant') {
		return <AssistantMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			messageIdx={messageIdx}
			isCommitted={isCommitted}
		/>
	}
	else if (role === 'tool') {
		// Handle invalid params case first
		if (chatMessage.type === 'invalid_params') {
			return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
				<InvalidTool toolName={chatMessage.name} message={chatMessage.content} mcpServerName={chatMessage.mcpServerName} />
			</div>
		}

		// Determine tool type and get appropriate wrapper
		const toolName = chatMessage.name
		
		// Check if this is a builtin tool (by resolved name or direct match)
		const isBlockedHiddenBuiltinError = !chatMessage.mcpServerName && chatMessage.type === 'tool_error' && isLLMHiddenBuiltinToolName(toolName)
		const legacyMappedName = !chatMessage.mcpServerName ? LEGACY_TOOL_NAME_MAP[toolName] : undefined
		const resolvedBuiltinName = !chatMessage.mcpServerName && !isBlockedHiddenBuiltinError ? (legacyMappedName ?? resolveBuiltinToolNameLoose(toolName)) : undefined
		const componentToolName = resolvedBuiltinName
		const effectiveToolName = componentToolName ?? toolName
		const isBuiltInTool = !!componentToolName
		
		// Prepare tool message for rendering (normalize name if it's a builtin)
		const toolMessageForRender = chatMessage

		// Get the appropriate wrapper component
		let ToolResultWrapper: ResultWrapper<string> | undefined
		
		if (isBuiltInTool) {
			// Use builtin component wrapper
			const toolComponent = builtinToolNameToComponent[componentToolName as BuiltinToolName]
			ToolResultWrapper = toolComponent?.resultWrapper as ResultWrapper<string> | undefined
		} else {
			// Use generic wrapper for all non-builtin tools (MCP and unknown)
			ToolResultWrapper = GenericToolWrapper as ResultWrapper<string>
		}

		// Render tool with error boundary
		if (!ToolResultWrapper) {
			console.warn(`No tool wrapper found for tool: ${toolName}, falling back to generic`)
			ToolResultWrapper = GenericToolWrapper as ResultWrapper<string>
		}

		// StrReplace/Write (and legacy edit tools) use card design for tool_request
		const useCardDesignForToolRequest = componentToolName === 'StrReplace' || componentToolName === 'Write'

		return (
			<div className={`transition-opacity duration-300 ease-in-out ${isCheckpointGhost ? 'opacity-50' : 'opacity-100'}`}>
				<ErrorBoundary>
					{chatMessage.type === 'tool_request' && !useCardDesignForToolRequest
						? <PendingToolRequest toolMessage={toolMessageForRender} threadId={threadId} />
						: <ToolResultWrapper
							toolMessage={toolMessageForRender}
							messageIdx={messageIdx}
							threadId={threadId}
						/>
					}
				</ErrorBoundary>
			</div>
		)
	}

	else if (role === 'interrupted_streaming_tool') {
		return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
			<CanceledTool toolName={chatMessage.name} mcpServerName={chatMessage.mcpServerName} />
		</div>
	}

	else if (role === 'checkpoint') {
		return <Checkpoint
			threadId={threadId}
			message={chatMessage}
			messageIdx={messageIdx}
			isCheckpointGhost={isCheckpointGhost}
			threadIsRunning={!!chatIsRunning}
		/>
	}

});
