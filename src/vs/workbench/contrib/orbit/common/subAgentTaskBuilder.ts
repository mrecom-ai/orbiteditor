/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SubAgentDefinition, SubAgentTaskToolParams } from './subAgentTypes.js';

export type SubAgentTaskValidationResult = {
	ok: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Validate sub-agent task params against the agent definition. The orchestrator
 * already enforces the hard requirements (subagent_type, description, prompt)
 * via toolsService.validateParams.task; this function adds soft guidance for
 * visible agents about objective and expected output.
 *
 * Errors fail the call; warnings only inform the orchestrator log.
 */
export function validateSubAgentTaskParams(
	params: SubAgentTaskToolParams,
	agent: SubAgentDefinition | undefined,
): SubAgentTaskValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (!params.subagent_type || !params.subagent_type.trim()) {
		errors.push('subagent_type is required')
	}
	if (!params.description || !params.description.trim()) {
		errors.push('description is required')
	}
	if (!params.prompt || !params.prompt.trim()) {
		errors.push('prompt is required')
	}

	if (params.description && params.description.length > 120) {
		errors.push('description too long (max 120 chars)')
	}

	// Soft warnings only apply to visible sub-agents — primary helpers are
	// invoked internally and don't have a parent-supplied objective.
	if (agent && agent.mode === 'subagent' && !agent.hidden) {
		if (!params.objective || !params.objective.trim()) {
			warnings.push('No `objective` provided. The sub-agent will infer it from `description`, which weakens result quality.')
		}
		if (!params.expected_output || !params.expected_output.trim()) {
			warnings.push('No `expected_output` provided. Recommend describing the report shape so the sub-agent has a target.')
		}
	}

	return {
		ok: errors.length === 0,
		errors,
		warnings,
	}
}

/**
 * Build the task prompt text fed to the sub-agent as the first user message.
 * Centralised here so the orchestrator and the repair pass produce the
 * same shape; the validator can also count keyword overlap against this text.
 */
export function buildSubAgentTaskPrompt(
	params: SubAgentTaskToolParams,
	agent: SubAgentDefinition | undefined,
): string {
	const description = (params.description || '').trim() || 'Sub-agent task'
	const command = (params.command || '').trim()
	const prompt = (params.prompt || '').trim()
	const objective = (params.objective || '').trim()
	const expectedOutput = (params.expected_output || '').trim()
	const acceptance = (params.acceptance_criteria || '').trim()
	const scope = (params.scope || '').trim()

	if (!prompt) {
		throw new Error('Task prompt cannot be empty. Please provide clear instructions.')
	}

	const lines: string[] = []
	lines.push(`Task: ${description}`)
	if (command) {
		lines.push(`Context: ${command}`)
	}

	const effectiveObjective = objective || (agent?.mode === 'subagent' && !agent.hidden
		? `Complete the work described above, producing the structured report defined by the @${agent.name} agent contract.`
		: '')

	if (effectiveObjective) {
		lines.push('')
		lines.push('Objective:')
		lines.push(effectiveObjective)
	}

	if (expectedOutput) {
		lines.push('')
		lines.push('Expected output:')
		lines.push(expectedOutput)
	}

	if (acceptance) {
		lines.push('')
		lines.push('Acceptance criteria:')
		// Allow either newline-separated or `;`-separated input; render as bullets.
		const items = acceptance
			.split(/\r?\n|\s*;\s*/)
			.map(s => s.trim())
			.filter(Boolean)
		for (const item of items) {
			lines.push(`- ${item.replace(/^[-*+]\s*/, '')}`)
		}
	}

	if (scope) {
		lines.push('')
		lines.push('Scope:')
		lines.push(scope)
	}

	lines.push('')
	lines.push('Instructions:')
	lines.push(prompt)

	return lines.join('\n')
}

/**
 * Lowercase-tokenise the objective so the validator can check that the
 * sub-agent report mentions at least one keyword from it.
 */
export function extractObjectiveKeywords(objectiveText: string | undefined): string[] {
	if (!objectiveText) return []
	const STOPWORDS = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
		'has', 'have', 'had', 'do', 'does', 'did', 'to', 'of', 'in', 'on', 'for',
		'with', 'as', 'by', 'at', 'from', 'this', 'that', 'these', 'those',
		'it', 'its', 'into', 'onto', 'about', 'after', 'before', 'over',
		'why', 'how', 'what', 'where', 'when', 'who', 'which',
		'find', 'check', 'review', 'inspect', 'list', 'show', 'all', 'any',
		'should', 'would', 'could', 'will', 'can', 'use', 'using', 'used',
	])
	return objectiveText
		.toLowerCase()
		.replace(/[`*_~\[\]\(\)>#]/g, ' ')
		.split(/[^a-z0-9_./-]+/)
		.map(t => t.trim())
		.filter(t => t.length >= 4 && !STOPWORDS.has(t))
}
