/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { isMCPToolReadOnly, isDelegationStyleToolName, readOnlyToolNames, resolveBuiltinToolNameLoose } from './prompt/prompts.js';
import type { ToolPolicy } from './sendLLMMessageTypes.js';
import type { AgentPermissionMode, BlockedToolCall, SubAgentDefinition } from './subAgentTypes.js';
import type { BuiltinToolName, ToolName } from './toolsServiceTypes.js';
import type { InternalToolInfo } from './prompt/prompts.js';

// ── Permission-tier presets ─────────────────────────────────────────────────

const SAFE_WRITE_BUILTIN: BuiltinToolName[] = [
	...readOnlyToolNames,
	'edit_file',
	'rewrite_file',
	'create_file_or_folder',
]

const TERMINAL_SAFE_BUILTIN: BuiltinToolName[] = [
	...SAFE_WRITE_BUILTIN,
	'run_command',
]

// Built-ins that no read-only or safe_write agent may use, deny-first.
const DESTRUCTIVE_BUILTIN: BuiltinToolName[] = [
	'delete_file_or_folder',
	'run_command',
	'run_persistent_command',
	'open_persistent_terminal',
	'kill_persistent_terminal',
]

export const PERMISSION_TIER_POLICIES: Record<AgentPermissionMode, ToolPolicy> = {
	read_only: {
		allowedBuiltinTools: readOnlyToolNames,
		disallowedBuiltinTools: DESTRUCTIVE_BUILTIN,
		allowReadOnlyMcpOnly: true,
		denyDelegation: true,
	},
	safe_write: {
		allowedBuiltinTools: SAFE_WRITE_BUILTIN,
		disallowedBuiltinTools: ['delete_file_or_folder', 'run_command', 'run_persistent_command', 'open_persistent_terminal', 'kill_persistent_terminal'],
		allowReadOnlyMcpOnly: true,
		denyDelegation: true,
	},
	terminal_safe: {
		allowedBuiltinTools: TERMINAL_SAFE_BUILTIN,
		disallowedBuiltinTools: ['delete_file_or_folder', 'run_persistent_command', 'open_persistent_terminal', 'kill_persistent_terminal'],
		allowReadOnlyMcpOnly: true,
		denyDelegation: true,
	},
	full_with_approval: {
		// Inherit parent — no allowlist; only delegation is denied.
		denyDelegation: true,
	},
}

/**
 * Resolve the effective ToolPolicy for an agent: prefer the agent's own
 * `permission` field if present; otherwise derive from `permissionMode`.
 * Result merges agent.allowedTools/disallowedTools on top of the tier preset.
 */
export function resolveAgentPolicy(agent: SubAgentDefinition): ToolPolicy {
	const tier: AgentPermissionMode = agent.permissionMode ?? 'read_only'
	const tierPreset = PERMISSION_TIER_POLICIES[tier] ?? PERMISSION_TIER_POLICIES.read_only

	// Start from the explicit `permission` field if it exists, otherwise the tier preset.
	const base: ToolPolicy = {
		allowedBuiltinTools: agent.permission?.allowedBuiltinTools ?? tierPreset.allowedBuiltinTools,
		disallowedBuiltinTools: agent.permission?.disallowedBuiltinTools ?? tierPreset.disallowedBuiltinTools,
		allowReadOnlyMcpOnly: agent.permission?.allowReadOnlyMcpOnly ?? tierPreset.allowReadOnlyMcpOnly,
		denyDelegation: agent.permission?.denyDelegation ?? tierPreset.denyDelegation,
	}

	// Layer per-agent overrides if defined.
	if (agent.allowedTools && agent.allowedTools.length > 0) {
		const resolved = agent.allowedTools
			.map(n => resolveBuiltinToolNameLoose(n))
			.filter((n): n is BuiltinToolName => !!n)
		base.allowedBuiltinTools = resolved
	}
	if (agent.disallowedTools && agent.disallowedTools.length > 0) {
		const resolved = agent.disallowedTools
			.map(n => resolveBuiltinToolNameLoose(n))
			.filter((n): n is BuiltinToolName => !!n)
		base.disallowedBuiltinTools = [...(base.disallowedBuiltinTools ?? []), ...resolved] as ToolName[]
	}

	return base
}

// ── Terminal command safety ─────────────────────────────────────────────────

const TERMINAL_DENY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\brm\s+-[rRfF]+\b/, reason: 'recursive rm' },
	{ pattern: /\brm\s+--?recursive\b/, reason: 'recursive rm' },
	{ pattern: /\bsudo\b/, reason: 'sudo' },
	{ pattern: /\bchmod\s+-R\b/, reason: 'recursive chmod' },
	{ pattern: /\bchown\s+-R\b/, reason: 'recursive chown' },
	{ pattern: /\bgit\s+reset\s+--hard\b/, reason: 'git reset --hard' },
	{ pattern: /\bgit\s+clean\s+-[fdx]+/, reason: 'git clean -fd' },
	{ pattern: /\bgit\s+push\s+(--force|-f)\b/, reason: 'git force push' },
	{ pattern: /\bgit\s+checkout\s+--orphan\b/, reason: 'git orphan branch' },
	{ pattern: /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)\b/, reason: 'piping remote script to shell' },
	{ pattern: /\bnpm\s+publish\b/, reason: 'npm publish' },
	{ pattern: /\bpnpm\s+publish\b/, reason: 'pnpm publish' },
	{ pattern: /\byarn\s+publish\b/, reason: 'yarn publish' },
	{ pattern: /\bdocker\s+system\s+prune\b/, reason: 'docker system prune' },
	{ pattern: /\bdocker\s+volume\s+rm\b/, reason: 'docker volume rm' },
	{ pattern: /\bdocker\s+rm\s+-f\b/, reason: 'docker rm -f' },
	{ pattern: /\bkillall\b/, reason: 'killall' },
	{ pattern: /\bpkill\s+-9\b/, reason: 'pkill -9' },
	{ pattern: /\bfind\b[^\n]*\s-(delete|exec\s+rm)\b/, reason: 'find -delete / -exec rm' },
	{ pattern: /\bxargs\s+rm\b/, reason: 'xargs rm' },
	{ pattern: /\bxargs\s+-[a-zA-Z]*0?\s+rm\b/, reason: 'xargs rm' },
	{ pattern: />>?\s*\.env(\.|$|\s)/, reason: 'redirect to .env' },
	{ pattern: />>?\s*[^\s]*\.(pem|key)(\s|$)/, reason: 'redirect to private key file' },
	{ pattern: />>?\s*[^\s]*id_(rsa|ed25519|ecdsa)(\s|$)/, reason: 'redirect to private key file' },
	{ pattern: /\bcat\s+[^\n]*\.env\b/, reason: 'reading .env to stdout' },
	{ pattern: /\b(rm|mv)\s+\/\s*(\s|$)/, reason: 'operating on /' },
	{ pattern: /\b(rm|mv)\s+--?\s+\/\s*(\s|$)/, reason: 'operating on /' },
]

export function terminalSafetyCheck(command: string): { ok: boolean; reason?: string } {
	if (!command || !command.trim()) return { ok: true }
	for (const { pattern, reason } of TERMINAL_DENY_PATTERNS) {
		if (pattern.test(command)) {
			return { ok: false, reason }
		}
	}
	return { ok: true }
}

// ── Path safety ─────────────────────────────────────────────────────────────

const SECRET_PATH_PATTERNS: RegExp[] = [
	/(^|\/)\.env(\.[^/]+)?$/,
	/(^|\/)credentials(\.json|\.yml|\.yaml)?$/i,
	/(^|\/)secrets(\.json|\.yml|\.yaml)?$/i,
	/(^|\/)id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/,
	/\.(pem|key|p12|pfx)$/i,
	/(^|\/)\.aws\/credentials$/,
	/(^|\/)\.ssh\//,
	/(^|\/)\.netrc$/,
]

const RESTRICTED_WRITE_PATTERNS: RegExp[] = [
	...SECRET_PATH_PATTERNS,
	/(^|\/)\.git\//, // never write to .git
]

export function pathSafetyCheck(path: string, op: 'read' | 'write'): { ok: boolean; reason?: string } {
	if (!path) return { ok: true }
	const normalized = path.replace(/\\/g, '/')
	const patterns = op === 'write' ? RESTRICTED_WRITE_PATTERNS : SECRET_PATH_PATTERNS
	for (const pattern of patterns) {
		if (pattern.test(normalized)) {
			return { ok: false, reason: op === 'write' ? `Refused to ${op} restricted path` : 'Refused to read secret-shaped path' }
		}
	}
	return { ok: true }
}

// ── Tool-call guard ─────────────────────────────────────────────────────────

export type GuardToolCallInput = {
	agent: SubAgentDefinition;
	toolName: string;
	rawParams: Record<string, unknown>;
	mcpTools: InternalToolInfo[];
	toolCallCount: number; // already-completed calls; the current call is NOT counted yet
}

export type GuardToolCallResult =
	| { ok: true }
	| { ok: false; blocked: BlockedToolCall }

const WRITE_TOOLS: ReadonlySet<BuiltinToolName> = new Set([
	'edit_file',
	'rewrite_file',
	'create_file_or_folder',
	'delete_file_or_folder',
])

const READ_TOOLS: ReadonlySet<BuiltinToolName> = new Set([
	'read_file',
])

const TERMINAL_TOOLS: ReadonlySet<BuiltinToolName> = new Set([
	'run_command',
	'run_persistent_command',
])

function buildBlockedAction(toolName: string, reason: BlockedToolCall['reason'], detail: string): BlockedToolCall {
	return { toolName, reason, detail, ts: Date.now() }
}

/**
 * Pre-flight check for a sub-agent tool call. Returns ok or a structured
 * BlockedToolCall describing why the call was rejected. Callers should
 * append blocked actions to the run's audit log and return a structured
 * tool error to the LLM so it can adapt.
 */
export function guardToolCall(input: GuardToolCallInput): GuardToolCallResult {
	const { agent, toolName, rawParams, mcpTools, toolCallCount } = input

	// 1) Delegation never allowed for sub-agents.
	if (isDelegationStyleToolName(toolName)) {
		return {
			ok: false,
			blocked: buildBlockedAction(toolName, 'delegation', 'Sub-agents cannot spawn further sub-agents.'),
		}
	}

	// 2) Tool-call budget.
	const budget = agent.maxToolCalls
	if (typeof budget === 'number' && budget > 0 && toolCallCount >= budget) {
		return {
			ok: false,
			blocked: buildBlockedAction(toolName, 'budget', `Exceeded max tool-call budget (${budget}).`),
		}
	}

	const policy = resolveAgentPolicy(agent)
	const mcpToolByName = new Map(mcpTools.map(t => [t.name, t] as const))
	const mcpToolNames = new Set(mcpToolByName.keys())
	const builtin = resolveBuiltinToolNameLoose(toolName, { mcpToolNames })
	const mcpTool = mcpToolByName.get(toolName)

	// 3) Built-in tool tier check.
	if (builtin) {
		const denied = policy.disallowedBuiltinTools?.some(n => resolveBuiltinToolNameLoose(n) === builtin)
		if (denied) {
			return {
				ok: false,
				blocked: buildBlockedAction(builtin, 'tier', `Tool "${builtin}" is denied by the @${agent.name} agent's permission tier.`),
			}
		}
		if (policy.allowedBuiltinTools && policy.allowedBuiltinTools.length > 0) {
			const allowed = policy.allowedBuiltinTools.some(n => resolveBuiltinToolNameLoose(n) === builtin)
			if (!allowed) {
				return {
					ok: false,
					blocked: buildBlockedAction(builtin, 'tier', `Tool "${builtin}" is not in the @${agent.name} agent's allowlist.`),
				}
			}
		}

		// 4) Path safety for read/write tools.
		if (READ_TOOLS.has(builtin)) {
			const path = stringParam(rawParams, ['uri', 'path', 'target_file'])
			if (path) {
				const check = pathSafetyCheck(path, 'read')
				if (!check.ok) {
					return {
						ok: false,
						blocked: buildBlockedAction(builtin, 'path_unsafe', `${check.reason}: ${path}`),
					}
				}
			}
		}
		if (WRITE_TOOLS.has(builtin)) {
			const path = stringParam(rawParams, ['uri', 'path', 'target_file'])
			if (path) {
				const check = pathSafetyCheck(path, 'write')
				if (!check.ok) {
					return {
						ok: false,
						blocked: buildBlockedAction(builtin, 'path_unsafe', `${check.reason}: ${path}`),
					}
				}
			}
		}

		// 5) Terminal safety for command tools.
		if (TERMINAL_TOOLS.has(builtin)) {
			const cmd = stringParam(rawParams, ['command'])
			if (cmd) {
				const check = terminalSafetyCheck(cmd)
				if (!check.ok) {
					return {
						ok: false,
						blocked: buildBlockedAction(builtin, 'terminal_unsafe', `Blocked command pattern (${check.reason}): ${cmd.slice(0, 200)}`),
					}
				}
			}
		}

		return { ok: true }
	}

	// 6) MCP tool path.
	if (mcpTool) {
		if (policy.allowReadOnlyMcpOnly && !isMCPToolReadOnly(mcpTool)) {
			return {
				ok: false,
				blocked: buildBlockedAction(mcpTool.name, 'mcp_mutation', `MCP tool "${mcpTool.name}" is not read-only.`),
			}
		}
		return { ok: true }
	}

	// 7) Unknown tool.
	return {
		ok: false,
		blocked: buildBlockedAction(toolName, 'unknown_tool', `Tool "${toolName}" is not a known built-in or MCP tool.`),
	}
}

function stringParam(rawParams: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = rawParams[key]
		if (typeof value === 'string' && value.trim()) return value
	}
	return undefined
}
