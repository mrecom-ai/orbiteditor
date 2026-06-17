/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSubAgentConversation } from '../../util/services.js';
import { SubAgentPopup } from '../components/subAgent/SubAgentPopup.js';
import { getTaskToolPopupStatus, isTaskToolRunning, stopTaskTool } from '../components/subAgent/taskToolRuntime.js';

export type SubAgentPopupTarget = {
	toolId: string;
	threadId: string;
};

type SubAgentPopupContextValue = {
	openPopup: (target: SubAgentPopupTarget) => void;
	closePopup: () => void;
	activeTarget: SubAgentPopupTarget | null;
};

const SubAgentPopupContext = createContext<SubAgentPopupContextValue | null>(null);

export const useSubAgentPopup = (): SubAgentPopupContextValue => {
	const ctx = useContext(SubAgentPopupContext);
	if (!ctx) {
		throw new Error('useSubAgentPopup must be used within SubAgentPopupProvider');
	}
	return ctx;
};

const findTaskToolMessage = (
	threadId: string,
	toolId: string,
	accessor: ReturnType<typeof useAccessor>,
): Exclude<ToolMessage<'task'>, { type: 'invalid_params' }> | undefined => {
	const thread = accessor.get('IChatThreadService').state.allThreads[threadId];
	if (!thread) return undefined;
	for (const msg of thread.messages) {
		if (msg.role === 'tool' && msg.name === 'task' && msg.id === toolId && msg.type !== 'invalid_params') {
			return msg as Exclude<ToolMessage<'task'>, { type: 'invalid_params' }>;
		}
	}
	return undefined;
};

const SubAgentPopupHost = ({ target, onClose }: { target: SubAgentPopupTarget; onClose: () => void }) => {
	const accessor = useAccessor();
	useChatThreadsState();
	useChatThreadsStreamState(target.threadId);
	const toolMessage = findTaskToolMessage(target.threadId, target.toolId, accessor);
	const conversation = useSubAgentConversation(target.toolId, target.threadId);

	useEffect(() => {
		if (!toolMessage) onClose();
	}, [toolMessage, onClose]);

	if (!toolMessage) return null;

	const agentType = (toolMessage.rawParams?.subagent_type as string | undefined) || '';
	const description = (toolMessage.rawParams?.description as string | undefined) || agentType;
	const fallbackPrompt = (toolMessage.rawParams?.prompt as string | undefined) || '';

	const isRunning = isTaskToolRunning(toolMessage);
	const popupStatus = getTaskToolPopupStatus(toolMessage);

	const handleStop = useCallback(() => {
		stopTaskTool(accessor, toolMessage, target.threadId, target.toolId);
	}, [accessor, toolMessage, target.toolId, target.threadId]);

	return (
		<SubAgentPopup
			toolId={target.toolId}
			threadId={target.threadId}
			title={description}
			isOpen={true}
			isRunning={isRunning}
			status={popupStatus}
			fallbackPrompt={fallbackPrompt}
			conversation={conversation}
			onClose={onClose}
			onStop={isRunning ? handleStop : undefined}
		/>
	);
};

export const SubAgentPopupProvider = ({ children }: { children: React.ReactNode }) => {
	const [activeTarget, setActiveTarget] = useState<SubAgentPopupTarget | null>(null);

	const openPopup = useCallback((target: SubAgentPopupTarget) => {
		setActiveTarget(target);
	}, []);

	const closePopup = useCallback(() => {
		setActiveTarget(null);
	}, []);

	const value = useMemo(
		() => ({ openPopup, closePopup, activeTarget }),
		[openPopup, closePopup, activeTarget],
	);

	return (
		<SubAgentPopupContext.Provider value={value}>
			{children}
			{activeTarget && (
				<SubAgentPopupHost target={activeTarget} onClose={closePopup} />
			)}
		</SubAgentPopupContext.Provider>
	);
};
