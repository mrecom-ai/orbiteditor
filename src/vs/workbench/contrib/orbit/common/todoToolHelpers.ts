/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TodoItem, TodoPriority, TodoStatus, TodoWriteItem } from './chatThreadServiceTypes.js';

export const TODO_MAX_ITEMS = 20;
export const TODO_MAX_CONTENT_LENGTH = 500;
export const TODO_MAX_ACTIVE_FORM_LENGTH = 500;

const TODO_STATUSES = new Set<TodoStatus>(['pending', 'in_progress', 'completed', 'cancelled']);
const TODO_PRIORITIES = new Set<TodoPriority>(['high', 'medium', 'low']);

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

// Phase 1.11 (C11) fix: lower-case the incoming status before checking membership in
// TODO_STATUSES, and also tolerate common LLM casing variations (e.g. "In_Progress",
// "IN_PROGRESS", "in-progress"). This avoids the previous behavior of silently
// dropping an unknown status (which would leave the previous status in place and
// desync the stored list from the LLM's intent).
const normalizeStatus = (status: unknown): TodoStatus | undefined => {
	if (typeof status !== 'string') {
		return undefined;
	}
	const lower = status.toLowerCase().replace(/-/g, '_');
	if (TODO_STATUSES.has(lower as TodoStatus)) {
		return lower as TodoStatus;
	}
	return undefined;
};

const normalizePriority = (priority: unknown): TodoPriority | undefined =>
	typeof priority === 'string' && TODO_PRIORITIES.has(priority as TodoPriority)
		? priority as TodoPriority
		: undefined;

const normalizeOptionalText = (value: unknown, maxLength: number): string | undefined => {
	if (typeof value !== 'string') {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.slice(0, maxLength);
};

const normalizeTodoPatch = (todo: TodoWriteItem): TodoWriteItem | null => {
	if (!isObject(todo)) {
		return null;
	}
	const id = typeof todo.id === 'string' ? todo.id.trim() : '';
	if (!id) {
		return null;
	}

	const normalized: TodoWriteItem = { id };
	const content = normalizeOptionalText(todo.content, TODO_MAX_CONTENT_LENGTH);
	if (content !== undefined) {
		normalized.content = content;
	}
	const status = normalizeStatus(todo.status);
	if (status !== undefined) {
		normalized.status = status;
	}
	const priority = normalizePriority(todo.priority);
	if (priority !== undefined) {
		normalized.priority = priority;
	}
	const activeForm = normalizeOptionalText(todo.activeForm, TODO_MAX_ACTIVE_FORM_LENGTH);
	if (activeForm !== undefined) {
		normalized.activeForm = activeForm;
	}
	return normalized;
};

const toCompleteTodo = (todo: TodoWriteItem, fallback?: TodoItem): TodoItem | null => {
	const patch = normalizeTodoPatch(todo);
	if (!patch) {
		return null;
	}
	const content = patch.content ?? fallback?.content;
	if (!content) {
		return null;
	}

	const item: TodoItem = {
		id: patch.id,
		content,
		status: patch.status ?? fallback?.status ?? 'pending',
	};
	const priority = patch.priority ?? fallback?.priority;
	if (priority !== undefined) {
		item.priority = priority;
	}
	const activeForm = patch.activeForm ?? fallback?.activeForm;
	if (activeForm !== undefined) {
		item.activeForm = activeForm;
	}
	return item;
};

export function normalizeTodoList(todos: readonly TodoWriteItem[] | undefined): TodoItem[] {
	if (!todos?.length) {
		return [];
	}

	const byId = new Map<string, TodoItem>();
	const order: string[] = [];

	for (const todo of todos) {
		const prev = isObject(todo) && typeof todo.id === 'string'
			? byId.get(todo.id.trim())
			: undefined;
		const item = toCompleteTodo(todo, prev);
		if (!item) {
			continue;
		}
		if (!byId.has(item.id)) {
			order.push(item.id);
		}
		byId.set(item.id, item);
	}

	let seenInProgress = false;
	return order.map(id => {
		const item = { ...byId.get(id)! };
		if (item.status === 'in_progress') {
			if (seenInProgress) {
				item.status = 'pending';
			} else {
				seenInProgress = true;
			}
		}
		return item;
	});
}

export function applyTodoWrite(
	existing: readonly TodoItem[] | undefined,
	incoming: readonly TodoWriteItem[],
	merge: boolean,
): TodoItem[] {
	const normalizedExisting = normalizeTodoList(existing);
	if (!merge) {
		return normalizeTodoList(incoming);
	}

	const todoMap = new Map<string, TodoItem>();
	for (const todo of normalizedExisting) {
		todoMap.set(todo.id, { ...todo });
	}

	for (const todo of incoming) {
		const patch = normalizeTodoPatch(todo);
		if (!patch) {
			continue;
		}
		const prev = todoMap.get(patch.id);
		const merged = toCompleteTodo(patch, prev);
		if (!merged) {
			continue;
		}
		todoMap.set(patch.id, merged);
	}

	return normalizeTodoList(Array.from(todoMap.values()));
}

export function todoListsEqual(a: readonly TodoItem[], b: readonly TodoItem[]): boolean {
	return stableTodoListKey(a) === stableTodoListKey(b);
}

export function stableTodoListKey(todos: readonly TodoWriteItem[] | undefined): string {
	return JSON.stringify(normalizeTodoList(todos));
}

export function getTodoDisplayText(todo: TodoItem): string {
	return todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content;
}

export function validateTodoWriteItems(
	todos: readonly TodoWriteItem[],
	options: { merge: boolean; allowEmpty?: boolean } = { merge: false },
): { valid: true; todos: TodoWriteItem[] } | { valid: false; error: string } {
	if (!Array.isArray(todos)) {
		return { valid: false, error: 'todos must be an array' };
	}
	if (!options.allowEmpty && todos.length === 0) {
		return { valid: false, error: 'TODO list cannot be empty. Provide at least one task.' };
	}
	if (todos.length > TODO_MAX_ITEMS) {
		return { valid: false, error: `Too many items (max ${TODO_MAX_ITEMS}). Break into smaller tasks.` };
	}

	const ids = new Set<string>();
	let inProgressCount = 0;
	const normalized: TodoWriteItem[] = [];

	for (const [i, rawTodo] of todos.entries()) {
		if (!isObject(rawTodo)) {
			return { valid: false, error: `Todo ${i + 1} must be an object` };
		}
		if (typeof rawTodo.id !== 'string' || !rawTodo.id.trim()) {
			return { valid: false, error: `Todo ${i + 1} must have an "id" field (string)` };
		}
		const id = rawTodo.id.trim();
		if (ids.has(id)) {
			return { valid: false, error: `Duplicate todo ID found: "${id}"` };
		}
		ids.add(id);

		if (!options.merge && (typeof rawTodo.content !== 'string' || !rawTodo.content.trim())) {
			return { valid: false, error: `Todo ${i + 1} must have a non-empty "content" field (string)` };
		}
		if (rawTodo.content !== undefined) {
			if (typeof rawTodo.content !== 'string' || !rawTodo.content.trim()) {
				return { valid: false, error: `Todo ${i + 1} has invalid content: must be a non-empty string` };
			}
			if (rawTodo.content.trim().length > TODO_MAX_CONTENT_LENGTH) {
				return { valid: false, error: `Item content too long (max ${TODO_MAX_CONTENT_LENGTH} chars): "${id}"` };
			}
		}
		const rawStatus = rawTodo.status;
		if (rawStatus !== undefined && normalizeStatus(rawStatus) === undefined) {
			return { valid: false, error: `Todo ${i + 1} has invalid status: "${rawTodo.status}"` };
		}
		const rawPriority = rawTodo.priority;
		if (rawPriority !== undefined && (typeof rawPriority !== 'string' || !TODO_PRIORITIES.has(rawPriority as TodoPriority))) {
			return { valid: false, error: `Todo ${i + 1} has invalid priority: "${rawTodo.priority}"` };
		}
		if (rawTodo.activeForm !== undefined) {
			if (typeof rawTodo.activeForm !== 'string') {
				return { valid: false, error: `Todo ${i + 1} has invalid activeForm: must be string or undefined` };
			}
			if (rawTodo.activeForm.trim().length > TODO_MAX_ACTIVE_FORM_LENGTH) {
				return { valid: false, error: `Item activeForm too long (max ${TODO_MAX_ACTIVE_FORM_LENGTH} chars): "${id}"` };
			}
		}
		if (rawTodo.status === 'in_progress' || (typeof rawTodo.status === 'string' && rawTodo.status.toLowerCase().replace(/-/g, '_') === 'in_progress')) {
			inProgressCount++;
		}

		const patch = normalizeTodoPatch(rawTodo as TodoWriteItem);
		if (patch) {
			normalized.push(patch);
		}
	}

	if (inProgressCount > 1) {
		return { valid: false, error: `Only ONE task can be in_progress at a time (found ${inProgressCount})` };
	}

	return { valid: true, todos: normalized };
}
