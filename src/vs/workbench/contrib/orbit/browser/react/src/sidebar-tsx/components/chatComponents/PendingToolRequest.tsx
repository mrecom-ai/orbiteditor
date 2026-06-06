/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName, BuiltinToolName } from '../../../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../../../common/prompt/prompts.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolRequestAcceptRejectButtons } from './ToolRequestAcceptRejectButtons.js';

const PendingToolCard = ({ toolMessage }: { toolMessage: ToolMessage<ToolName> }) => {
	const accessor = useAccessor()
	const statusIconMeta = getToolStatusIconMeta({ name: toolMessage.name, type: 'tool_request', mcpServerName: toolMessage.mcpServerName })
	const hasParams = 'params' in toolMessage && !!(toolMessage as any).params
	const { desc1, desc1Info } = isABuiltinToolName(toolMessage.name) && hasParams
		? toolNameToDesc(toolMessage.name as BuiltinToolName, (toolMessage as any).params, accessor, toolMessage.rawParams)
		: { desc1: toolMessage.mcpServerName || '', desc1Info: undefined }

	const componentParams: ToolHeaderParams = {
		title: getTitle({ name: toolMessage.name, type: 'tool_request', mcpServerName: toolMessage.mcpServerName }),
		desc1,
		desc1Info,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
		isRejected: false,
		isRunning: false,
		info: 'Awaiting approval',
	}

	return <ToolHeaderWrapper {...componentParams} />
}

export const PendingToolRequest = ({ toolMessage, threadId }: { toolMessage: ToolMessage<ToolName>, threadId: string }) => {
	return (
		<div className="my-0.5 flex flex-col gap-1">
			<PendingToolCard toolMessage={toolMessage} />
			<div className="flex items-center justify-end gap-2 pl-3">
				<ToolRequestAcceptRejectButtons toolName={toolMessage.name} toolId={toolMessage.id} threadId={threadId} />
			</div>
		</div>
	)
}