/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { extractObjectiveKeywords } from './subAgentTaskBuilder.js';
import type { AgentOutputContract, SubAgentChildReport, SubAgentDefinition } from './subAgentTypes.js';

// ── Chatty / generic phrase detection ───────────────────────────────────────

const CHATTY_PHRASES: ReadonlyArray<string> = [
	'what would you like',
	'how can i help',
	'i can help you',
	'let me know if',
	'would you like me to',
	"i see you've shared",
	"i see you've uploaded",
	"you've shared",
	"you've uploaded",
	'what do you want',
	'what would you want',
	'feel free to ask',
	'is there anything else',
	'happy to help',
	"i'd be happy",
	'shall i continue',
	'do you want me to',
]

export function containsChattyPhrase(text: string | undefined): { yes: boolean; phrase?: string } {
	if (!text) return { yes: false }
	const lower = text.toLowerCase()
	for (const phrase of CHATTY_PHRASES) {
		if (lower.includes(phrase)) return { yes: true, phrase }
	}
	return { yes: false }
}

// ── Validator types ─────────────────────────────────────────────────────────

export type ValidationErrorCode =
	| 'CHATTY'
	| 'EMPTY_SUMMARY'
	| 'MISSING_FINDINGS'
	| 'MISSING_EVIDENCE'
	| 'EVIDENCE_PATH_SHAPE'
	| 'MISSING_FILES_INSPECTED'
	| 'FORBIDDEN_FILES_CHANGED'
	| 'MISSING_FILES_CHANGED'
	| 'MISSING_COMMANDS_RUN'
	| 'MISSING_RISKS'
	| 'MISSING_RECOMMENDATIONS'
	| 'OBJECTIVE_NOT_ANSWERED'
	| 'TOO_GENERIC'

export type ValidationError = {
	code: ValidationErrorCode;
	message: string;
	severity: 'block' | 'soft';
}

export type ValidationResult = {
	ok: boolean;
	errors: ValidationError[];
	confidenceBand: 'low' | 'medium' | 'high';
}

export type ValidationContext = {
	agent: SubAgentDefinition;
	contract?: AgentOutputContract;
	objective?: string;
}

// ── Heuristics ──────────────────────────────────────────────────────────────

const MIN_BULLET_LEN = 12

const PATH_SHAPE_REGEX = /[\\/]|\.[a-z0-9]{1,6}\b|\b[A-Z][A-Za-z0-9]*Service\b|\b[A-Z][A-Za-z0-9]*Controller\b/

function bulletHasPathShape(bullet: string): boolean {
	return PATH_SHAPE_REGEX.test(bullet)
}

function evidenceHasPathShape(path: string): boolean {
	if (!path) return false
	if (path.includes('/') || path.includes('\\')) return true
	if (/\.[a-z0-9]{1,6}$/i.test(path)) return true
	if (/^[A-Z][A-Za-z0-9]*$/.test(path)) return true // class/service token
	return false
}

function confidenceToBand(confidence: number | undefined): 'low' | 'medium' | 'high' {
	if (typeof confidence !== 'number' || !isFinite(confidence)) return 'low'
	if (confidence >= 0.7) return 'high'
	if (confidence >= 0.45) return 'medium'
	return 'low'
}

function objectiveAnswered(report: Partial<SubAgentChildReport>, objective: string | undefined): boolean {
	if (!objective || objective.trim().length === 0) return true
	const keywords = extractObjectiveKeywords(objective)
	if (keywords.length === 0) return true
	const haystack = [
		report.oneLineSummary,
		...(report.summaryBullets ?? []),
		...((report.evidence ?? []).map(e => `${e.path} ${e.rationale}`)),
		report.rawResponse,
	].filter((x): x is string => typeof x === 'string').join('\n').toLowerCase()
	return keywords.some(k => haystack.includes(k))
}

// ── Main validator ──────────────────────────────────────────────────────────

export function validateSubAgentReport(
	report: Partial<SubAgentChildReport>,
	ctx: ValidationContext,
): ValidationResult {
	const errors: ValidationError[] = []
	const contract: AgentOutputContract = ctx.contract ?? ctx.agent.outputContract ?? {}

	// 1) Chatty content (any tier, hard block).
	const chatty = containsChattyPhrase(report.rawResponse) // detect on the raw text the model produced
	if (chatty.yes) {
		errors.push({
			code: 'CHATTY',
			severity: 'block',
			message: `Output contains chatty phrase ("${chatty.phrase}"). Workers must not address the user.`,
		})
	}

	const summary = (report.oneLineSummary ?? report.summaryBullets?.[0] ?? '').trim()

	// 2) One-line / non-empty summary.
	if (contract.requireOneLineSummary !== false && !summary) {
		errors.push({
			code: 'EMPTY_SUMMARY',
			severity: 'block',
			message: 'No summary line. Worker must produce at least one informative sentence.',
		})
	}

	const bullets = (report.summaryBullets ?? []).filter(b => b && b.trim().length >= MIN_BULLET_LEN)

	// 3) Findings.
	if (contract.requireFindings && bullets.length === 0) {
		errors.push({
			code: 'MISSING_FINDINGS',
			severity: 'block',
			message: 'Findings section is empty or contains only generic single-word lines.',
		})
	}

	// 4) Evidence.
	const evidence = report.evidence ?? []
	if (contract.requireEvidence) {
		if (evidence.length === 0) {
			errors.push({
				code: 'MISSING_EVIDENCE',
				severity: 'block',
				message: 'Evidence section is empty. Read-only research must cite at least one file.',
			})
		} else {
			const goodEvidence = evidence.some(e => evidenceHasPathShape(e.path))
			if (!goodEvidence) {
				errors.push({
					code: 'EVIDENCE_PATH_SHAPE',
					severity: 'block',
					message: 'Evidence paths do not look like file paths or service names. Cite real artifacts.',
				})
			}
		}
	}

	// 5) Files inspected (strong signal for explorer).
	if (contract.requireFilesInspected) {
		const filesInspected = report.filesInspected ?? []
		// Accept the field if it's present, OR if evidence has at least one path-shaped entry
		// (so the orchestrator can derive filesInspected from evidence).
		const hasInspection = filesInspected.length > 0 || evidence.some(e => evidenceHasPathShape(e.path))
		if (!hasInspection) {
			errors.push({
				code: 'MISSING_FILES_INSPECTED',
				severity: 'block',
				message: 'No files inspected. Explorer agent must inspect files before reporting.',
			})
		}
	}

	// 6) Forbid filesChanged for read-only/safe-read tiers.
	if (contract.forbidFilesChanged) {
		const changed = report.filesChanged ?? []
		if (changed.length > 0) {
			errors.push({
				code: 'FORBIDDEN_FILES_CHANGED',
				severity: 'block',
				message: 'Read-only agent reported changed files. Read-only agents must not modify the workspace.',
			})
		}
	}

	// 7) Require filesChanged for write-tier agents.
	if (contract.requireFilesChanged) {
		const changed = report.filesChanged ?? []
		if (changed.length === 0) {
			errors.push({
				code: 'MISSING_FILES_CHANGED',
				severity: 'block',
				message: 'Write-tier agent did not report any changed files.',
			})
		}
	}

	// 8) Require commandsRun for verification agents.
	if (contract.requireCommandsRun) {
		const commands = report.commandsRun ?? []
		if (commands.length === 0) {
			// Soft because the test-verifier in this iteration only RECOMMENDS commands.
			errors.push({
				code: 'MISSING_COMMANDS_RUN',
				severity: 'soft',
				message: 'No commands documented. Verification agent should list the commands it inspected or recommends.',
			})
		}
	}

	// 9) Require risks/recommendations as soft.
	if (contract.requireRisks) {
		const risks = report.risks ?? report.openQuestions ?? []
		if (risks.length === 0) {
			errors.push({
				code: 'MISSING_RISKS',
				severity: 'soft',
				message: 'No risks documented. Reviewers should surface at least one.',
			})
		}
	}

	if (contract.requireRecommendations) {
		const recs = report.recommendations ?? []
		if (recs.length === 0) {
			errors.push({
				code: 'MISSING_RECOMMENDATIONS',
				severity: 'soft',
				message: 'No recommendations documented. Planner/UX agents should propose next steps.',
			})
		}
	}

	// 10) Objective overlap (soft — language can vary).
	if (!objectiveAnswered(report, ctx.objective)) {
		errors.push({
			code: 'OBJECTIVE_NOT_ANSWERED',
			severity: 'soft',
			message: 'Report does not appear to mention any keyword from the original objective.',
		})
	}

	// 11) Too-generic catch-all (soft) — every bullet is short or pathless.
	if (bullets.length > 0) {
		const concrete = bullets.filter(bulletHasPathShape).length
		if (concrete === 0 && (contract.requireFindings || contract.requireEvidence)) {
			errors.push({
				code: 'TOO_GENERIC',
				severity: 'soft',
				message: 'All findings are generic — none cite a file path, service, or symbol name.',
			})
		}
	}

	const blocked = errors.some(e => e.severity === 'block')
	const softCount = errors.filter(e => e.severity === 'soft').length
	const baseBand = confidenceToBand(report.confidence)
	const band: 'low' | 'medium' | 'high' = blocked
		? 'low'
		: softCount >= 2 && baseBand !== 'high' ? 'low'
		: softCount >= 1 && baseBand === 'high' ? 'medium'
		: baseBand

	return {
		ok: !blocked,
		errors,
		confidenceBand: band,
	}
}
