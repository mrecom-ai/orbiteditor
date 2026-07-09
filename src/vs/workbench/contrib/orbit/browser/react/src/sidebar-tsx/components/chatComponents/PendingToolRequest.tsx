/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { motion } from 'framer-motion';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useChatThreadsStreamState } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolApprovalCardShell } from '../toolApproval/ToolApprovalCardShell.js';
import { ToolApprovalPreview, isBrowserOpenToolRequest } from '../toolApproval/ToolApprovalPreview.js';
import { ToolApprovalActions } from '../toolApproval/ToolApprovalActions.js';
import { toolApprovalTheme } from '../toolApproval/toolApprovalTheme.js';

/**
 * Pending (awaiting-approval) tool request card for non-edit tools.
 *
 * Replaces the old flat `ToolHeaderWrapper` row + tiny buttons with the
 * unified `ToolApprovalCardShell`: header (icon + title + awaiting badge) →
 * tool-specific preview body → footer (Deny / Approve / auto-approve toggle).
 *
 * ChatBubble still routes here for `tool_request` messages that are NOT
 * StrReplace / Write / AskQuestion. The backend approval flow is unchanged.
 */
export const PendingToolRequest = ({ toolMessage, threadId }: { toolMessage: ToolMessage<ToolName>, threadId: string }) => {
	const streamState = useChatThreadsStreamState(threadId);

	const isAwaiting = streamState?.isRunning === 'awaiting_user';
	const pendingToolRequestId = isAwaiting ? streamState.pendingToolRequestId : undefined;
	// This card is "active" (highlighted) when it's the one the user must act on.
	const isActive = isAwaiting && pendingToolRequestId === toolMessage.id;

	const statusIconMeta = getToolStatusIconMeta({
		name: toolMessage.name,
		type: 'tool_request',
		mcpServerName: toolMessage.mcpServerName,
	});
	const title = getTitle(toolMessage);

	const isBrowserOpen = isBrowserOpenToolRequest(toolMessage);

	const header = (
		<div
			className="flex items-center gap-2 px-3 py-2 select-none"
			style={{ color: toolApprovalTheme.fg }}
		>
			{statusIconMeta?.icon && (
				<span
					className="flex-shrink-0"
					data-tooltip-id="void-tooltip"
					data-tooltip-content={statusIconMeta.tooltip}
					data-tooltip-place="top"
				>
					{statusIconMeta.icon}
				</span>
			)}
			<span
				className="text-[12px] font-medium flex-shrink-0 truncate"
				style={{ color: toolApprovalTheme.fg }}
			>
				{title}
			</span>
			<span className="ml-auto flex-shrink-0">
				<span
					className="text-[10.5px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
					style={{
						color: toolApprovalTheme.awaitingBadgeFg,
						background: toolApprovalTheme.awaitingBadgeBg,
						border: `1px solid ${toolApprovalTheme.subtleDivider}`,
					}}
				>
					Awaiting approval
				</span>
			</span>
		</div>
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, ease: 'easeOut' }}
		>
			<ToolApprovalCardShell
				header={header}
				isActive={isActive}
				footer={
					<ToolApprovalActions
						toolName={toolMessage.name}
						toolId={toolMessage.id}
						threadId={threadId}
						approveLabelOverride={isBrowserOpen ? 'Open browser' : undefined}
						approveAriaOverride={isBrowserOpen ? 'Open the Orbit browser and continue' : undefined}
					/>
				}
			>
				<ToolApprovalPreview toolMessage={toolMessage} />
			</ToolApprovalCardShell>
		</motion.div>
	);
};