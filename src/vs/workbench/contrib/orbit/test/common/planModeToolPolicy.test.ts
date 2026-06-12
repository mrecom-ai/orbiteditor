/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { availableTools, isLLMHiddenBuiltinToolName, llmVisibleBuiltinToolNames } from '../../common/prompt/prompts.js';

suite('PlanModeToolPolicy', () => {
	test('plan mode excludes Shell and legacy plan tools from LLM', () => {
		const tools = availableTools('plan', undefined) ?? [];
		const names = tools.map(t => t.name);
		assert.ok(!names.includes('Shell'));
		assert.ok(!names.includes('AwaitShell'));
		assert.ok(!names.includes('update_plan_section'));
		assert.ok(!names.includes('add_plan_todo'));
		assert.ok(!names.includes('mark_plan_item_complete'));
	});

	test('plan mode includes task and plan editing tools', () => {
		const tools = availableTools('plan', undefined) ?? [];
		const names = tools.map(t => t.name);
		assert.ok(names.includes('task'));
		assert.ok(names.includes('create_plan'));
		assert.ok(names.includes('read_plan'));
		assert.ok(names.includes('StrReplace'));
		assert.ok(names.includes('Write'));
	});

	test('legacy plan tools are llm hidden globally', () => {
		assert.ok(isLLMHiddenBuiltinToolName('update_plan_section'));
		assert.ok(isLLMHiddenBuiltinToolName('add_plan_todo'));
		assert.ok(isLLMHiddenBuiltinToolName('mark_plan_item_complete'));
		assert.ok(!llmVisibleBuiltinToolNames.includes('update_plan_section'));
	});
});