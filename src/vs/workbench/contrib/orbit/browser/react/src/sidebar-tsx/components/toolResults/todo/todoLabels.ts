/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { TodoItem } from '../../../../../../../common/chatThreadServiceTypes.js';

export type TodoUpdateKind = 'started' | 'finished' | 'created' | 'updated' | 'cancelled';

export type TodoUpdatePresentation = {
	kind: TodoUpdateKind;
	title: string;
	subtitle?: string;
	showCheck?: boolean;
};

export const getTodoUpdatePresentation = (
	todos: TodoItem[],
	previousTodos: TodoItem[],
): TodoUpdatePresentation => {
	const prevMap = new Map(previousTodos.map(t => [t.id, t]));
	const changedItems: { type: 'started' | 'finished' | 'created' | 'cancelled'; item: TodoItem }[] = [];

	todos.forEach(todo => {
		const prev = prevMap.get(todo.id);
		if (!prev) {
			changedItems.push({ type: 'created', item: todo });
		} else if (prev.status !== todo.status) {
			if (todo.status === 'completed') {
				changedItems.push({ type: 'finished', item: todo });
			} else if (todo.status === 'in_progress') {
				changedItems.push({ type: 'started', item: todo });
			} else if (todo.status === 'cancelled') {
				changedItems.push({ type: 'cancelled' as const, item: todo });
			}
		}
	});

	if (changedItems.length === 1) {
		const { type, item } = changedItems[0];
		if (type === 'started') {
			return { kind: 'started', title: 'Started to-do', subtitle: item.content, showCheck: true };
		}
		if (type === 'finished') {
			return { kind: 'finished', title: 'Finished to-do', subtitle: item.content, showCheck: true };
		}
		if (type === 'cancelled') {
			return { kind: 'cancelled', title: 'Cancelled to-do', subtitle: item.content };
		}
		return { kind: 'created', title: 'Created to-do', subtitle: item.content };
	}

	if (changedItems.length > 1) {
		if (changedItems.every(c => c.type === 'created')) {
			return {
				kind: 'created',
				title: 'Created to-dos',
				subtitle: `${changedItems.length} items`,
			};
		}
		const started = changedItems.filter(c => c.type === 'started').length;
		const finished = changedItems.filter(c => c.type === 'finished').length;
		const created = changedItems.filter(c => c.type === 'created').length;
		const cancelled = changedItems.filter(c => c.type === 'cancelled').length;
		const parts: string[] = [];
		if (finished > 0) parts.push(`${finished} finished`);
		if (started > 0) parts.push(`${started} started`);
		if (created > 0) parts.push(`${created} created`);
		if (cancelled > 0) parts.push(`${cancelled} cancelled`);
		return {
			kind: 'updated',
			title: 'Updated to-dos',
			subtitle: parts.length > 0 ? parts.join(', ') : undefined,
		};
	}

	return { kind: 'updated', title: 'Updated to-dos', subtitle: `${todos.length} items` };
};

/** Present-tense labels while TodoWrite is still streaming. */
export const getStreamingTodoTitle = (presentation: TodoUpdatePresentation): string => {
	switch (presentation.kind) {
		case 'started':
			return 'Starting to-do';
		case 'finished':
			return 'Finishing to-do';
		case 'created':
			return presentation.subtitle?.includes('items') ? 'Creating to-dos' : 'Creating to-do';
		case 'cancelled':
			return 'Cancelling to-do';
		case 'updated':
		default:
			return 'Updating to-dos';
	}
};
