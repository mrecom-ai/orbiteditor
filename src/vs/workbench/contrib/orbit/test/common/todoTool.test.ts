/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TodoItem } from '../../common/chatThreadServiceTypes.js';
import { parseNumberedTodoMarkdown, todosToNumberedMarkdown } from '../../common/planTemplate.js';
import {
	applyTodoWrite,
	getTodoDisplayText,
	normalizeTodoList,
	todoListsEqual,
	validateTodoWriteItems,
} from '../../common/todoToolHelpers.js';
import {
	getBubbleExpandedTodos,
	getBubbleTodoProgress,
	getLastFewTodos,
	getNextActiveTodo,
	getTodoProgress,
	pickHydratedTodoList,
	pickLiveTodoList,
} from '../../browser/react/src/sidebar-tsx/components/toolResults/todo/todoState.js';

suite('TodoTool', () => {
	test('replace creates normalized todos with default pending status', () => {
		const result = applyTodoWrite(undefined, [
			{ id: ' setup ', content: ' Setup auth ', priority: 'high' },
		], false);

		assert.deepStrictEqual(result, [{
			id: 'setup',
			content: 'Setup auth',
			status: 'pending',
			priority: 'high',
		}]);
	});

	test('merge patches existing todos by id and preserves omitted fields', () => {
		const existing: TodoItem[] = [
			{ id: 'setup', content: 'Setup auth', status: 'in_progress', activeForm: 'Setting up auth' },
			{ id: 'test', content: 'Run tests', status: 'pending' },
		];

		const result = applyTodoWrite(existing, [
			{ id: 'setup', status: 'completed' },
			{ id: 'test', status: 'in_progress', activeForm: 'Running tests' },
		], true);

		assert.deepStrictEqual(result, [
			{ id: 'setup', content: 'Setup auth', status: 'completed', activeForm: 'Setting up auth' },
			{ id: 'test', content: 'Run tests', status: 'in_progress', activeForm: 'Running tests' },
		]);
	});

	test('normalization dedupes by id and demotes extra in-progress todos', () => {
		const result = normalizeTodoList([
			{ id: 'a', content: 'First', status: 'in_progress' },
			{ id: 'b', content: 'Second', status: 'in_progress' },
			{ id: 'a', content: 'First updated', status: 'completed' },
		]);

		assert.deepStrictEqual(result, [
			{ id: 'a', content: 'First updated', status: 'completed' },
			{ id: 'b', content: 'Second', status: 'in_progress' },
		]);
	});

	test('validation rejects duplicate ids and multiple in-progress items', () => {
		const duplicate = validateTodoWriteItems([
			{ id: 'a', content: 'A' },
			{ id: 'a', content: 'Again' },
		], { merge: false });
		assert.strictEqual(duplicate.valid, false);
		assert.ok(!duplicate.valid && duplicate.error.includes('Duplicate todo ID'));

		const multipleActive = validateTodoWriteItems([
			{ id: 'a', content: 'A', status: 'in_progress' },
			{ id: 'b', content: 'B', status: 'in_progress' },
		], { merge: false });
		assert.strictEqual(multipleActive.valid, false);
		assert.ok(!multipleActive.valid && multipleActive.error.includes('Only ONE task'));
	});

	test('merge validation allows status-only patches', () => {
		const validation = validateTodoWriteItems([
			{ id: 'setup', status: 'completed' },
		], { merge: true });

		assert.strictEqual(validation.valid, true);
		assert.deepStrictEqual(validation.valid ? validation.todos : [], [
			{ id: 'setup', status: 'completed' },
		]);
	});

	test('display text uses activeForm only while in progress', () => {
		assert.strictEqual(getTodoDisplayText({
			id: 'test',
			content: 'Run tests',
			status: 'in_progress',
			activeForm: 'Running tests',
		}), 'Running tests');

		assert.strictEqual(getTodoDisplayText({
			id: 'test',
			content: 'Run tests',
			status: 'completed',
			activeForm: 'Running tests',
		}), 'Run tests');
	});

	test('plan numbered markdown round trips todo status and ids', () => {
		const todos: TodoItem[] = [
			{ id: 'setup_auth', content: 'Setup auth', status: 'completed' },
			{ id: 'run-tests', content: 'Run tests', status: 'in_progress' },
			{ id: 'old-task', content: 'Old task', status: 'cancelled' },
		];

		const markdown = todosToNumberedMarkdown(todos);
		const parsed = parseNumberedTodoMarkdown(markdown);

		assert.deepStrictEqual(parsed, todos.map(({ id, content, status }) => ({ id, content, status })));
	});

	test('todo list equality uses normalized state', () => {
		assert.strictEqual(todoListsEqual(
			[{ id: 'a', content: 'A', status: 'pending' }],
			[{ id: ' a ', content: ' A ', status: 'pending' }],
		), true);
	});

	suite('bubble todo preview helpers', () => {
		test('getNextActiveTodo prefers in_progress over pending', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'Pending first', status: 'pending' },
				{ id: 'b', content: 'Active', status: 'in_progress', activeForm: 'Working' },
			];
			assert.strictEqual(getNextActiveTodo(todos)?.id, 'b');
		});

		test('getNextActiveTodo returns first pending when none in progress', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'First', status: 'pending' },
				{ id: 'b', content: 'Second', status: 'pending' },
			];
			assert.strictEqual(getNextActiveTodo(todos)?.id, 'a');
		});

		test('getNextActiveTodo returns null for empty list', () => {
			assert.strictEqual(getNextActiveTodo([]), null);
		});

		test('getNextActiveTodo returns last completed when all done', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'A', status: 'completed' },
				{ id: 'b', content: 'B', status: 'completed' },
			];
			assert.strictEqual(getNextActiveTodo(todos)?.id, 'b');
		});

		test('getTodoProgress counts completed and total', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'A', status: 'completed' },
				{ id: 'b', content: 'B', status: 'in_progress' },
				{ id: 'c', content: 'C', status: 'pending' },
				{ id: 'd', content: 'D', status: 'cancelled' },
			];
			assert.deepStrictEqual(getTodoProgress(todos), { completed: 1, total: 4 });
		});

		test('getBubbleTodoProgress counts in_progress as current', () => {
			const todos: TodoItem[] = [
				{ id: 's1', content: 'Task S1', status: 'in_progress' },
				{ id: 's2', content: 'Task S2', status: 'pending' },
				{ id: 's3', content: 'Task S3', status: 'pending' },
			];
			assert.deepStrictEqual(getBubbleTodoProgress(todos), { current: 1, total: 3 });
		});

		test('getBubbleTodoProgress counts completed plus in_progress', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'A', status: 'completed' },
				{ id: 'b', content: 'B', status: 'in_progress' },
				{ id: 'c', content: 'C', status: 'pending' },
			];
			assert.deepStrictEqual(getBubbleTodoProgress(todos), { current: 2, total: 3 });
		});

		test('getBubbleExpandedTodos excludes header todo', () => {
			const todos: TodoItem[] = [
				{ id: 's1', content: 'Task S1', status: 'in_progress' },
				{ id: 's2', content: 'Task S2', status: 'pending' },
				{ id: 's3', content: 'Task S3', status: 'pending' },
			];
			assert.deepStrictEqual(
				getBubbleExpandedTodos(todos, 's1', 8).map(t => t.id),
				['s2', 's3'],
			);
		});

		test('pickLiveTodoList does not let stale context revert in_progress', () => {
			const stored: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'in_progress', activeForm: 'Working on Task 1' },
				{ id: 's2', content: 'Task 2', status: 'pending' },
				{ id: 's3', content: 'Task 3', status: 'pending' },
			];
			const staleContext: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'pending' },
				{ id: 's2', content: 'Task 2', status: 'pending' },
				{ id: 's3', content: 'Task 3', status: 'pending' },
			];
			const result = pickLiveTodoList(stored, staleContext, true);
			assert.strictEqual(result.find(t => t.id === 's1')?.status, 'in_progress');
		});

		test('pickLiveTodoList prefers fresher streaming context', () => {
			const stored: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'pending' },
				{ id: 's2', content: 'Task 2', status: 'pending' },
			];
			const liveContext: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'in_progress', activeForm: 'Working on Task 1' },
				{ id: 's2', content: 'Task 2', status: 'pending' },
			];
			const result = pickLiveTodoList(stored, liveContext, true);
			assert.strictEqual(result.find(t => t.id === 's1')?.status, 'in_progress');
		});

		test('pickHydratedTodoList keeps ahead-of-persist streaming snapshot', () => {
			const persisted: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'pending' },
			];
			const existing: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'in_progress', activeForm: 'Working' },
			];
			const result = pickHydratedTodoList(persisted, existing);
			assert.strictEqual(result[0]?.status, 'in_progress');
		});

		test('pickHydratedTodoList adopts persisted after commit', () => {
			const persisted: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'in_progress' },
				{ id: 's2', content: 'Task 2', status: 'pending' },
			];
			const existing: TodoItem[] = [
				{ id: 's1', content: 'Task 1', status: 'pending' },
			];
			const result = pickHydratedTodoList(persisted, existing);
			assert.strictEqual(result.find(t => t.id === 's1')?.status, 'in_progress');
		});

		test('getLastFewTodos returns tail and handles short lists', () => {
			const todos: TodoItem[] = [
				{ id: 'a', content: 'A', status: 'pending' },
				{ id: 'b', content: 'B', status: 'pending' },
				{ id: 'c', content: 'C', status: 'pending' },
			];
			assert.deepStrictEqual(
				getLastFewTodos(todos, 2).map(t => t.id),
				['b', 'c'],
			);
			assert.deepStrictEqual(
				getLastFewTodos(todos, 10).map(t => t.id),
				['a', 'b', 'c'],
			);
			assert.deepStrictEqual(getLastFewTodos(todos, 0), []);
		});
	});
});
