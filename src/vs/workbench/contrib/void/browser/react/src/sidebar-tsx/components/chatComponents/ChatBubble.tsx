/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChatMessage, ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName, BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { IsRunningType } from '../../../../../chatThreadService.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import ErrorBoundary from '../../ErrorBoundary.js';
import { UserMessageComponent } from '../messages/UserMessageComponent.js';
import { AssistantMessageComponent } from '../messages/AssistantMessageComponent.js';
import { InvalidTool } from '../toolResults/InvalidTool.js';
import { CanceledTool } from '../toolResults/CanceledTool.js';
import { PendingToolRequest } from './PendingToolRequest.js';
import { Checkpoint } from './Checkpoint.js';
import { MCPToolWrapper } from '../toolResults/MCPToolWrapper.js';
import { builtinToolNameToComponent } from '../../constants/builtinToolNameToComponent.js';
import { ResultWrapper } from '../../types/toolWrapperTypes.js';

export type ChatBubbleProps = {
	chatMessage: ChatMessage,
	messageIdx: number,
	isCommitted: boolean,
	chatIsRunning: IsRunningType,
	threadId: string,
	currCheckpointIdx: number | undefined,
	_scrollToBottom: (() => void) | null,
}

export const ChatBubble = (props: ChatBubbleProps) => {
	return <ErrorBoundary>
		<_ChatBubble {...props} />
	</ErrorBoundary>
}

const _ChatBubble = React.memo(({ threadId, chatMessage, currCheckpointIdx, isCommitted, messageIdx, chatIsRunning, _scrollToBottom }: ChatBubbleProps) => {
	const role = chatMessage.role

	const isCheckpointGhost = messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning // whether to show as gray (if chat is running, for good measure just dont show any ghosts)

	if (role === 'user') {
		return <UserMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			currCheckpointIdx={currCheckpointIdx}
			messageIdx={messageIdx}
			_scrollToBottom={_scrollToBottom}
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

		// Determine which wrapper to use
		const toolName = chatMessage.name
		const isBuiltInTool = isABuiltinToolName(toolName)

		// Get the appropriate wrapper component
		let ToolResultWrapper: ResultWrapper<ToolName> | undefined
		if (isBuiltInTool) {
			const toolComponent = builtinToolNameToComponent[toolName]
			ToolResultWrapper = toolComponent?.resultWrapper as ResultWrapper<ToolName> | undefined
		} else {
			ToolResultWrapper = MCPToolWrapper as ResultWrapper<ToolName>
		}

		// Render tool with error boundary
		if (!ToolResultWrapper) {
			console.warn(`No tool wrapper found for tool: ${toolName}`)
			return null
		}

		// Special handling for edit_file and rewrite_file: always use card design
		const useCardDesignForToolRequest = toolName === 'edit_file' || toolName === 'rewrite_file'

		return (
			<div className={`transition-opacity duration-300 ease-in-out ${isCheckpointGhost ? 'opacity-50' : 'opacity-100'}`}>
				<ErrorBoundary>
					{chatMessage.type === 'tool_request' && !useCardDesignForToolRequest
						? <PendingToolRequest toolMessage={chatMessage} threadId={threadId} />
						: <ToolResultWrapper
							toolMessage={chatMessage}
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
