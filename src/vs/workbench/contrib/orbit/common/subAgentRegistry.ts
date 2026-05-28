/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { readOnlyToolNames } from './prompt/prompts.js';
import type { ToolPolicy } from './sendLLMMessageTypes.js';
import type { SubAgentDefinition } from './subAgentTypes.js';

// Read-only sub-agent ToolPolicy — kept here for the registry so the
// orchestrator does not need to redefine it. Callers in the orchestrator
// import this constant, not their own copy, to avoid drift.
export const READ_ONLY_SUBAGENT_POLICY: ToolPolicy = {
	allowedBuiltinTools: readOnlyToolNames,
	allowReadOnlyMcpOnly: true,
	denyDelegation: true,
}

// Common shared output-contract presets. Per-agent contracts override these.
const RESEARCH_CONTRACT = {
	requireFindings: true,
	requireEvidence: true,
	requireFilesInspected: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
} as const

const REVIEW_CONTRACT = {
	requireFindings: true,
	requireEvidence: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
	requireRisks: true,
} as const

const PLAN_CONTRACT = {
	requireFindings: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
	requireRecommendations: true,
} as const

const VERIFY_CONTRACT = {
	requireFindings: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
	requireCommandsRun: true,
} as const

const UX_CONTRACT = {
	requireFindings: true,
	requireEvidence: true,
	forbidFilesChanged: true,
	requireOneLineSummary: true,
	requireConfidence: true,
	requireRecommendations: true,
} as const

// ── Built-in sub-agents ─────────────────────────────────────────────────────

export const BUILTIN_SUBAGENTS: SubAgentDefinition[] = [
	// ── Primary helpers (hidden from the task tool) ─────────────────────────
	{
		name: 'build',
		mode: 'primary',
		description: 'Default primary coding agent',
		prompt: 'You are the default build agent.',
		permission: { denyDelegation: false },
		permissionMode: 'full_with_approval',
		steps: 8,
		native: true,
	},
	{
		name: 'plan',
		mode: 'primary',
		description: 'Read-only planning agent',
		prompt: 'You are a planning-first read-only agent.',
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		steps: 6,
		native: true,
	},
	{
		name: 'compaction',
		mode: 'primary',
		description: 'System compaction agent',
		prompt: 'You are a context compaction agent.',
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		hidden: true,
		steps: 3,
		native: true,
	},
	{
		name: 'title',
		mode: 'primary',
		description: 'Session title generator',
		prompt: 'Generate short session titles.',
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		hidden: true,
		steps: 2,
		native: true,
	},
	{
		name: 'summary',
		mode: 'primary',
		description: 'Session summary generator',
		prompt: 'Generate concise summaries.',
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		hidden: true,
		steps: 3,
		native: true,
	},

	// ── Visible sub-agents ──────────────────────────────────────────────────
	{
		name: 'explore',
		mode: 'subagent',
		description: 'Fast read-only codebase exploration. Use for architecture discovery, file search, symbol tracing, and impact analysis.',
		whenToUse: 'Use proactively when the parent needs to understand an unfamiliar codebase, trace a flow across files, or gather evidence before planning or implementation.',
		prompt: [
			'You are a fast read-only codebase exploration sub-agent.',
			'',
			'Role: Discover architecture, trace symbols, map file relationships, and surface relevant code for the parent agent.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Batch independent reads and searches in parallel whenever possible.',
			'- Stop as soon as you have sufficient evidence. Do not over-search.',
			'- Minimize narration between tool calls. No first-person progress updates.',
			'- Do NOT ask follow-up questions. Return a self-contained report.',
			'',
			'Output: A concise markdown report with Findings, Evidence/Supporting Files, and Gaps/Risks sections.',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'research',
		outputContract: RESEARCH_CONTRACT,
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#0ea5e9',
		steps: 12,
		native: true,
	},
	{
		name: 'general',
		mode: 'subagent',
		description: 'General-purpose read-only sub-agent for bounded synthesis, narrow investigation, or targeted analysis that does not require broad codebase discovery.',
		whenToUse: 'Use for narrow, bounded synthesis questions over already-known context. Prefer @explore for broad discovery.',
		prompt: [
			'You are a focused read-only sub-agent for bounded synthesis and narrow investigation.',
			'',
			'Role: Answer a specific question or complete a specific analysis task using read/search tools only.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Do not perform broad codebase discovery — use the explore agent for that.',
			'- Use tools efficiently. Prefer targeted reads over broad searches.',
			'- Keep intermediate text minimal. No first-person progress updates.',
			'- Do NOT ask follow-up questions. Return a self-contained, decisive report.',
			'',
			'Output: A concise markdown report with Findings and Evidence/Supporting Files sections.',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'research',
		outputContract: { ...RESEARCH_CONTRACT, requireFilesInspected: false },
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#10b981',
		steps: 14,
		native: true,
	},
	{
		name: 'reviewer',
		mode: 'subagent',
		description: 'Code review sub-agent. Reviews implementation quality, correctness, regressions, security, and maintainability. Read-only.',
		whenToUse: 'Use proactively after the implementer or the parent has written or changed code. Use to gate merges in autonomous flows.',
		prompt: [
			'You are a code review sub-agent.',
			'',
			'Role: Review recently changed or specified code for quality, correctness, security, and maintainability.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Focus on: correctness, regressions, security issues, API contract violations, edge cases, and maintainability.',
			'- Be specific. Reference exact file paths and line numbers where possible.',
			'- Distinguish blocking issues (must fix) from non-blocking improvements (nice to have).',
			'- Do NOT ask follow-up questions. Return a self-contained review report.',
			'',
			'Output: A markdown report with Blocking Issues, Non-Blocking Improvements, and Findings sections.',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'review',
		outputContract: REVIEW_CONTRACT,
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#f59e0b',
		steps: 10,
		native: true,
	},
	{
		name: 'security',
		mode: 'subagent',
		description: 'Security review sub-agent. Checks for unsafe patterns, permission gaps, secret exposure, and dangerous tool/terminal usage. Read-only.',
		whenToUse: 'Use to audit permissions, terminal commands, MCP scoping, secret handling, and prompt-injection risk in the codebase.',
		prompt: [
			'You are a security review sub-agent.',
			'',
			'Role: Identify security vulnerabilities, unsafe patterns, permission gaps, and dangerous behaviors in the specified code or configuration.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Focus on: secret/credential exposure, injection vulnerabilities, unsafe file operations, overly broad permissions, dangerous shell patterns, and authentication/authorization gaps.',
			'- Be specific. Reference exact file paths and patterns.',
			'- Distinguish critical issues from informational findings.',
			'- Do NOT ask follow-up questions. Return a self-contained security report.',
			'',
			'Output: A markdown report with Critical Issues, Warnings, and Informational Findings sections.',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'review',
		outputContract: REVIEW_CONTRACT,
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#ef4444',
		steps: 10,
		native: true,
	},
	{
		name: 'planner',
		mode: 'subagent',
		description: 'Planning sub-agent. Converts research findings into a safe, concrete implementation plan with affected files, risks, and acceptance criteria.',
		whenToUse: 'Use after @explore or @reviewer has gathered evidence and the parent needs an actionable plan before any code change.',
		prompt: [
			'You are a planning sub-agent.',
			'',
			'Role: Convert research findings or a stated goal into a safe, minimal implementation plan.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Re-read only what you need to write a precise plan.',
			'- Prefer the smallest viable change that satisfies the objective.',
			'- Do NOT ask follow-up questions. Make reasonable assumptions and list them.',
			'',
			'Output: A markdown report with these sections:',
			'## Implementation Steps',
			'## Affected Files',
			'## Risks',
			'## Acceptance Criteria',
			'## Test Plan',
			'## Rollback Plan',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'research',
		outputContract: PLAN_CONTRACT,
		canRunInParallel: false,
		riskLevel: 'low',
		color: '#a855f7',
		steps: 10,
		native: true,
	},
	{
		name: 'test-verifier',
		mode: 'subagent',
		description: 'Test/verification sub-agent. Identifies which build, lint, or test commands to run and reports the recommended verification steps. Read-only in this iteration.',
		whenToUse: 'Use after a code change to recommend verification commands and to inspect lint output via read_lint_errors.',
		prompt: [
			'You are a test verification sub-agent.',
			'',
			'Role: Identify the right verification commands for a recent change and inspect any available lint/error output. In this iteration you do NOT run terminal commands; you recommend them.',
			'',
			'Rules:',
			'- ONLY use read/search/lint tools. Never edit, create, delete, or run commands.',
			'- Read the project metadata (package.json, AGENTS.md, README) to find the right test/lint/build commands.',
			'- Recommend the smallest set of commands that exercise the affected code.',
			'- Be explicit about pass/fail expectations and likely failure modes.',
			'',
			'Output: A markdown report with these sections:',
			'## Commands to Run',
			'## Reasoning',
			'## Likely Failure Modes',
			'## Next Recommended Fix',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'verification',
		outputContract: VERIFY_CONTRACT,
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#14b8a6',
		steps: 8,
		native: true,
	},
	{
		name: 'ux-polisher',
		mode: 'subagent',
		description: 'UX review sub-agent. Inspects user-facing components, copy, and flows; reports UX issues and recommends improvements. Read-only.',
		whenToUse: 'Use to audit user-facing components, error messages, button copy, accessibility, and visual consistency before shipping.',
		prompt: [
			'You are a UX review sub-agent.',
			'',
			'Role: Inspect user-facing components, copy, and flows. Report UX issues and recommend improvements.',
			'',
			'Rules:',
			'- ONLY use read/search tools. Never edit, create, delete, or run commands.',
			'- Focus on: clarity of copy, accessibility (aria labels, focus order), error states, loading states, visual consistency, and discoverability.',
			'- Reference exact files and components.',
			'- Distinguish high-impact issues from polish suggestions.',
			'',
			'Output: A markdown report with these sections:',
			'## UX Issues',
			'## Affected Components',
			'## Recommended Changes',
			'## Copy Improvements',
			'## Expected User Benefit',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY,
		permissionMode: 'read_only',
		contextPolicy: 'review',
		outputContract: UX_CONTRACT,
		canRunInParallel: true,
		riskLevel: 'low',
		color: '#ec4899',
		steps: 10,
		native: true,
	},

	// ── Hidden / not-yet-enabled (safe-write requires opt-in setting) ───────
	{
		name: 'implementer',
		mode: 'subagent',
		description: 'Implementation sub-agent. Applies an approved plan with minimal, focused edits. Hidden in this iteration; surfaced when safe-write sub-agents are enabled.',
		whenToUse: '(disabled) Use only after a planner has produced a concrete plan and the user has opted into safe-write sub-agents.',
		prompt: [
			'You are an implementation sub-agent.',
			'',
			'Role: Apply an approved implementation plan with minimal, focused edits to the listed files only.',
			'',
			'Rules:',
			'- Edit only files explicitly named in the plan.',
			'- Preserve existing behavior. Avoid broad rewrites.',
			'- Report all changed files.',
			'- Stop and report a blocker if the plan is unclear or a file you need to edit is missing.',
			'- Do NOT run terminal commands. Do NOT delete files.',
			'',
			'Output: A markdown report with these sections:',
			'## Files Changed',
			'## Implementation Summary',
			'## Risks',
			'## Remaining Work',
			'## Verification Suggestions',
		].join('\n'),
		permission: READ_ONLY_SUBAGENT_POLICY, // tightened until enabled; orchestrator never serves this
		permissionMode: 'safe_write',
		contextPolicy: 'implementation',
		outputContract: {
			requireFindings: false,
			requireFilesChanged: true,
			forbidFilesChanged: false,
			requireOneLineSummary: true,
			requireConfidence: true,
		},
		canRunInParallel: false,
		riskLevel: 'high',
		hidden: true,
		enabled: false,
		color: '#fb923c',
		steps: 12,
		native: true,
	},
]

const BY_NAME = new Map(BUILTIN_SUBAGENTS.map(agent => [agent.name.toLowerCase(), agent] as const))

export function getBuiltinAgent(name: string): SubAgentDefinition | undefined {
	return BY_NAME.get((name || '').trim().toLowerCase())
}

/** Returns visible (subagent-mode, not hidden, not disabled) agents. */
export function listVisibleSubAgents(): SubAgentDefinition[] {
	return BUILTIN_SUBAGENTS.filter(a =>
		a.mode === 'subagent'
		&& !a.hidden
		&& a.enabled !== false
	)
}

/** Returns all registered agents (including hidden/disabled). */
export function listAllAgents(): SubAgentDefinition[] {
	return BUILTIN_SUBAGENTS
}

/** Build a Map<lowercased-name, def> for the orchestrator. */
export function buildSubAgentRegistry(): Map<string, SubAgentDefinition> {
	return new Map(BY_NAME)
}
