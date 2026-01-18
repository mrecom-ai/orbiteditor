/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { ToolName, approvalTypeOfBuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { useAccessor, useChatThreadsStreamState } from '../../../util/services.js';
import { ToolApprovalTypeSwitch } from '../../../void-settings-tsx/Settings.js';

export const ToolRequestAcceptRejectButtons = ({ toolName, toolId, threadId }: { toolName: ToolName, toolId: string, threadId: string }) => {
	// Add safety check for missing tool ID
	if (!toolId) {
		console.warn('ToolRequestAcceptRejectButtons: Missing tool ID for tool:', toolName)
		return null
	}

	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const metricsService = accessor.get('IMetricsService')
	const streamState = useChatThreadsStreamState(threadId)

	const isAwaiting = streamState?.isRunning === 'awaiting_user'
	const pendingToolRequestId = isAwaiting ? streamState.pendingToolRequestId : undefined
	const isDifferentPending = !!(pendingToolRequestId && pendingToolRequestId !== toolId)
	const isDisabled = !isAwaiting || isDifferentPending

	const onAccept = useCallback(() => {
		try { // this doesn't need to be wrapped in try/catch anymore
			chatThreadsService.approveLatestToolRequest(threadId, toolId)
			metricsService.capture('Tool Request Accepted', {})
		} catch (e) { console.error('Error while approving message in chat:', e) }
	}, [chatThreadsService, metricsService, threadId, toolId])

	const onReject = useCallback(() => {
		try {
			chatThreadsService.rejectLatestToolRequest(threadId, toolId)
		} catch (e) { console.error('Error while approving message in chat:', e) }
		metricsService.capture('Tool Request Rejected', {})
	}, [chatThreadsService, metricsService, threadId, toolId])

	const approveButton = (
		<button
			onClick={onAccept}
			disabled={isDisabled}
			className={`
                px-1.5 py-0.5
                bg-[var(--vscode-button-background)]
                text-[var(--vscode-button-foreground)]
                hover:bg-[var(--vscode-button-hoverBackground)]
                rounded
                text-xs font-medium
				${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
		>
			Approve
		</button>
	)

	const cancelButton = (
		<button
			onClick={onReject}
			disabled={isDisabled}
			className={`
                px-1.5 py-0.5
                bg-[var(--vscode-button-secondaryBackground)]
                text-[var(--vscode-button-secondaryForeground)]
                hover:bg-[var(--vscode-button-secondaryHoverBackground)]
                rounded
                text-xs font-medium
				${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
		>
			Cancel
		</button>
	)

	const approvalType = isABuiltinToolName(toolName) ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
	const approvalToggle = approvalType ? <div key={approvalType} className="flex items-center ml-1.5 gap-x-1">
		<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
	</div> : null

	return <div className="flex gap-1.5 items-center flex-wrap">
		{approveButton}
		{cancelButton}
		{approvalToggle}
	</div>
}
