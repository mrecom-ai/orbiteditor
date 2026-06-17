/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor, useChatThreadsStreamState, useSubAgentConversation, useToolProgressOverlay } from '../../../util/services.js';
import { useSubAgentPopup } from '../../contexts/SubAgentPopupContext.js';
import { SubAgentCard } from './SubAgentCard.js';
import { isTaskToolRunning, stopTaskTool } from './taskToolRuntime.js';

type TaskToolResultProps = {
	toolMessage: Exclude<ToolMessage<'task'>, { type: 'invalid_params' }>;
	threadId: string;
};

export const TaskToolResult = React.memo(({ toolMessage, threadId }: TaskToolResultProps) => {
	const accessor = useAccessor();
	const { openPopup } = useSubAgentPopup();
	const streamState = useChatThreadsStreamState(threadId);
	const toolProgressOverlay = useToolProgressOverlay(threadId);
	const conversation = useSubAgentConversation(toolMessage.id, threadId);

	const liveTaskActivity = (toolId: string) =>
		streamState?.toolProgressById?.[toolId] ?? toolProgressOverlay?.[toolId];

	const isRunning = isTaskToolRunning(toolMessage);
	const activity = liveTaskActivity(toolMessage.id) ?? toolMessage.content;

	const handleOpen = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		openPopup({ toolId: toolMessage.id, threadId });
	}, [openPopup, toolMessage.id, threadId]);

	const handleStop = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		stopTaskTool(accessor, toolMessage, threadId, toolMessage.id);
	}, [accessor, toolMessage, threadId]);

	return (
		<SubAgentCard
			toolMessage={toolMessage}
			threadId={threadId}
			isRunning={isRunning}
			liveActivity={activity}
			conversation={conversation}
			onOpen={handleOpen}
			onStop={handleStop}
		/>
	);
});

TaskToolResult.displayName = 'TaskToolResult';
