/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { ToolName, approvalTypeOfBuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { useAccessor, useChatThreadsStreamState } from '../../../util/services.js';
import { ToolApprovalTypeSwitch } from '../../../orbit-settings-tsx/Settings.js';
import { useIsReadOnlyChat } from '../../contexts/ReadOnlyChatContext.js';

export const ToolRequestAcceptRejectButtons = ({ toolName, toolId, threadId }: { toolName: ToolName, toolId: string, threadId: string }) => {
	const isReadOnlyChat = useIsReadOnlyChat();
	const accessor = useAccessor();
	const chatThreadsService = accessor.get('IChatThreadService');
	const metricsService = accessor.get('IMetricsService');
	const streamState = useChatThreadsStreamState(threadId);

	const isAwaiting = streamState?.isRunning === 'awaiting_user';
	const pendingToolRequestId = isAwaiting ? streamState.pendingToolRequestId : undefined;
	const isDifferentPending = !!(pendingToolRequestId && pendingToolRequestId !== toolId);
	const isDisabled = !isAwaiting || isDifferentPending;

	const onAccept = useCallback(() => {
		try {
			chatThreadsService.approveLatestToolRequest(threadId, toolId);
			metricsService.capture('Tool Request Accepted', {});
		} catch (e) { console.error('Error while approving message in chat:', e); }
	}, [chatThreadsService, metricsService, threadId, toolId]);

	const onReject = useCallback(() => {
		try {
			chatThreadsService.rejectLatestToolRequest(threadId, toolId);
		} catch (e) { console.error('Error while approving message in chat:', e); }
		metricsService.capture('Tool Request Rejected', {});
	}, [chatThreadsService, metricsService, threadId, toolId]);

	if (isReadOnlyChat) return null;

	if (!toolId) {
		console.warn('ToolRequestAcceptRejectButtons: Missing tool ID for tool:', toolName);
		return null;
	}

	const approveButton = (
		<button
			onClick={onAccept}
			disabled={isDisabled}
			className={`
				relative
				px-2.5 py-0.5
				rounded
				text-[9.5px] font-semibold
				transition-all duration-150 ease-out
				whitespace-nowrap
				${isDisabled
					? 'opacity-30 cursor-not-allowed'
					: 'hover:brightness-110 active:scale-[0.96]'
				}
			`}
			style={{
				background: 'var(--vscode-button-background)',
				color: 'var(--vscode-button-foreground)',
				border: 'none',
				lineHeight: '18px',
			}}
			onMouseEnter={(e) => {
				if (!isDisabled) {
					e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)'
				}
			}}
			onMouseLeave={(e) => {
				if (!isDisabled) {
					e.currentTarget.style.background = 'var(--vscode-button-background)'
				}
			}}
		>
			Approve
		</button>
	)

	const cancelButton = (
		<button
			onClick={onReject}
			disabled={isDisabled}
			className={`
				relative
				px-2.5 py-0.5
				rounded
				text-[9.5px] font-semibold
				transition-all duration-150 ease-out
				whitespace-nowrap
				${isDisabled
					? 'opacity-30 cursor-not-allowed'
					: 'hover:brightness-110 active:scale-[0.96]'
				}
			`}
			style={{
				background: 'var(--vscode-button-secondaryBackground)',
				color: 'var(--vscode-button-secondaryForeground)',
				border: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.3)',
				lineHeight: '18px',
			}}
			onMouseEnter={(e) => {
				if (!isDisabled) {
					e.currentTarget.style.background = 'var(--vscode-button-secondaryHoverBackground)'
					e.currentTarget.style.borderColor = 'rgba(var(--vscode-void-border-2-rgb, 96, 96, 96), 0.4)'
				}
			}}
			onMouseLeave={(e) => {
				if (!isDisabled) {
					e.currentTarget.style.background = 'var(--vscode-button-secondaryBackground)'
					e.currentTarget.style.borderColor = 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.3)'
				}
			}}
		>
			Cancel
		</button>
	)

	const approvalType = isABuiltinToolName(toolName) ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
	const approvalToggle = approvalType ? (
		<div
			key={approvalType}
			className="flex items-center ml-1.5 pl-2 gap-x-1"
			style={{
				borderLeft: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.25)',
				height: '18px',
			}}
		>
			<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
		</div>
	) : null

	return (
		<div className="flex gap-1.5 items-center flex-wrap">
			{approveButton}
			{cancelButton}
			{approvalToggle}
		</div>
	)
}
