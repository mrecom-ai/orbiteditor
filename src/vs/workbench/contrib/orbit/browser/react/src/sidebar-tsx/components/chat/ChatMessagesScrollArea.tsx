/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { ChatMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { IsRunningType } from '../../../../../chatThreadService.js';
import { useChatThreadsStreamState } from '../../../util/services.js';
import { ScrollToBottomContainer } from './ScrollToBottomContainer.js';
import { SidebarChatMessages } from './SidebarChatMessages.js';
import { StreamingMessagePane } from './StreamingMessagePane.js';

type ChatMessagesScrollAreaProps = {
	threadId: string;
	previousMessages: ChatMessage[];
	currCheckpointIdx: number | undefined;
	isRunning: IsRunningType;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	scrollToBottomCallback: () => void;
	stickyOffset: number;
	stickyMessageIndex: number | null;
	userMessageIndices: number[];
	streamingChatIdx: number;
	shouldAddGapForStreaming: boolean;
	mcpToolNameSet: Set<string>;
	className: string;
};

export const ChatMessagesScrollArea = React.memo(({
	threadId,
	previousMessages,
	currCheckpointIdx,
	isRunning,
	scrollContainerRef,
	scrollToBottomCallback,
	stickyOffset,
	stickyMessageIndex,
	userMessageIndices,
	streamingChatIdx,
	shouldAddGapForStreaming,
	mcpToolNameSet,
	className,
}: ChatMessagesScrollAreaProps) => {
	const streamState = useChatThreadsStreamState(threadId);
	// This length only drives `scrollGeneration` (auto-follow-to-bottom while streaming), so it just
	// needs to grow as content arrives. Previously it called JSON.stringify on every tool's rawParams/
	// doneParams on every render (~20x/sec) — for a streaming file write that serialized the entire
	// growing file buffer each time (megabytes/sec of throwaway work), a major freeze source. Instead we
	// sum string-value lengths directly: O(number of params) and zero allocation, while still tracking growth.
	const streamContentLength = (streamState?.llmInfo?.displayContentSoFar?.length ?? 0)
		+ (streamState?.llmInfo?.reasoningSoFar?.length ?? 0)
		+ (streamState?.llmInfo?.toolCallsSoFar?.reduce((sum, tool) => {
			let toolLen = (tool.name?.length ?? 0) + (tool.doneParams?.length ?? 0)
			const raw = tool.rawParams as Record<string, unknown> | undefined | null
			if (raw) {
				for (const key in raw) {
					const value = raw[key]
					toolLen += typeof value === 'string' ? value.length : (value == null ? 0 : 1)
				}
			}
			return sum + toolLen
		}, 0) ?? 0);

	const scrollGeneration = useMemo(
		() => previousMessages.length + streamContentLength + (streamState?.isRunning ? 1 : 0),
		[previousMessages.length, streamContentLength, streamState?.isRunning],
	);

	const hasStreamPane = !!streamState?.isRunning
		|| !!streamState?.error
		|| !!(streamState?.llmInfo?.displayContentSoFar || streamState?.llmInfo?.reasoningSoFar);

	const isHidden = previousMessages.length === 0 && !hasStreamPane

	return (
		<ScrollToBottomContainer
			scrollContainerRef={scrollContainerRef}
			scrollGeneration={scrollGeneration}
			className={`${className}${isHidden ? ' hidden' : ''}`}
		>
			<SidebarChatMessages
				previousMessages={previousMessages}
				threadId={threadId}
				currCheckpointIdx={currCheckpointIdx}
				isRunning={isRunning}
				scrollContainerRef={scrollContainerRef}
				scrollToBottomCallback={scrollToBottomCallback}
				stickyOffset={stickyOffset}
				stickyMessageIndex={stickyMessageIndex}
				userMessageIndices={userMessageIndices}
			/>
			{hasStreamPane ? (
				<StreamingMessagePane
					threadId={threadId}
					streamingChatIdx={streamingChatIdx}
					currCheckpointIdx={currCheckpointIdx}
					shouldAddGapForStreaming={shouldAddGapForStreaming}
					mcpToolNameSet={mcpToolNameSet}
				/>
			) : null}
		</ScrollToBottomContainer>
	);
});