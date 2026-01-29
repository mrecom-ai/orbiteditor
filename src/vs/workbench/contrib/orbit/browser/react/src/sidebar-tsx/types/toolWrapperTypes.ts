/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { ToolMessage } from '../../../../../common/chatThreadServiceTypes.js';
import type { ToolName } from '../../../../../common/toolsServiceTypes.js';

export type WrapperProps<T extends ToolName> = {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>,
	messageIdx: number,
	threadId: string
}

export type ResultWrapper<T extends ToolName> = (props: WrapperProps<T>) => React.ReactNode
