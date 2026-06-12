/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import {
	applyStringReplaceToContent,
	buildPlanContentFromDraft,
	createPlanDraftFromParams,
	isPlanFilePath,
	parsePlanSectionTitles,
	preparePlanDraftSave,
	syncPlanChecklistToThreadTodos,
	updateDraftFromPlanContent,
} from '../../common/planDraftHelpers.js';

suite('planDraftHelpers', () => {
	test('createPlanDraftFromParams preserves createdAt on update', () => {
		const first = createPlanDraftFromParams('Auth Plan', 'Overview text', '# Auth Plan\n\n## Steps\n\nDo things', [
			{ id: 'setup', content: 'Setup auth' },
		]);
		const second = createPlanDraftFromParams(null, 'Updated overview', '# Auth Plan\n\n## Steps\n\nUpdated', [
			{ id: 'setup', content: 'Setup auth' },
			{ id: 'tests', content: 'Add tests' },
		], first);
		assert.strictEqual(second.createdAt, first.createdAt);
		assert.ok(second.updatedAt >= first.updatedAt);
		assert.strictEqual(second.name, 'Auth Plan');
		assert.strictEqual(second.todos.length, 2);
	});

	test('buildPlanContentFromDraft matches save content with approved status', () => {
		const draft = createPlanDraftFromParams('My Plan', 'Short overview', '# My Plan\n\n## Overview\n\nDetails', [
			{ id: 'task-1', content: 'First task' },
		]);
		const planning = buildPlanContentFromDraft(draft, 'planning');
		const approved = buildPlanContentFromDraft(draft, 'approved');
		assert.ok(planning.includes('status: planning'));
		assert.ok(approved.includes('status: approved'));
		assert.ok(approved.includes('## Implementation Checklist'));
	});

	test('applyStringReplaceToContent updates draft body', () => {
		const draft = createPlanDraftFromParams('Plan', null, '# Plan\n\n## Overview\n\nOld text', []);
		const content = buildPlanContentFromDraft(draft);
		const updated = applyStringReplaceToContent(content, 'Old text', 'New text', false);
		const parsed = updateDraftFromPlanContent(updated, draft);
		assert.ok(parsed.planMarkdown.includes('New text'));
		assert.ok(!parsed.planMarkdown.includes('Old text'));
	});

	test('syncPlanChecklistToThreadTodos parses numbered checklist', () => {
		const draft = createPlanDraftFromParams('Plan', null, '# Plan\n\nBody', [
			{ id: 'a', content: 'Task A' },
			{ id: 'b', content: 'Task B' },
		]);
		const content = buildPlanContentFromDraft(draft);
		const todos = syncPlanChecklistToThreadTodos(content);
		assert.strictEqual(todos.length, 2);
		assert.strictEqual(todos[0].id, 'a');
		assert.strictEqual(todos[0].status, 'pending');
	});

	test('isPlanFilePath accepts linked and .void/plans paths', () => {
		assert.ok(isPlanFilePath('/workspace/.void/plans/2026-01-01-plan.md'));
		assert.ok(isPlanFilePath('/workspace/.void/plans/foo.md', '/workspace/.void/plans/foo.md'));
		assert.ok(!isPlanFilePath('/workspace/src/index.ts'));
	});

	test('preparePlanDraftSave generates timestamped filename', () => {
		const draft = createPlanDraftFromParams('User Auth', null, '# User Auth\n\nBody', []);
		const { planUri, planName, content } = preparePlanDraftSave(draft, URI.file('/workspace'));
		assert.strictEqual(planName, 'User Auth');
		assert.ok(planUri.path.includes('/.void/plans/'));
		assert.ok(planUri.path.endsWith('.md'));
		assert.ok(content.includes('status: approved'));
	});

	test('parsePlanSectionTitles extracts markdown headings', () => {
		const sections = parsePlanSectionTitles('# Title\n\n## Overview\n\nText\n\n## Implementation Steps\n\nMore');
		assert.deepStrictEqual(sections, ['Overview', 'Implementation Steps']);
	});
});