/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { CodeChildren } from '../toolWrappers/CodeChildren.js';

export const InvalidTool = ({ toolName, message, mcpServerName }: { toolName: ToolName, message: string, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'invalid_params', mcpServerName })
	const desc1 = 'Invalid parameters'
	const statusIconMeta = getToolStatusIconMeta({ name: toolName, type: 'invalid_params', mcpServerName })
	const isError = true
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isError,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
	}

	componentParams.children = <ToolChildrenWrapper>
		<CodeChildren className='bg-void-bg-3'>
			{message}
		</CodeChildren>
	</ToolChildrenWrapper>
	return <ToolHeaderWrapper {...componentParams} />
}
