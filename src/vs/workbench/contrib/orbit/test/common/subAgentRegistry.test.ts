/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { BUILTIN_SUBAGENTS, buildSubAgentRegistry, getBuiltinAgent, listVisibleSubAgents } from '../../common/subAgentRegistry.js';

suite('subAgentRegistry', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('every entry has unique name and non-empty prompt', () => {
		const seen = new Set<string>()
		for (const agent of BUILTIN_SUBAGENTS) {
			assert.ok(agent.name && agent.name.length > 0, 'name required')
			const lower = agent.name.toLowerCase()
			assert.ok(!seen.has(lower), `duplicate agent name: ${lower}`)
			seen.add(lower)
			assert.ok(agent.prompt && agent.prompt.length > 0, `agent ${agent.name} must have prompt`)
		}
	})

	test('listVisibleSubAgents returns expected core set', () => {
		const visible = listVisibleSubAgents()
		const names = visible.map(a => a.name)
		// Existing four
		assert.ok(names.includes('explore'), `explore missing; got: ${names.join(', ')}`)
		assert.ok(names.includes('general'))
		assert.ok(names.includes('reviewer'))
		assert.ok(names.includes('security'))
		// Newly-added M1 agents
		assert.ok(names.includes('planner'))
		assert.ok(names.includes('test-verifier'))
		assert.ok(names.includes('ux-polisher'))
	})

	test('hidden helpers are excluded from visible list', () => {
		const names = listVisibleSubAgents().map(a => a.name)
		// 'compaction', 'title', 'summary' are hidden primary helpers
		assert.ok(!names.includes('compaction'))
		assert.ok(!names.includes('title'))
		assert.ok(!names.includes('summary'))
	})

	test('implementer is registered but not visible (disabled by default)', () => {
		const found = BUILTIN_SUBAGENTS.find(a => a.name === 'implementer')
		assert.ok(found, 'implementer must be in BUILTIN_SUBAGENTS')
		const visible = listVisibleSubAgents().map(a => a.name)
		assert.ok(!visible.includes('implementer'))
	})

	test('every visible sub-agent has permissionMode set to read_only and denyDelegation true', () => {
		for (const a of listVisibleSubAgents()) {
			assert.strictEqual(a.permissionMode, 'read_only', `agent ${a.name} should be read_only`)
			assert.strictEqual(a.permission?.denyDelegation, true, `agent ${a.name} must denyDelegation`)
		}
	})

	test('getBuiltinAgent is case-insensitive and trims', () => {
		assert.ok(getBuiltinAgent('EXPLORE'))
		assert.ok(getBuiltinAgent('  reviewer  '))
		assert.strictEqual(getBuiltinAgent('does-not-exist'), undefined)
	})

	test('buildSubAgentRegistry exposes every entry', () => {
		const reg = buildSubAgentRegistry()
		for (const a of BUILTIN_SUBAGENTS) {
			assert.ok(reg.get(a.name.toLowerCase()))
		}
	})
})
