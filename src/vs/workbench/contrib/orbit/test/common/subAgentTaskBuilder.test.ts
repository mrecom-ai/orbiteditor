/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildSubAgentTaskPrompt, extractObjectiveKeywords, validateSubAgentTaskParams } from '../../common/subAgentTaskBuilder.js';
import type { SubAgentDefinition, SubAgentTaskToolParams } from '../../common/subAgentTypes.js';

const exploreAgent: SubAgentDefinition = {
	name: 'explore',
	mode: 'subagent',
	description: 'codebase explorer',
	prompt: 'system prompt',
	permission: { denyDelegation: true },
	permissionMode: 'read_only',
}

const hiddenHelper: SubAgentDefinition = {
	name: 'compaction',
	mode: 'primary',
	description: 'helper',
	prompt: 'system prompt',
	permission: {},
	permissionMode: 'read_only',
	hidden: true,
}

suite('subAgentTaskBuilder', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	suite('validateSubAgentTaskParams', () => {
		test('rejects missing subagent_type', () => {
			const params: SubAgentTaskToolParams = { subagent_type: '', description: 'd', prompt: 'p' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, false)
			assert.ok(result.errors.some(e => e.includes('subagent_type')))
		})

		test('rejects missing description', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: '', prompt: 'p' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, false)
		})

		test('rejects missing prompt', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: 'd', prompt: '' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, false)
		})

		test('rejects description over 120 chars', () => {
			const longDescription = 'x'.repeat(121)
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: longDescription, prompt: 'p' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, false)
			assert.ok(result.errors.some(e => e.includes('120 chars')))
		})

		test('warns when objective missing for visible agent', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: 'd', prompt: 'p' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, true) // soft, not blocking
			assert.ok(result.warnings.some(w => w.includes('objective')), `expected objective warning, got: ${result.warnings.join(' | ')}`)
		})

		test('warns when expected_output missing for visible agent', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: 'd', prompt: 'p', objective: 'do work' }
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, true)
			assert.ok(result.warnings.some(w => w.includes('expected_output')))
		})

		test('does not warn for hidden helper agents', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'compaction', description: 'd', prompt: 'p' }
			const result = validateSubAgentTaskParams(params, hiddenHelper)
			assert.strictEqual(result.ok, true)
			assert.strictEqual(result.warnings.length, 0)
		})

		test('accepts a fully-formed task', () => {
			const params: SubAgentTaskToolParams = {
				subagent_type: 'explore',
				description: 'trace auth',
				prompt: 'find auth flows',
				objective: 'identify entrypoints',
				expected_output: 'bullets + evidence',
			}
			const result = validateSubAgentTaskParams(params, exploreAgent)
			assert.strictEqual(result.ok, true)
			assert.strictEqual(result.warnings.length, 0)
		})
	})

	suite('buildSubAgentTaskPrompt', () => {
		test('throws on empty prompt', () => {
			assert.throws(() => buildSubAgentTaskPrompt({ subagent_type: 'explore', description: 'd', prompt: '' }, exploreAgent))
		})

		test('renders Task and Instructions sections at minimum', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: 'trace flow', prompt: 'detail here' }
			const text = buildSubAgentTaskPrompt(params, exploreAgent)
			assert.ok(text.includes('Task: trace flow'))
			assert.ok(text.includes('Instructions:'))
			assert.ok(text.includes('detail here'))
		})

		test('includes Objective and Expected output sections when provided', () => {
			const params: SubAgentTaskToolParams = {
				subagent_type: 'explore',
				description: 'd',
				prompt: 'p',
				objective: 'find authentication entrypoints',
				expected_output: 'bullets + key files',
			}
			const text = buildSubAgentTaskPrompt(params, exploreAgent)
			assert.ok(text.includes('Objective:'))
			assert.ok(text.includes('find authentication entrypoints'))
			assert.ok(text.includes('Expected output:'))
			assert.ok(text.includes('bullets + key files'))
		})

		test('renders Acceptance criteria as bullets, supporting newline OR semicolon separators', () => {
			const params: SubAgentTaskToolParams = {
				subagent_type: 'explore',
				description: 'd',
				prompt: 'p',
				acceptance_criteria: 'list at least 3 files; mention the auth service\nname the middleware chain',
			}
			const text = buildSubAgentTaskPrompt(params, exploreAgent)
			assert.ok(text.includes('Acceptance criteria:'))
			assert.ok(text.includes('- list at least 3 files'))
			assert.ok(text.includes('- mention the auth service'))
			assert.ok(text.includes('- name the middleware chain'))
		})

		test('includes Scope section when provided', () => {
			const params: SubAgentTaskToolParams = {
				subagent_type: 'explore',
				description: 'd',
				prompt: 'p',
				scope: 'src/auth and src/middleware only',
			}
			const text = buildSubAgentTaskPrompt(params, exploreAgent)
			assert.ok(text.includes('Scope:'))
			assert.ok(text.includes('src/auth and src/middleware only'))
		})

		test('inserts a default objective for visible agents when none is provided', () => {
			const params: SubAgentTaskToolParams = { subagent_type: 'explore', description: 'd', prompt: 'p' }
			const text = buildSubAgentTaskPrompt(params, exploreAgent)
			assert.ok(text.includes('Objective:'))
		})
	})

	suite('extractObjectiveKeywords', () => {
		test('returns empty for empty input', () => {
			assert.deepStrictEqual(extractObjectiveKeywords(undefined), [])
			assert.deepStrictEqual(extractObjectiveKeywords(''), [])
		})

		test('strips stopwords and short words', () => {
			const k = extractObjectiveKeywords('Find the authentication entrypoints and middleware chain')
			assert.ok(k.includes('authentication'))
			assert.ok(k.includes('entrypoints'))
			assert.ok(k.includes('middleware'))
			assert.ok(k.includes('chain'))
			assert.ok(!k.includes('the'))
			assert.ok(!k.includes('and'))
			assert.ok(!k.includes('find'))
		})

		test('preserves file path and dotted tokens', () => {
			const k = extractObjectiveKeywords('Inspect src/foo.ts and the AuthService class')
			assert.ok(k.includes('src/foo.ts') || k.includes('foo.ts'))
			assert.ok(k.some(t => t.toLowerCase().includes('authservice')))
		})
	})
})
