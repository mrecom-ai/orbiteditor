/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { availableTools } from '../../common/prompt/prompts.js';
import type { InternalToolInfo } from '../../common/prompt/prompts.js';

suite('SubAgentToolPolicy', () => {
	test('hides delegation tool when delegation is denied', () => {
		const tools = availableTools('agent', undefined, { denyDelegation: true }) ?? [];
		const toolNames = tools.map(tool => tool.name);

		assert.ok(!toolNames.includes('task'));
		assert.ok(toolNames.includes('Read'));
	});

	test('hides disallowed builtin tools before prompting the model', () => {
		const tools = availableTools('agent', undefined, { disallowedBuiltinTools: ['edit_file', 'Shell'] }) ?? [];
		const toolNames = tools.map(tool => tool.name);

		assert.ok(!toolNames.includes('edit_file'));
		assert.ok(!toolNames.includes('Shell'));
		assert.ok(toolNames.includes('Read'));
	});

	test('exposes Glob and Grep as LLM-visible read-only tools', () => {
		const tools = availableTools('agent', undefined) ?? [];
		const toolNames = tools.map(tool => tool.name);

		assert.ok(toolNames.includes('Grep'));
		assert.ok(toolNames.includes('Glob'));
	});

	test('Glob and Grep are reachable through allowed tool policy', () => {
		const tools = availableTools('agent', undefined, { allowedBuiltinTools: ['Glob', 'Grep'] }) ?? [];
		const toolNames = tools.map(tool => tool.name);

		assert.ok(toolNames.includes('Glob'));
		assert.ok(toolNames.includes('Grep'));
	});

	test('filters MCP tools to read-only annotations for read-only sub-agents', () => {
		const mcpTools = [
			{
				name: 'readonly_lookup',
				description: 'Read-only lookup',
				params: {},
				annotations: { readOnly: true },
			},
			{
				name: 'write_action',
				description: 'Mutating action',
				params: {},
				annotations: { readOnly: false },
			},
		] as InternalToolInfo[];

		const tools = availableTools('agent', mcpTools, { allowReadOnlyMcpOnly: true }) ?? [];
		const toolNames = tools.map(tool => tool.name);

		assert.ok(toolNames.includes('readonly_lookup'));
		assert.ok(!toolNames.includes('write_action'));
	});
});
