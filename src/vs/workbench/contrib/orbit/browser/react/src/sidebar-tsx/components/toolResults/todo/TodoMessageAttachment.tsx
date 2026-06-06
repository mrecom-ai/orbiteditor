/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { TodoItem } from '../../../../../../../common/chatThreadServiceTypes.js';
import { TodoCompactCard } from './TodoCompactCard.js';

type TodoMessageAttachmentProps = {
	todos: TodoItem[];
};

/** Sticky one-line To-dos preview inside the latest user message while the agent runs. */
export const TodoMessageAttachment = ({ todos }: TodoMessageAttachmentProps) => (
	<TodoCompactCard
		todos={todos}
		variant="bubble"
		defaultExpanded={false}
	/>
);


