/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	buildPlanContentFromTodos,
	PLAN_SYNC_MAX_FAILURES,
	shouldNotifyPlanSyncFailure,
} from '../../common/planTodoSyncHelpers.js';
import { TodoItem } from '../../common/chatThreadServiceTypes.js';

const SAMPLE_PLAN = `---
title: Sync Test
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
status: planning
---

# Sync Test

## Overview

Overview.

## Implementation Checklist

1. [PENDING] Old task <!-- id:old -->

## Testing Strategy

TBD.
`;

suite('PlanTodoSyncHelpers', () => {
	test('buildPlanContentFromTodos writes thread todos to checklist', () => {
		const todos: TodoItem[] = [
			{ id: 'a', content: 'Task A', status: 'in_progress', activeForm: 'Working on A' },
			{ id: 'b', content: 'Task B', status: 'pending' },
		];

		const written = buildPlanContentFromTodos(SAMPLE_PLAN, todos);

		assert.ok(written.includes('1. [IN_PROGRESS] Task A'));
		assert.ok(written.includes('2. [PENDING] Task B'));
		assert.ok(!written.includes('Old task'));
	});

	test('shouldNotifyPlanSyncFailure triggers after max failures', () => {
		assert.strictEqual(shouldNotifyPlanSyncFailure(PLAN_SYNC_MAX_FAILURES - 1), false);
		assert.strictEqual(shouldNotifyPlanSyncFailure(PLAN_SYNC_MAX_FAILURES), true);
	});

	test('buildPlanContentFromTodos preserves non-checklist sections', () => {
		const todos: TodoItem[] = [
			{ id: 'x', content: 'Only task', status: 'pending' },
		];

		const written = buildPlanContentFromTodos(SAMPLE_PLAN, todos);

		assert.ok(written.includes('## Overview'));
		assert.ok(written.includes('Overview.'));
		assert.ok(written.includes('## Testing Strategy'));
		assert.ok(written.includes('1. [PENDING] Only task'));
	});

	test('buildPlanContentFromTodos handles empty todo list', () => {
		const written = buildPlanContentFromTodos(SAMPLE_PLAN, []);
		assert.ok(written.includes('## Implementation Checklist'));
		assert.ok(!written.includes('Old task'));
	});
});
