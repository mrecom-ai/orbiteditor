/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolCallParams, BuiltinToolResultType } from '../../../../../../../common/toolsServiceTypes.js';
import { useAccessor, useChatThreadsStreamState } from '../../../../util/services.js';
import { AskQuestionCard } from './AskQuestionCard.js';
import { AskQuestionAnswersSummary } from './AskQuestionAnswersSummary.js';

export const AskQuestionToolWithState = ({
	toolMessage,
	threadId,
}: {
	toolMessage: ToolMessage<'AskQuestion'>;
	threadId: string;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get('IChatThreadService');
	const streamState = useChatThreadsStreamState(threadId);

	const params = toolMessage.params as BuiltinToolCallParams['AskQuestion'];
	const isAwaiting =
		streamState?.isRunning === 'awaiting_user'
		&& streamState?.pendingToolRequestId === toolMessage.id;
	const isStreaming = toolMessage.type === 'running_now';

	if (toolMessage.type === 'success') {
		const result = toolMessage.result as BuiltinToolResultType['AskQuestion'];
		return (
			<AskQuestionAnswersSummary
				questions={params.questions}
				title={params.title}
				answers={result.answers}
				wasSkipped={result.wasSkipped}
			/>
		);
	}

	return (
		<AskQuestionCard
			questions={params.questions}
			title={params.title}
			toolId={toolMessage.id}
			isInteractive={isAwaiting}
			isStreaming={isStreaming}
			onSubmit={(answers) => chatThreadsService.submitAskQuestionAnswer(threadId, toolMessage.id, answers)}
			onSkip={() => chatThreadsService.skipAskQuestion(threadId, toolMessage.id)}
		/>
	);
};