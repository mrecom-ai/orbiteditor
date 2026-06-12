/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TodoItem } from './chatThreadServiceTypes.js';
import { updatePlanSection, todosToNumberedMarkdown, syncPlanStatus } from './planTemplate.js';
import { normalizeTodoList } from './todoToolHelpers.js';
export { syncPlanChecklistToThreadTodos } from './planDraftHelpers.js';

export const PLAN_SYNC_MAX_FAILURES = 3;

/**
 * Applies thread todos to a plan file's checklist and syncs status.
 */
export function buildPlanContentFromTodos(planContent: string, todos: readonly TodoItem[]): string {
	const normalized = normalizeTodoList(todos);
	const todosMarkdown = todosToNumberedMarkdown(normalized);
	let updated = updatePlanSection(planContent, 'checklist', todosMarkdown);
	updated = syncPlanStatus(updated);
	return updated;
}

export function shouldNotifyPlanSyncFailure(failureCount: number): boolean {
	return failureCount >= PLAN_SYNC_MAX_FAILURES;
}
