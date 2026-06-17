/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import type { SubAgentPopupStatus } from './SubAgentPopup.js';

export type TaskToolMessage = Exclude<ToolMessage<'task'>, { type: 'invalid_params' }>;

export const isTaskToolRunning = (toolMessage: TaskToolMessage): boolean =>
	toolMessage.type === 'running_now'
	|| (toolMessage.type === 'success'
		&& (toolMessage.result as { status?: string } | undefined)?.status === 'background_launched');

export const getTaskToolPopupStatus = (toolMessage: TaskToolMessage): SubAgentPopupStatus => {
	if (isTaskToolRunning(toolMessage)) return 'running';
	if (toolMessage.type === 'rejected') return 'cancelled';
	if (toolMessage.type === 'tool_error') return 'failed';
	if (toolMessage.type === 'success') {
		const status = (toolMessage.result as { status?: string } | undefined)?.status;
		if (status === 'failed') return 'failed';
		if (status === 'cancelled') return 'cancelled';
	}
	return 'completed';
};

export const getTaskToolRejectedStatusLine = (toolMessage: TaskToolMessage): string | undefined => {
	if (toolMessage.type !== 'rejected') return undefined;
	const content = toolMessage.content?.trim();
	return content || 'Stopped by user';
};

/** Stop one sub-agent only — does not abort the parent agent or sibling sub-agents. */
export const stopTaskTool = (
	accessor: { get: (id: string) => unknown },
	_toolMessage: TaskToolMessage,
	threadId: string,
	toolId: string,
): void => {
	(accessor.get('IChatThreadService') as { cancelTaskTool: (threadId: string, toolId: string) => void })
		.cancelTaskTool(threadId, toolId);
};
