/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { useTodoContext } from '../../../contexts/TodoContext.js';
import { TodoCompactCard } from './TodoCompactCard.js';

/** Sticky one-line To-dos preview inside the latest user message while the agent runs. */
export const TodoMessageAttachment = () => {
	const { liveTodos, isAgentRunning } = useTodoContext();

	if (!isAgentRunning || liveTodos.length === 0) {
		return null;
	}

	return (
		<TodoCompactCard
			todos={liveTodos}
			variant="bubble"
			defaultExpanded={false}
		/>
	);
};
