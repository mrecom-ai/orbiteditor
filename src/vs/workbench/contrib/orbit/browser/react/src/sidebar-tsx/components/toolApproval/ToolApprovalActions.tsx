/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { ToolName, approvalTypeOfBuiltinToolName, ToolApprovalType } from '../../../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { useAccessor, useChatThreadsStreamState } from '../../../util/services.js';
import { useIsReadOnlyChat } from '../../contexts/ReadOnlyChatContext.js';
import { toolApprovalTheme } from './toolApprovalTheme.js';
import {
	getApproveActionLabel,
	getApproveAriaLabel,
	getDenyAriaLabel,
	getApprovalTypeLabel,
} from './toolApprovalLabels.js';
import { ToolApprovalAutoApproveToggle } from './ToolApprovalAutoApproveToggle.js';

/**
 * Footer actions for the tool approval card: Deny + Approve + auto-approve toggle.
 *
 * This is a direct refactor of `ToolRequestAcceptRejectButtons` — same service
 * calls (`approveLatestToolRequest` / `rejectLatestToolRequest`), same metrics
 * events, same `isReadOnlyChat` / `isDisabled` gating. Only the visual layout
 * and typography change.
 */
export type ToolApprovalActionsProps = {
	toolName: ToolName;
	toolId: string;
	threadId: string;
};

export const ToolApprovalActions = ({ toolName, toolId, threadId }: ToolApprovalActionsProps) => {
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
		console.warn('ToolApprovalActions: Missing tool ID for tool:', toolName);
		return null;
	}

	const approvalType: ToolApprovalType | undefined = isABuiltinToolName(toolName)
		? approvalTypeOfBuiltinToolName[toolName]
		: 'MCP tools';

	const approveLabel = getApproveActionLabel(approvalType);
	const approveAria = getApproveAriaLabel(approvalType);
	const denyAria = getDenyAriaLabel(approvalType);

	return (
		<div
			className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap"
			role="group"
			aria-label="Tool approval actions"
		>
			<div className="flex items-center gap-2 flex-shrink-0">
				<button
					type="button"
					onClick={onReject}
					disabled={isDisabled}
					aria-label={denyAria}
					aria-disabled={isDisabled}
					className={`
						px-3 py-1 rounded-md text-[11.5px] font-medium whitespace-nowrap
						transition-all duration-150 ease-out
						${isDisabled
							? 'opacity-40 cursor-not-allowed'
							: 'hover:brightness-110 active:scale-[0.97]'
						}
					`}
					style={{
						background: toolApprovalTheme.buttonSecondaryBg,
						color: toolApprovalTheme.buttonSecondaryFg,
						border: `1px solid ${toolApprovalTheme.subtleDivider}`,
						lineHeight: '20px',
					}}
					onMouseEnter={(e) => {
						if (!isDisabled) {
							e.currentTarget.style.background = toolApprovalTheme.buttonSecondaryHover;
						}
					}}
					onMouseLeave={(e) => {
						if (!isDisabled) {
							e.currentTarget.style.background = toolApprovalTheme.buttonSecondaryBg;
						}
					}}
				>
					Deny
				</button>
				<button
					type="button"
					onClick={onAccept}
					disabled={isDisabled}
					aria-label={approveAria}
					aria-disabled={isDisabled}
					className={`
						px-3.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap
						transition-all duration-150 ease-out
						${isDisabled
							? 'opacity-40 cursor-not-allowed'
							: 'hover:brightness-110 active:scale-[0.97]'
						}
					`}
					style={{
						background: toolApprovalTheme.buttonBg,
						color: toolApprovalTheme.buttonFg,
						border: 'none',
						lineHeight: '20px',
					}}
					onMouseEnter={(e) => {
						if (!isDisabled) {
							e.currentTarget.style.background = toolApprovalTheme.buttonHover;
						}
					}}
					onMouseLeave={(e) => {
						if (!isDisabled) {
							e.currentTarget.style.background = toolApprovalTheme.buttonBg;
						}
					}}
				>
					{approveLabel}
				</button>
			</div>

			<div className="flex items-center gap-2 ml-auto flex-shrink-0 min-w-0">
				{isDifferentPending && (
					<span
						className="text-[10.5px] italic truncate"
						style={{ color: toolApprovalTheme.descFg }}
						data-tooltip-id="void-tooltip"
						data-tooltip-content="Another action is waiting for your response first"
						data-tooltip-place="top"
					>
						Waiting for another action first
					</span>
				)}
				{approvalType && (
					<ToolApprovalAutoApproveToggle
						approvalType={approvalType}
						size="xs"
						label={`Always allow ${getApprovalTypeLabel(approvalType).toLowerCase()}`}
					/>
				)}
			</div>
		</div>
	);
};