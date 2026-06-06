/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { useAccessor, useChatThreadsStreamState } from '../../../util/services.js';
import { RawToolCallObj } from '../../../../../../common/sendLLMMessageTypes.js';
import { builtinToolNames, isLLMHiddenBuiltinToolName, resolveBuiltinToolNameLoose } from '../../../../../../common/prompt/prompts.js';
import ErrorBoundary from '../../ErrorBoundary.js';
import { ChatBubble } from '../chatComponents/ChatBubble.js';
import { StreamingTool } from '../toolResults/StreamingTool.js';
import { AgentStatusLine } from '../wrappers/AgentStatusLine.js';
import { ErrorDisplay } from '../../ErrorDisplay.js';
import { WarningBox } from '../../../orbit-settings-tsx/WarningBox.js';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../../../orbitSettingsPane.js';

type StreamingMessagePaneProps = {
	threadId: string;
	streamingChatIdx: number;
	currCheckpointIdx: number | undefined;
	shouldAddGapForStreaming: boolean;
	mcpToolNameSet: Set<string>;
};

export const StreamingMessagePane = React.memo(({
	threadId,
	streamingChatIdx,
	currCheckpointIdx,
	shouldAddGapForStreaming,
	mcpToolNameSet,
}: StreamingMessagePaneProps) => {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService');
	const chatThreadsService = accessor.get('IChatThreadService');

	const currThreadStreamState = useChatThreadsStreamState(threadId);
	const isRunning = currThreadStreamState?.isRunning;
	const latestError = currThreadStreamState?.error;
	const { displayContentSoFar, toolCallSoFar, toolCallsSoFar, reasoningSoFar } = currThreadStreamState?.llmInfo ?? {};

	const normalizeToolNameForPrefix = useCallback((name: string) => {
		return name.trim().replace(/[\s-]+/g, '_');
	}, []);

	const isRenderableStreamingTool = useCallback((tool: RawToolCallObj | null | undefined) => {
		if (!tool?.name) return false;
		const toolName = tool.name.trim();
		if (!toolName) return false;
		if (isLLMHiddenBuiltinToolName(toolName)) return false;

		if (resolveBuiltinToolNameLoose(toolName, { mcpToolNames: mcpToolNameSet }) || mcpToolNameSet.has(toolName)) return true;

		const normalized = normalizeToolNameForPrefix(toolName);
		const isBuiltinPrefix = normalized ? builtinToolNames.some(name => name.startsWith(normalized)) : true;
		if (isBuiltinPrefix) return false;

		if (mcpToolNameSet.size > 0) {
			for (const name of mcpToolNameSet) {
				if (name.startsWith(toolName)) return false;
			}
		}

		return false;
	}, [mcpToolNameSet, normalizeToolNameForPrefix]);

	const rawStreamingTools = (toolCallsSoFar && toolCallsSoFar.length > 0)
		? toolCallsSoFar
		: (toolCallSoFar && !toolCallSoFar.isDone ? [toolCallSoFar] : []);

	const streamingToolsToRender = rawStreamingTools.filter(isRenderableStreamingTool);
	const toolIsGenerating = streamingToolsToRender.some(tool => !tool.isDone);
	const hasVisibleStreamingContent = !!(displayContentSoFar || reasoningSoFar);
	const isAwaitingUserAction = isRunning === 'awaiting_user';
	const isWaitingForAIResponse = !!isRunning && !hasVisibleStreamingContent && !toolIsGenerating && !isAwaitingUserAction;

	const currStreamingMessageHTML = (reasoningSoFar || displayContentSoFar) ?
		<div className={shouldAddGapForStreaming ? 'mt-2' : ''}>
			<ChatBubble
				key={'curr-streaming-msg'}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={{
					role: 'assistant',
					displayContent: displayContentSoFar ?? '',
					reasoning: reasoningSoFar ?? '',
					anthropicReasoning: null,
				}}
				messageIdx={streamingChatIdx}
				isCommitted={false}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={null}
			/>
		</div> : null;

	const generatingTools = streamingToolsToRender.map((tool, i) => {
		const toolKey = tool.id
			? `streaming-${tool.id}`
			: (tool.name ? `streaming-${tool.name}-${i}` : `streaming-unknown-${i}`);

		return (
			<ErrorBoundary key={toolKey}>
				<StreamingTool toolCallSoFar={tool} />
			</ErrorBoundary>
		);
	});

	if (!currStreamingMessageHTML && generatingTools.length === 0 && !isWaitingForAIResponse && latestError === undefined) {
		return null;
	}

	return (
		<>
			{currStreamingMessageHTML}
			{generatingTools}
			{isWaitingForAIResponse ? <AgentStatusLine label="Planning next moves" /> : null}
			{latestError === undefined ? null :
				<div className='px-2 my-1'>
					<ErrorDisplay
						message={latestError.message}
						fullError={latestError.fullError}
						onDismiss={() => { chatThreadsService.dismissStreamError(threadId) }}
						showDismiss={true}
					/>
					<WarningBox className='text-sm my-2 mx-4' onClick={() => { commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID) }} text='Open settings' />
				</div>
			}
		</>
	);
});