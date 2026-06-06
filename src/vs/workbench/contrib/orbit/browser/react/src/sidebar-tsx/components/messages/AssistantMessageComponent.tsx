/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChatMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ChatMarkdownRender, ChatMessageLocation } from '../../../markdown/ChatMarkdownRender.js';
import { useAccessor } from '../../../util/services.js';
import { ProseWrapper } from '../wrappers/ProseWrapper.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ReasoningWrapper } from './ReasoningWrapper.js';

const EMPTY_MESSAGE_PLACEHOLDER = '(empty message)';

const isDisplayContentEmpty = (displayContent: string | undefined | null): boolean => {
	const trimmed = displayContent?.trim() ?? '';
	return trimmed.length === 0 || trimmed === EMPTY_MESSAGE_PLACEHOLDER;
};

export const AssistantMessageComponent = React.memo(({ chatMessage, isCheckpointGhost, isCommitted, messageIdx }: { chatMessage: ChatMessage & { role: 'assistant' }, isCheckpointGhost: boolean, messageIdx: number, isCommitted: boolean }) => {

	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')

	const reasoningStr = chatMessage.reasoning?.trim() || null
	const hasReasoning = !!reasoningStr
	const hasDisplayContent = !isDisplayContentEmpty(chatMessage.displayContent)
	const isDoneReasoning = hasDisplayContent
	const thread = chatThreadsService.getCurrentThread()


	const chatMessageLocation: ChatMessageLocation = {
		threadId: thread.id,
		messageIdx: messageIdx,
	}

	if (!hasDisplayContent && !hasReasoning) return null

	return <div className={`w-full ${isCheckpointGhost ? 'opacity-50' : ''}`}>
		{/* reasoning token */}
		{hasReasoning &&
			<div className={`mb-2 last:mb-0 ${isCheckpointGhost ? 'opacity-50' : ''}`}>
				<ReasoningWrapper isDoneReasoning={isDoneReasoning} isStreaming={!isCommitted} reasoningContentLength={reasoningStr?.length ?? 0}>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={reasoningStr}
							chatMessageLocation={chatMessageLocation}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ReasoningWrapper>
			</div>
		}

		{/* assistant message */}
		{hasDisplayContent &&
			<div className={isCheckpointGhost ? 'opacity-50' : ''}>
				<ProseWrapper>
					<ChatMarkdownRender
						string={chatMessage.displayContent || ''}
						chatMessageLocation={chatMessageLocation}
						isApplyEnabled={true}
						isLinkDetectionEnabled={true}
					/>
				</ProseWrapper>
			</div>
		}
	</div>

});