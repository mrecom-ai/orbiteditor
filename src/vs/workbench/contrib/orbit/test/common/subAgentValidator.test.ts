/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { containsChattyPhrase, validateSubAgentReport } from '../../common/subAgentValidator.js';
import type { AgentOutputContract, SubAgentChildReport, SubAgentDefinition } from '../../common/subAgentTypes.js';

const exploreContract: AgentOutputContract = {
	requireFindings: true,
	requireEvidence: true,
	requireFilesInspected: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
}

const reviewerContract: AgentOutputContract = {
	requireFindings: true,
	requireEvidence: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
	requireRisks: true,
}

const exploreAgent: SubAgentDefinition = {
	name: 'explore',
	mode: 'subagent',
	description: 'codebase explorer',
	prompt: 'system prompt',
	permission: { denyDelegation: true },
	permissionMode: 'read_only',
	outputContract: exploreContract,
}

const reviewerAgent: SubAgentDefinition = {
	name: 'reviewer',
	mode: 'subagent',
	description: 'code reviewer',
	prompt: 'system prompt',
	permission: { denyDelegation: true },
	permissionMode: 'read_only',
	outputContract: reviewerContract,
}

const goodReport: Partial<SubAgentChildReport> = {
	rawResponse: 'Authentication entrypoints traced. The flow goes through AuthService and middleware/auth.ts.',
	oneLineSummary: 'Auth flow goes through AuthService and middleware/auth.ts.',
	summaryBullets: [
		'AuthService at src/auth/authService.ts is the main entrypoint',
		'middleware/auth.ts validates JWT before each request',
		'Token refresh handled in src/auth/refresh.ts',
	],
	evidence: [
		{ path: 'src/auth/authService.ts', rationale: 'Main service' },
		{ path: 'src/middleware/auth.ts', rationale: 'JWT validation' },
	],
	openQuestions: [],
	confidence: 0.7,
	filesChanged: [],
}

suite('subAgentValidator', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	suite('containsChattyPhrase', () => {
		test('detects classic chatty phrases', () => {
			assert.strictEqual(containsChattyPhrase('What would you like me to do?').yes, true)
			assert.strictEqual(containsChattyPhrase('I can help you with that').yes, true)
			assert.strictEqual(containsChattyPhrase('Let me know if you need anything else').yes, true)
			assert.strictEqual(containsChattyPhrase('Happy to help!').yes, true)
		})

		test('does not flag normal worker output', () => {
			assert.strictEqual(containsChattyPhrase('AuthService at src/auth/authService.ts validates tokens.').yes, false)
			assert.strictEqual(containsChattyPhrase('Findings: 3 entrypoints, 2 risks.').yes, false)
		})

		test('returns false for empty/undefined input', () => {
			assert.strictEqual(containsChattyPhrase(undefined).yes, false)
			assert.strictEqual(containsChattyPhrase('').yes, false)
		})
	})

	suite('validateSubAgentReport — explore (read-only research) contract', () => {
		test('rejects chatty content', () => {
			const r: Partial<SubAgentChildReport> = {
				...goodReport,
				rawResponse: 'I can help you with that. What would you like me to do next?',
			}
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'CHATTY' && e.severity === 'block'))
		})

		test('rejects missing summary', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, oneLineSummary: undefined, summaryBullets: [] }
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'EMPTY_SUMMARY'))
		})

		test('rejects missing findings', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, summaryBullets: [] }
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'MISSING_FINDINGS'))
		})

		test('rejects missing evidence', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, evidence: [] }
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'MISSING_EVIDENCE'))
		})

		test('rejects evidence without path-shape', () => {
			const r: Partial<SubAgentChildReport> = {
				...goodReport,
				evidence: [{ path: 'something', rationale: 'r' }],
			}
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'EVIDENCE_PATH_SHAPE'))
		})

		test('rejects forbidden filesChanged for read-only', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, filesChanged: ['src/auth/authService.ts'] }
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.ok, false)
			assert.ok(v.errors.some(e => e.code === 'FORBIDDEN_FILES_CHANGED'))
		})

		test('accepts a well-formed evidence-based explorer report', () => {
			const v = validateSubAgentReport(goodReport, { agent: exploreAgent, objective: 'authentication entrypoints' })
			assert.strictEqual(v.ok, true, `expected ok, got errors: ${v.errors.map(e => e.code).join(', ')}`)
			assert.strictEqual(v.confidenceBand, 'high')
		})

		test('soft-fails (still ok) when objective keywords are not present', () => {
			const v = validateSubAgentReport(goodReport, { agent: exploreAgent, objective: 'database migration patterns' })
			// not blocking — soft warning only
			assert.strictEqual(v.ok, true)
			assert.ok(v.errors.some(e => e.code === 'OBJECTIVE_NOT_ANSWERED' && e.severity === 'soft'))
		})
	})

	suite('validateSubAgentReport — reviewer contract', () => {
		test('soft-warns when risks are missing', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, openQuestions: [] }
			const v = validateSubAgentReport(r, { agent: reviewerAgent })
			assert.strictEqual(v.ok, true)
			assert.ok(v.errors.some(e => e.code === 'MISSING_RISKS' && e.severity === 'soft'))
		})
	})

	suite('confidence band', () => {
		test('reports low band when blocked', () => {
			const r: Partial<SubAgentChildReport> = { ...goodReport, summaryBullets: [] }
			const v = validateSubAgentReport(r, { agent: exploreAgent })
			assert.strictEqual(v.confidenceBand, 'low')
		})

		test('reports high band when good and confidence ≥ 0.7', () => {
			const v = validateSubAgentReport({ ...goodReport, confidence: 0.85 }, { agent: exploreAgent, objective: 'authentication' })
			assert.strictEqual(v.confidenceBand, 'high')
		})

		test('demotes high → medium when one soft-fail occurs', () => {
			const v = validateSubAgentReport({ ...goodReport, confidence: 0.85 }, { agent: exploreAgent, objective: 'unrelated topic xyz123' })
			// objective_not_answered soft fails
			assert.strictEqual(v.confidenceBand, 'medium')
		})
	})
})
