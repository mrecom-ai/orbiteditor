/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { ChatMessage, TodoItem } from '../../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolCallParams } from '../../../../../../../common/toolsServiceTypes.js';
import { applyTodoWrite, normalizeTodoList, todoListsEqual } from '../../../../../../../common/todoToolHelpers.js';

// Re-export so React-layer files can import through this local path
// (tsup bundler externalizes cross-boundary imports to this hub)
export { applyTodoWrite, normalizeTodoList, todoListsEqual };

export type TodoCardPreviewMode = 'bubble' | 'creation' | 'update';

/**
 * Rows shown in the compact To-dos card (collapsed).
 * - bubble: first pending + in_progress at bottom (max 2)
 * - creation: first N pending when nothing started yet
 * - update: trailing pending + in_progress at bottom (Cursor-style)
 */
export const getCardPreviewTodos = (
	todos: TodoItem[],
	options: { maxRows?: number; mode?: TodoCardPreviewMode } = {},
): TodoItem[] => {
	const { maxRows = 4, mode = 'bubble' } = options;
	const list = normalizeTodoList(todos);
	if (!list.length || maxRows <= 0) {
		return [];
	}

	const inProgress = list.find(t => t.status === 'in_progress');
	const pending = list.filter(t => t.status === 'pending');

	if (!inProgress) {
		return pending.slice(0, maxRows);
	}

	if (mode === 'bubble') {
		const rows: TodoItem[] = [];
		const firstPending = pending[0];
		if (firstPending && firstPending.id !== inProgress.id) {
			rows.push(firstPending);
		}
		rows.push(inProgress);
		return rows.slice(0, Math.min(maxRows, 2));
	}

	if (mode === 'creation') {
		const pendingSlice = pending.slice(0, maxRows - 1);
		if (pendingSlice.length) {
			return pendingSlice.length < maxRows
				? pendingSlice
				: [...pendingSlice, inProgress].slice(0, maxRows);
		}
		return [inProgress];
	}

	// update: show newest pending rows, then in_progress last
	const pendingSlice = pending.slice(-Math.max(1, maxRows - 1));
	const rows = [...pendingSlice];
	if (!rows.some(t => t.id === inProgress.id)) {
		rows.push(inProgress);
	}
	return rows.slice(-maxRows);
};

/** Primary todo for the message-bubble one-line preview (in_progress, else first pending, else last completed). */
export const getNextActiveTodo = (todos: TodoItem[]): TodoItem | null => {
	const list = normalizeTodoList(todos);
	if (!list.length) {
		return null;
	}
	const inProgress = list.find(t => t.status === 'in_progress');
	if (inProgress) {
		return inProgress;
	}
	const pending = list.find(t => t.status === 'pending');
	if (pending) {
		return pending;
	}
	const completed = list.filter(t => t.status === 'completed');
	if (completed.length) {
		return completed[completed.length - 1];
	}
	return null;
};

export const getTodoProgress = (todos: TodoItem[]): { completed: number; total: number } => {
	const list = normalizeTodoList(todos);
	return {
		completed: list.filter(t => t.status === 'completed').length,
		total: list.length,
	};
};

/**
 * Message-bubble fraction (Cursor-style): completed plus the single in_progress item count as current.
 */
export const getBubbleTodoProgress = (todos: TodoItem[]): { current: number; total: number } => {
	const list = normalizeTodoList(todos);
	const completed = list.filter(t => t.status === 'completed').length;
	const hasInProgress = list.some(t => t.status === 'in_progress');
	return {
		current: completed + (hasInProgress ? 1 : 0),
		total: list.length,
	};
};

/** Expanded rows for the bubble — excludes the header todo to avoid duplicate lines. */
export const getBubbleExpandedTodos = (
	todos: TodoItem[],
	headerTodoId: string | null,
	maxRows: number,
): TodoItem[] => {
	const list = normalizeTodoList(todos);
	const rest = headerTodoId ? list.filter(t => t.id !== headerTodoId) : list;
	if (maxRows <= 0 || !rest.length) {
		return [];
	}
	return rest.length <= maxRows ? rest : rest.slice(-maxRows);
};

export const getLastFewTodos = (todos: TodoItem[], n: number): TodoItem[] => {
	const list = normalizeTodoList(todos);
	if (n <= 0 || !list.length) {
		return [];
	}
	return list.slice(-n);
};

const isTodoWriteMessage = (
	msg: ChatMessage,
): msg is ChatMessage & { role: 'tool'; name: 'TodoWrite'; params: BuiltinToolCallParams['TodoWrite'] } => {
	return msg.role === 'tool'
		&& msg.name === 'TodoWrite'
		&& msg.type !== 'invalid_params'
		&& msg.type !== 'tool_request'
		&& 'params' in msg
		&& !!msg.params;
};

/** Replay TodoWrite tool calls before message index to get list state at that point in history. */
export const computeTodoListBeforeMessage = (
	messages: ChatMessage[],
	messageIndex: number,
): TodoItem[] => {
	let list: TodoItem[] = [];
	const end = Math.min(messageIndex, messages.length);
	for (let i = 0; i < end; i++) {
		const msg = messages[i];
		if (!isTodoWriteMessage(msg)) continue;
		const { todos, merge } = msg.params;
		if (!todos?.length) continue;
		list = applyTodoWrite(list, todos, merge ?? false);
	}
	return normalizeTodoList(list);
};

/**
 * Prefer the freshest todo list for the user-message bubble while the agent runs.
 * Never merge patch-style here — mergeTodoLists(stored, context) can overwrite newer
 * persisted in_progress status with a stale all-pending context snapshot.
 */
export const pickLiveTodoList = (
	persisted: TodoItem[] | undefined,
	contextTodos: TodoItem[],
	isAgentRunning: boolean,
): TodoItem[] => {
	const stored = normalizeTodoList(persisted ?? []);
	const context = normalizeTodoList(contextTodos);

	if (!isAgentRunning) {
		return stored.length ? stored : context;
	}
	if (!context.length) {
		return stored;
	}
	if (!stored.length) {
		return context;
	}
	if (todoListsEqual(stored, context)) {
		return stored;
	}

	const storedProgress = getBubbleTodoProgress(stored).current;
	const contextProgress = getBubbleTodoProgress(context).current;
	if (contextProgress !== storedProgress) {
		return contextProgress > storedProgress ? context : stored;
	}

	// Same progress — prefer the live streaming snapshot during agent run
	return context;
};

/** Pick list to store in TodoContext when hydrating from persisted thread storage. */
export const pickHydratedTodoList = (
	persisted: TodoItem[] | undefined,
	existingTodos: TodoItem[] | undefined,
): TodoItem[] => {
	const stored = normalizeTodoList(persisted ?? []);
	const existing = normalizeTodoList(existingTodos ?? []);
	if (!existing.length) {
		return stored;
	}
	if (!stored.length) {
		return existing;
	}
	if (todoListsEqual(stored, existing)) {
		return stored;
	}
	const storedProgress = getBubbleTodoProgress(stored).current;
	const existingProgress = getBubbleTodoProgress(existing).current;
	return existingProgress > storedProgress ? existing : stored;
};
