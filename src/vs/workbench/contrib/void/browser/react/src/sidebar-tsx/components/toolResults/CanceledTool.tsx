/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';

export const CanceledTool = ({ toolName, mcpServerName }: { toolName: ToolName, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'rejected', mcpServerName })
	const desc1 = ''
	const statusIconMeta = getToolStatusIconMeta({ name: toolName, type: 'rejected', mcpServerName })
	const isRejected = true
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
	}
	return <ToolHeaderWrapper {...componentParams} />
}
