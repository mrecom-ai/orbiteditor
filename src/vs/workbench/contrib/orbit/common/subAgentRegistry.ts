/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BuiltinToolName, READ_ONLY_BUILTIN_TOOL_NAMES } from './toolsServiceTypes.js';

const LLM_VISIBLE_READ_ONLY_BUILTIN_TOOL_NAMES = [...READ_ONLY_BUILTIN_TOOL_NAMES];

/**
 * Permission tiers for sub-agents.
 * - read_only: can only read files and search (no writes, no terminal)
 * - safe_write: can read and write files, but no terminal
 * - full: all tools including terminal
 */
export type SubAgentPermissionMode = 'read_only' | 'safe_write' | 'full';

const TERMINAL_TOOLS: BuiltinToolName[] = [
	'run_command', 'run_persistent_command', 'open_persistent_terminal', 'kill_persistent_terminal',
];

const WRITE_TOOLS: BuiltinToolName[] = [
	'rewrite_file', 'edit_file', 'create_file_or_folder', 'delete_file_or_folder',
];

export function disallowedToolsForPermissionMode(mode: SubAgentPermissionMode): BuiltinToolName[] {
	switch (mode) {
		case 'read_only': return [...WRITE_TOOLS, ...TERMINAL_TOOLS];
		case 'safe_write': return TERMINAL_TOOLS;
		case 'full': return [];
	}
}

export type SubAgentDefinition = {
	agentType: string;
	whenToUse: string;
	/** Permission tier — determines which tools are available. Overrides disallowedTools if set. */
	permissionMode?: SubAgentPermissionMode;
	/** Explicit deny-list (used when permissionMode is not set) */
	disallowedTools: BuiltinToolName[];
	/** Max LLM turns before stopping. Default: 30 */
	maxTurns?: number;
	/** Source: built-in or user-defined */
	source: 'built-in' | 'project' | 'user';
	getSystemPrompt: () => string;
};

/** Returns the effective disallowed tools for an agent, respecting permissionMode */
export function getEffectiveDisallowedTools(agent: SubAgentDefinition): BuiltinToolName[] {
	if (agent.permissionMode) return disallowedToolsForPermissionMode(agent.permissionMode);
	return agent.disallowedTools;
}

export const EXPLORE_AGENT: SubAgentDefinition = {
	agentType: 'explore',
	source: 'built-in',
	permissionMode: 'read_only',
	disallowedTools: [],
	whenToUse: 'Fast read-only codebase exploration. Use to find files, search code, map architecture, understand how something works. Specify thoroughness: "quick", "medium", or "thorough".',
	maxTurns: 20,
	getSystemPrompt: () => `You are a codebase exploration specialist for Orbit Editor. Your role is to search and analyze code — you do NOT modify files.

=== READ-ONLY MODE ===
You CANNOT create, edit, or delete files. You CANNOT run terminal commands.
Attempting to use write/terminal tools will fail — do not try.

Your available tools: ${LLM_VISIBLE_READ_ONLY_BUILTIN_TOOL_NAMES.join(', ')}.

Guidelines:
- Use Grep for content search. Search broadly first, then read specific files
- Use parallel tool calls whenever possible for speed
- Report findings with exact file paths and evidence
- Never invent or guess file paths — only report what you actually found
- If you cannot find something, say so clearly

When done, write a clear report with:
- Key files found (with paths)
- How they relate to each other
- Any important patterns or architecture notes`,
};

export const PLAN_AGENT: SubAgentDefinition = {
	agentType: 'plan',
	source: 'built-in',
	permissionMode: 'read_only',
	disallowedTools: [],
	whenToUse: 'Software architecture and implementation planning. Use to design a plan for a task, identify affected files, and outline steps. Returns a structured implementation plan.',
	maxTurns: 20,
	getSystemPrompt: () => `You are a software architect for Orbit Editor. Your role is to explore the codebase and design implementation plans — you do NOT modify files.

=== READ-ONLY MODE ===
You CANNOT create, edit, or delete files.
Attempting to use write tools will fail — do not try.

Process:
1. Explore the codebase to understand the current architecture
2. Identify the files and patterns relevant to the task
3. Design a step-by-step implementation plan

Required output format:
## Current Architecture
[What exists today]

## Implementation Plan
[Numbered steps]

## Files to Modify
[List with paths]

## Risks & Considerations
[What could go wrong]`,
};

export const GENERAL_AGENT: SubAgentDefinition = {
	agentType: 'general',
	source: 'built-in',
	permissionMode: 'full',
	disallowedTools: [],
	whenToUse: 'General-purpose agent for complex multi-step tasks requiring both research and implementation. Has access to all tools including file editing and terminal.',
	maxTurns: 30,
	getSystemPrompt: () => `You are a general-purpose coding agent for Orbit Editor. Complete the task fully using whatever tools are needed.

Guidelines:
- Be thorough but focused — complete the task, don't gold-plate it
- Use parallel tool calls when reading multiple files
- Report what was accomplished and any key findings when done`,
};

let _projectAgents: SubAgentDefinition[] = [];
let _userAgents: SubAgentDefinition[] = [];

export function setProjectAgents(agents: SubAgentDefinition[]): void {
	_projectAgents = agents;
}

export function setUserAgents(agents: SubAgentDefinition[]): void {
	_userAgents = agents;
}

export const BUILTIN_SUBAGENTS: SubAgentDefinition[] = [EXPLORE_AGENT, PLAN_AGENT, GENERAL_AGENT];

/**
 * Returns all agents: built-ins + user-level + project-level.
 * Priority: project > user > built-in (later entries override earlier ones with same name).
 */
export function listSubAgents(): SubAgentDefinition[] {
	const all = [...BUILTIN_SUBAGENTS];
	for (const ua of _userAgents) {
		const idx = all.findIndex(a => a.agentType === ua.agentType);
		if (idx >= 0) all[idx] = ua;
		else all.push(ua);
	}
	for (const pa of _projectAgents) {
		const idx = all.findIndex(a => a.agentType === pa.agentType);
		if (idx >= 0) all[idx] = pa;
		else all.push(pa);
	}
	return all;
}

export function getSubAgent(name: string): SubAgentDefinition | undefined {
	return listSubAgents().find(a => a.agentType === name);
}
