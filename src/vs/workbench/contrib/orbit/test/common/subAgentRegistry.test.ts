/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { BUILTIN_SUBAGENTS, getSubAgent, listSubAgents, getEffectiveDisallowedTools } from '../../common/subAgentRegistry.js';

suite('SubAgentRegistry', () => {
	test('all agents have unique agentType', () => {
		const names = BUILTIN_SUBAGENTS.map(a => a.agentType);
		assert.strictEqual(new Set(names).size, names.length);
	});

	test('all agents have non-empty system prompt', () => {
		for (const agent of BUILTIN_SUBAGENTS) {
			const prompt = agent.getSystemPrompt();
			assert.ok(prompt.length > 0, `${agent.agentType} has empty system prompt`);
		}
	});

	test('explore agent disallows write and terminal tools', () => {
		const explore = getSubAgent('explore')!;
		const disallowed = getEffectiveDisallowedTools(explore);
		assert.ok(disallowed.includes('edit_file'));
		assert.ok(disallowed.includes('rewrite_file'));
		assert.ok(disallowed.includes('run_command'));
		assert.ok(disallowed.includes('create_file_or_folder'));
		assert.ok(disallowed.includes('delete_file_or_folder'));
	});

	test('plan agent disallows write and terminal tools', () => {
		const plan = getSubAgent('plan')!;
		const disallowed = getEffectiveDisallowedTools(plan);
		assert.ok(disallowed.includes('edit_file'));
		assert.ok(disallowed.includes('run_command'));
	});

	test('general agent has no disallowed tools', () => {
		const general = getSubAgent('general')!;
		const disallowed = getEffectiveDisallowedTools(general);
		assert.strictEqual(disallowed.length, 0);
	});

	test('getSubAgent returns undefined for unknown name', () => {
		assert.strictEqual(getSubAgent('nonexistent'), undefined);
	});

	test('listSubAgents returns all agents', () => {
		assert.strictEqual(listSubAgents().length, BUILTIN_SUBAGENTS.length);
	});

	test('all agents have non-empty whenToUse', () => {
		for (const agent of BUILTIN_SUBAGENTS) {
			assert.ok(agent.whenToUse.length > 0, `${agent.agentType} has empty whenToUse`);
		}
	});
});
