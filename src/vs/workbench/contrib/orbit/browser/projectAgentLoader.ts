/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Loads custom sub-agent definitions from:
 *   - ~/.orbit/agents/*.md  (user-level, lower priority)
 *   - .orbit/agents/*.md    (project-level, higher priority, overrides user)
 *
 * Frontmatter format:
 * ---
 * agentType: my-agent
 * whenToUse: Description of when to use this agent
 * permissionMode: read_only | safe_write | full   (optional, preferred over disallowedTools)
 * disallowedTools: edit_file, rewrite_file         (optional, comma-separated)
 * maxTurns: 20                                     (optional)
 * ---
 * System prompt body goes here...
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { URI } from '../../../../base/common/uri.js';
import { SubAgentDefinition, SubAgentPermissionMode, setProjectAgents, setUserAgents } from '../common/subAgentRegistry.js';
import { BuiltinToolName, READ_ONLY_BUILTIN_TOOL_NAMES } from '../common/toolsServiceTypes.js';

const VALID_PERMISSION_MODES = new Set<string>(['read_only', 'safe_write', 'full']);

const VALID_BUILTIN_TOOL_NAMES = new Set<string>([
	...READ_ONLY_BUILTIN_TOOL_NAMES,
	'rewrite_file', 'edit_file', 'create_file_or_folder',
	'delete_file_or_folder', 'run_command', 'run_persistent_command', 'open_persistent_terminal',
	'kill_persistent_terminal', 'update_todo_list',
]);

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
	const lines = content.split('\n');
	if (lines[0]?.trim() !== '---') return { meta: {}, body: content };
	const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
	if (endIdx === -1) return { meta: {}, body: content };
	const meta: Record<string, string> = {};
	for (let i = 1; i < endIdx; i++) {
		const colonIdx = lines[i].indexOf(':');
		if (colonIdx === -1) continue;
		const key = lines[i].slice(0, colonIdx).trim();
		const value = lines[i].slice(colonIdx + 1).trim();
		if (key) meta[key] = value;
	}
	return { meta, body: lines.slice(endIdx + 1).join('\n').trim() };
}

async function loadAgentsFromDir(
	dir: URI,
	source: 'project' | 'user',
	fileService: IFileService,
): Promise<SubAgentDefinition[]> {
	const agents: SubAgentDefinition[] = [];
	try {
		const stat = await fileService.resolve(dir);
		if (!stat.children) return agents;
		for (const child of stat.children) {
			if (!child.name.endsWith('.md')) continue;
			try {
				const content = await fileService.readFile(child.resource);
				const { meta, body } = parseFrontmatter(content.value.toString());
				const agentType = meta['agentType']?.trim();
				const whenToUse = meta['whenToUse']?.trim();
				if (!agentType || !whenToUse || !body) continue;

				const permissionModeRaw = meta['permissionMode']?.trim();
				const permissionMode = permissionModeRaw && VALID_PERMISSION_MODES.has(permissionModeRaw)
					? permissionModeRaw as SubAgentPermissionMode
					: undefined;

				const disallowedTools: BuiltinToolName[] = [];
				if (!permissionMode && meta['disallowedTools']) {
					for (const t of meta['disallowedTools'].split(',')) {
						const name = t.trim();
						if (VALID_BUILTIN_TOOL_NAMES.has(name)) disallowedTools.push(name as BuiltinToolName);
					}
				}

				const maxTurnsRaw = meta['maxTurns'] ? parseInt(meta['maxTurns'], 10) : undefined;
				const systemPrompt = body;

				agents.push({
					agentType,
					whenToUse,
					permissionMode,
					disallowedTools,
					maxTurns: maxTurnsRaw && !isNaN(maxTurnsRaw) ? maxTurnsRaw : undefined,
					source,
					getSystemPrompt: () => systemPrompt,
				});
			} catch {
				// Skip invalid files silently — never crash the editor
			}
		}
	} catch {
		// Directory doesn't exist — that's fine
	}
	return agents;
}

class ProjectAgentLoader extends Disposable {
	static readonly ID = 'workbench.contrib.orbitProjectAgentLoader';

	constructor(
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
		@INativeEnvironmentService private readonly _environmentService: INativeEnvironmentService,
	) {
		super();
		this._load();
	}

	private async _load(): Promise<void> {
		// Load user-level agents from ~/.orbit/agents/
		const userAgentsDir = URI.joinPath(this._environmentService.userHome, '.orbit', 'agents');
		const userAgents = await loadAgentsFromDir(userAgentsDir, 'user', this._fileService);
		if (userAgents.length > 0) setUserAgents(userAgents);

		// Load project-level agents from .orbit/agents/ in each workspace folder
		const folders = this._workspaceContextService.getWorkspace().folders;
		const projectAgents: SubAgentDefinition[] = [];
		for (const folder of folders) {
			const projectAgentsDir = URI.joinPath(folder.uri, '.orbit', 'agents');
			const agents = await loadAgentsFromDir(projectAgentsDir, 'project', this._fileService);
			projectAgents.push(...agents);
		}
		if (projectAgents.length > 0) setProjectAgents(projectAgents);
	}
}

registerWorkbenchContribution2(ProjectAgentLoader.ID, ProjectAgentLoader, WorkbenchPhase.AfterRestored);
