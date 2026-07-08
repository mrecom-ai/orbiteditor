/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { PlanDraft, TodoItem, TodoWriteItem } from '../../common/chatThreadServiceTypes.js';
import {
	applyTodoWrite,
	normalizeTodoList,
	todoListsEqual,
} from '../../common/todoToolHelpers.js';

/**
 * Mirrors ChatThreadService TodoWrite commit handling after the background-task
 * scope fix — must run for every successful TodoWrite, not only background tools.
 */
function commitTodoWriteToThread(
	threadTodoList: TodoItem[] | undefined,
	params: { todos: TodoWriteItem[]; merge: boolean },
): TodoItem[] {
	const finalTodoList = applyTodoWrite(threadTodoList ?? [], params.todos, params.merge);
	return normalizeTodoList(finalTodoList);
}

suite('ChatThread TodoWrite persistence', () => {
	test('TodoWrite commit updates thread todos on non-background tool path', () => {
		const existing: TodoItem[] = [
			{ id: 'setup', content: 'Setup auth', status: 'pending' },
		];

		const result = commitTodoWriteToThread(existing, {
			todos: [{ id: 'tests', content: 'Add integration tests' }],
			merge: true,
		});

		assert.strictEqual(result.length, 2);
		assert.ok(result.find(t => t.id === 'tests'));
		assert.strictEqual(result.find(t => t.id === 'tests')?.status, 'pending');
	});

	test('TodoWrite replace mode normalizes todos like setThreadTodoList', () => {
		const existing: TodoItem[] = [
			{ id: 'old', content: 'Old task', status: 'completed' },
		];

		const result = commitTodoWriteToThread(existing, {
			todos: [
				{ id: 'a', content: 'Task A', status: 'in_progress' },
				{ id: 'b', content: 'Task B', status: 'in_progress' },
			],
			merge: false,
		});

		assert.strictEqual(result.length, 2);
		assert.strictEqual(result.filter(t => t.status === 'in_progress').length, 1);
		assert.notDeepStrictEqual(result, existing);
		assert.ok(!todoListsEqual(existing, result));
	});
});

suite('PlanDraft persistence shape', () => {
	test('planDraft serializes expected fields', () => {
		const draft: PlanDraft = {
			name: 'Auth Plan',
			overview: 'Add JWT auth',
			planMarkdown: '# Auth Plan\n\n## Overview\n\nDetails',
			todos: [{ id: 'setup', content: 'Setup auth' }],
			createdAt: '2026-06-09T00:00:00.000Z',
			updatedAt: '2026-06-09T00:00:00.000Z',
		};
		const serialized = JSON.parse(JSON.stringify(draft));
		assert.strictEqual(serialized.name, 'Auth Plan');
		assert.strictEqual(serialized.todos.length, 1);
		assert.strictEqual(serialized.savedPlanPath, undefined);
	});

	test('planDraft with savedPlanPath round-trips', () => {
		const draft: PlanDraft = {
			name: 'Auth Plan',
			overview: null,
			planMarkdown: '# Auth Plan',
			todos: [],
			createdAt: '2026-06-09T00:00:00.000Z',
			updatedAt: '2026-06-09T01:00:00.000Z',
			savedPlanPath: '/workspace/.void/plans/2026-06-09-auth-plan.md',
		};
		const restored = JSON.parse(JSON.stringify(draft)) as PlanDraft;
		assert.strictEqual(restored.savedPlanPath, draft.savedPlanPath);
	});

	test('C11: TodoWrite normalizes upper/mixed-case status to canonical lowercase', () => {
		// Phase 1.11 (C11) fix: when a TodoWrite's status arrives in any non-canonical
		// casing, the persisted thread todoList must store the canonical lowercase
		// form so downstream comparisons (and serialization to the plan checklist)
		// see a single shape.
		const result = commitTodoWriteToThread(undefined, {
			todos: [
				{ id: 'a', content: 'A', status: 'IN_PROGRESS' as any },
				{ id: 'b', content: 'B', status: 'Completed' as any },
			],
			merge: false,
		});
		const a = result.find(t => t.id === 'a');
		const b = result.find(t => t.id === 'b');
		assert.strictEqual(a?.status, 'in_progress');
		assert.strictEqual(b?.status, 'completed');
	});
});