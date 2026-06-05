/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { TodoItem } from '../../../../../../../common/chatThreadServiceTypes.js';
import { getTodoDisplayText } from '../../../../../../../common/todoToolHelpers.js';
import { TodoStatusIcon } from './TodoStatusIcon.js';

type TodoRowProps = {
	todo: TodoItem;
	compact?: boolean;
};

export const TodoRow = ({ todo, compact = false }: TodoRowProps) => {
	const isDone = todo.status === 'completed' || todo.status === 'cancelled';
	const isActive = todo.status === 'in_progress';

	return (
		<div className={`flex items-center gap-2 min-w-0 ${compact ? 'min-h-[20px]' : 'min-h-[22px]'}`}>
			<TodoStatusIcon status={todo.status} />
			<span
				className={`text-xs flex-1 min-w-0 truncate ${isDone ? 'line-through opacity-60' : ''}`}
				style={{
					color: isActive ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
					fontWeight: isActive ? 500 : 400,
				}}
			>
				{getTodoDisplayText(todo)}
			</span>
		</div>
	);
};
