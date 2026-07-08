/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { BUILTIN_SUBAGENTS, getSubAgent, listSubAgents, getEffectiveDisallowedTools, setDisabledAgentTypes, setUserAgents, setProjectAgents, SubAgentDefinition } from '../../common/subAgentRegistry.js';

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
		assert.ok(disallowed.includes('StrReplace'));
		assert.ok(disallowed.includes('Write'));
		assert.ok(disallowed.includes('Shell'));
		assert.ok(disallowed.includes('AwaitShell'));
	});

	test('plan agent disallows write and terminal tools', () => {
		const plan = getSubAgent('plan')!;
		const disallowed = getEffectiveDisallowedTools(plan);
		assert.ok(disallowed.includes('StrReplace'));
		assert.ok(disallowed.includes('Shell'));
		assert.ok(disallowed.includes('AwaitShell'));
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

	suite('enabled / disable', () => {
		const makeCustomAgent = (agentType: string, source: 'user' | 'project'): SubAgentDefinition => ({
			agentType,
			whenToUse: `use ${agentType}`,
			disallowedTools: [],
			source,
			getSystemPrompt: () => `you are ${agentType}`,
		});

		teardown(() => {
			// Reset module state so tests don't leak into each other.
			setUserAgents([]);
			setProjectAgents([]);
			setDisabledAgentTypes([]);
		});

		test('built-in agents are always enabled, even if their type is in the disabled set', () => {
			setDisabledAgentTypes(['explore', 'plan', 'general']);
			for (const agent of listSubAgents()) {
				if (agent.source === 'built-in') assert.strictEqual(agent.enabled, true, agent.agentType);
			}
		});

		test('custom user agent is enabled by default', () => {
			setUserAgents([makeCustomAgent('my-user-agent', 'user')]);
			const agent = getSubAgent('my-user-agent');
			assert.strictEqual(agent?.enabled, true);
		});

		test('custom project agent is disabled after setDisabledAgentTypes includes it', () => {
			setProjectAgents([makeCustomAgent('my-project-agent', 'project')]);
			setDisabledAgentTypes(['my-project-agent']);
			const agent = getSubAgent('my-project-agent');
			assert.strictEqual(agent?.enabled, false);
		});

		test('re-enabling removes the agentType from the disabled set', () => {
			setProjectAgents([makeCustomAgent('toggle-agent', 'project')]);
			setDisabledAgentTypes(['toggle-agent']);
			assert.strictEqual(getSubAgent('toggle-agent')?.enabled, false);
			setDisabledAgentTypes([]);
			assert.strictEqual(getSubAgent('toggle-agent')?.enabled, true);
		});

		test('setDisabledAgentTypes with an equivalent set does not change enabled state', () => {
			setProjectAgents([makeCustomAgent('stable-agent', 'project')]);
			setDisabledAgentTypes(['stable-agent']);
			setDisabledAgentTypes(['stable-agent']); // same set again, different array identity
			assert.strictEqual(getSubAgent('stable-agent')?.enabled, false);
		});

		test('listSubAgents still returns built-in count with no custom agents registered', () => {
			assert.strictEqual(listSubAgents().length, BUILTIN_SUBAGENTS.length);
		});
	});
});
