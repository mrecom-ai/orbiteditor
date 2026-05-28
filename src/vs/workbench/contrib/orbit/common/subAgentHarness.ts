/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { isMCPToolReadOnly, readOnlyToolNames, resolveBuiltinToolNameLoose, type InternalToolInfo } from './prompt/prompts.js';
import type { RawToolParamsObj, ToolPolicy } from './sendLLMMessageTypes.js';
import { applyBackgroundDefaults, isTerminalTaskStatus, markNotified, releaseTask, retainTask, transitionToTerminal, type SubAgentEvidence, type SubAgentTaskRecord, type SubAgentTaskStatus } from './subAgentTypes.js';
import type { BuiltinToolName } from './toolsServiceTypes.js';

const formatToolName = (toolName: string): string => {
	return toolName
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')
}

export type ParsedSubAgentReport = {
	summaryBullets: string[];
	evidence: SubAgentEvidence[];
	openQuestions: string[];
	confidence: number;
	tokenUsageEstimate?: number;
	directMarkdown?: string;
}

export const isSubAgentDelegationToolName = (toolName: string): boolean => {
	const lower = toolName.toLowerCase()
	return lower === 'task'
		|| lower.includes('subagent')
		|| lower.includes('sub_agent')
		|| lower.includes('delegate')
		|| lower.includes('spawn_agent')
}

export const isSubAgentBuiltinToolAllowed = (toolName: string, policy: ToolPolicy): boolean => {
	if (policy.denyDelegation && isSubAgentDelegationToolName(toolName)) return false
	if (!policy.allowedBuiltinTools || policy.allowedBuiltinTools.length === 0) return true
	const resolved = resolveBuiltinToolNameLoose(toolName)
	if (!resolved) return false
	return policy.allowedBuiltinTools.some(allowed => resolveBuiltinToolNameLoose(allowed) === resolved)
}

export const isSubAgentMcpToolAllowed = (tool: InternalToolInfo, policy: ToolPolicy): boolean => {
	if (policy.denyDelegation && isSubAgentDelegationToolName(tool.name)) return false
	if (policy.allowReadOnlyMcpOnly && !isMCPToolReadOnly(tool)) return false
	return true
}

export const readonlySubAgentPolicy: ToolPolicy = {
	allowedBuiltinTools: readOnlyToolNames,
	allowReadOnlyMcpOnly: true,
	denyDelegation: true,
}

export const summarizeSubAgentActivity = (
	toolName: string,
	phase: 'running' | 'completed' | 'failed' | 'denied',
	rawParams: RawToolParamsObj,
): string => {
	const builtinName = resolveBuiltinToolNameLoose(toolName)
	const label = builtinName ? builtinActivityLabel(builtinName, phase) : mcpActivityLabel(toolName, phase)
	const context = activityContext(rawParams)
	return `${label}${context ? ` ${context}` : ''}`
}

const builtinActivityLabel = (toolName: BuiltinToolName, phase: 'running' | 'completed' | 'failed' | 'denied'): string => {
	const base = (() => {
		switch (toolName) {
			case 'read_file': return phase === 'running' ? 'Reading' : 'Read'
			case 'ls_dir': return phase === 'running' ? 'Listing' : 'Listed'
			case 'get_dir_tree': return phase === 'running' ? 'Listing tree' : 'Listed tree'
			case 'search_pathnames_only': return phase === 'running' ? 'Searching filenames' : 'Searched filenames'
			case 'search_for_files': return phase === 'running' ? 'Searching' : 'Searched'
			case 'search_in_file': return phase === 'running' ? 'Searching file' : 'Searched file'
			case 'task': return 'Subagent'
			default: return phase === 'running' ? `Running ${formatToolName(toolName)}` : formatToolName(toolName)
		}
	})()
	if (phase === 'failed') return `${base} failed`
	if (phase === 'denied') return `${base} denied`
	return base
}

const mcpActivityLabel = (toolName: string, phase: 'running' | 'completed' | 'failed' | 'denied'): string => {
	const cleaned = formatToolName(toolName)
	const base = phase === 'running' ? `Calling ${cleaned}` : `Called ${cleaned}`
	if (phase === 'failed') return `${base} failed`
	if (phase === 'denied') return `${base} denied`
	return base
}

const activityContext = (rawParams: RawToolParamsObj): string | null => {
	const params = rawParams as Record<string, unknown>
	const candidates: Array<{ key: string; prefix: string; quoted?: boolean }> = [
		{ key: 'uri', prefix: 'on' },
		{ key: 'path', prefix: 'on' },
		{ key: 'target_file', prefix: 'on' },
		{ key: 'search_in_folder', prefix: 'in' },
		{ key: 'cwd', prefix: 'in' },
		{ key: 'query', prefix: 'for', quoted: true },
		{ key: 'command', prefix: '', quoted: true },
	]
	for (const { key, prefix, quoted } of candidates) {
		const value = params[key]
		if (typeof value !== 'string') continue
		const normalized = value.replace(/\s+/g, ' ').trim()
		if (!normalized) continue
		const clipped = normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
		const displayValue = quoted ? `"${clipped}"` : clipped
		return prefix ? `${prefix} ${displayValue}` : displayValue
	}
	return null
}

export const parseSubAgentReport = (text: string): ParsedSubAgentReport => {
	const trimmed = text.trim()
	const tokenUsageEstimate = trimmed ? Math.ceil(trimmed.length / 4) : undefined
	if (!trimmed) {
		return { summaryBullets: ['Sub-agent returned no report.'], evidence: [], openQuestions: [], confidence: 0.2, tokenUsageEstimate }
	}

	const markdown = extractDelimitedReport(trimmed)
	if (markdown.report) {
		return {
			summaryBullets: extractBullets(extractSection(markdown.report, ['Findings', 'Summary'])).slice(0, 6),
			evidence: extractEvidence(markdown.report),
			openQuestions: extractBullets(extractSection(markdown.report, ['Risks\\s*\\/\\s*Unknowns', 'Risks', 'Unknowns', 'Gaps\\s*\\/\\s*Risks'])).slice(0, 6),
			confidence: markdown.confidence,
			tokenUsageEstimate: markdown.tokenUsageEstimate ?? tokenUsageEstimate,
			directMarkdown: markdown.report,
		}
	}

	const parsed = tryParseReportJson(trimmed)
	if (parsed) {
		return {
			summaryBullets: stringArray(parsed.summaryBullets).slice(0, 6),
			evidence: evidenceArray(parsed.evidence).slice(0, 8),
			openQuestions: stringArray(parsed.openQuestions).slice(0, 6),
			confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.45,
			tokenUsageEstimate: typeof parsed.tokenUsageEstimate === 'number' ? parsed.tokenUsageEstimate : tokenUsageEstimate,
		}
	}

	return {
		summaryBullets: trimmed.split(/\r?\n/).map(line => line.replace(/^[-*+]\s*/, '').trim()).filter(Boolean).slice(0, 6),
		evidence: [],
		openQuestions: [],
		confidence: 0.35,
		tokenUsageEstimate,
	}
}

const extractDelimitedReport = (text: string): { report: string | null; confidence: number; tokenUsageEstimate?: number } => {
	const startMatch = text.match(/==\s*FINAL\s+REPORT\s*==/i)
	const endMatch = text.match(/==\s*END\s+REPORT\s*==/i)
	if (!startMatch || !endMatch) return { report: null, confidence: 0.35, tokenUsageEstimate: text ? Math.ceil(text.length / 4) : undefined }
	const startIndex = text.indexOf(startMatch[0]) + startMatch[0].length
	const endIndex = text.indexOf(endMatch[0])
	if (endIndex <= startIndex) return { report: null, confidence: 0.25, tokenUsageEstimate: Math.ceil(text.length / 4) }
	const report = text.substring(startIndex, endIndex).trim()
	if (report.length < 10) return { report: null, confidence: 0.25, tokenUsageEstimate: Math.ceil(text.length / 4) }
	const metadataMatch = text.substring(endIndex + endMatch[0].length).match(/METADATA:\s*(\{[^}]+\})/i)
	let confidence = 0.7
	let tokenUsageEstimate: number | undefined
	if (metadataMatch?.[1]) {
		try {
			const metadata = JSON.parse(metadataMatch[1])
			if (typeof metadata.confidence === 'number') confidence = Math.max(0, Math.min(1, metadata.confidence))
			if (typeof metadata.tokenUsageEstimate === 'number') tokenUsageEstimate = metadata.tokenUsageEstimate
		} catch {
			// Invalid metadata should not discard the report.
		}
	}
	return { report, confidence, tokenUsageEstimate: tokenUsageEstimate ?? Math.ceil(report.length / 4) }
}

const extractSection = (markdown: string, headingPatterns: string[]): string => {
	for (const headingPattern of headingPatterns) {
		const match = markdown.match(new RegExp(`##\\s*${headingPattern}\\s*\\n([\\s\\S]*?)(?=\\n##|\\n---|\\n==|$)`, 'i'))
		if (match?.[1]) return match[1].trim()
	}
	return ''
}

const extractBullets = (section: string): string[] => section
	.split(/\r?\n/)
	.map(line => line.trim())
	.filter(line => /^[-*+]\s+/.test(line))
	.map(line => line.replace(/^[-*+]\s+/, '').trim())
	.filter(Boolean)

const extractEvidence = (markdown: string): SubAgentEvidence[] => {
	const section = extractSection(markdown, ['Evidence\\s*\\/\\s*Supporting\\s*Files', 'Evidence', 'Supporting\\s*Files'])
	const evidence: SubAgentEvidence[] = []
	for (const line of section.split(/\r?\n/)) {
		const rawLine = line.trim().replace(/^[-*+]\s*/, '')
		if (!rawLine) continue
		const boldMatch = rawLine.match(/^\*\*([^*]+)\*\*\s*[:-]\s*(.+)$/)
		const colonIndex = rawLine.lastIndexOf(': ')
		if (boldMatch) {
			evidence.push({ path: boldMatch[1].trim(), rationale: boldMatch[2].trim() })
		} else if (colonIndex > 1) {
			evidence.push({ path: rawLine.slice(0, colonIndex).trim(), rationale: rawLine.slice(colonIndex + 2).trim() })
		}
	}
	return evidence.slice(0, 8)
}

const tryParseReportJson = (text: string): Record<string, unknown> | null => {
	const attempts = [
		text,
		text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
		text.includes('{') && text.includes('}') ? text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1) : undefined,
	]
	for (const attempt of attempts) {
		if (!attempt) continue
		try {
			const parsed = JSON.parse(attempt)
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
		} catch {
			// Try the next shape.
		}
	}
	return null
}

const stringArray = (value: unknown): string[] => Array.isArray(value)
	? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
	: []

const evidenceArray = (value: unknown): SubAgentEvidence[] => Array.isArray(value)
	? value.map(item => {
		if (!item || typeof item !== 'object') return null
		const path = typeof (item as any).path === 'string' ? (item as any).path.trim() : ''
		const rationale = typeof (item as any).rationale === 'string' ? (item as any).rationale.trim() : ''
		return path && rationale ? { path, rationale } : null
	}).filter((item): item is SubAgentEvidence => !!item)
	: []

export const reconcileSubAgentTaskForHarness = (
	task: SubAgentTaskRecord,
	status: SubAgentTaskStatus,
	error?: string,
): SubAgentTaskRecord => {
	const withDefaults = applyBackgroundDefaults(task)
	if (isTerminalStatusForHarness(status)) {
		return transitionToTerminal(withDefaults, status, error)
	}
	return { ...withDefaults, status, updatedAt: Date.now() }
}

const isTerminalStatusForHarness = (status: SubAgentTaskStatus): status is Extract<SubAgentTaskStatus, 'completed' | 'failed' | 'timed_out' | 'canceled' | 'killed'> => {
	return isTerminalTaskStatus(status)
}

export const subAgentLifecycleHarness = {
	applyBackgroundDefaults,
	isTerminalTaskStatus,
	markNotified,
	releaseTask,
	retainTask,
	transitionToTerminal,
}
