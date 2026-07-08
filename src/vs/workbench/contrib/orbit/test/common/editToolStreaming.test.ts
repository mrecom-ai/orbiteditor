/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parsePartialToolParams } from '../../electron-main/llmMessage/parsePartialToolParams.js';
import {
	getEditToolContentType,
	getStrReplaceStreamingContent,
} from '../../browser/react/src/sidebar-tsx/components/editTool/editToolDisplayData.js';
import { RawToolCallObj } from '../../common/sendLLMMessageTypes.js';
import { computeNonEditStreamingDisplayCode, computeStreamingEditToolCardState } from '../../browser/react/src/sidebar-tsx/components/editTool/streamingEditToolState.js';
import { isRenderableStreamingToolCall } from '../../browser/react/src/sidebar-tsx/utils/streamingToolRenderFilter.js';

suite('EditToolStreaming', () => {
	test('keeps removed source visible when new_string is intentionally empty', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.html","old_string":"<style>\\nbody { color: red; }\\n</style>","new_string":""');

		assert.strictEqual(parsed.rawParams.path, '/tmp/a.html');
		assert.strictEqual(parsed.rawParams.old_string, '<style>\nbody { color: red; }\n</style>');
		assert.strictEqual(parsed.rawParams.new_string, '');
		assert.ok(parsed.doneParams.includes('old_string'));
		assert.ok(parsed.doneParams.includes('new_string'));
		assert.strictEqual(parsed.isDone, false);

		const preview = getStrReplaceStreamingContent({
			oldString: parsed.rawParams.old_string ?? '',
			newString: parsed.rawParams.new_string ?? '',
			oldStringFieldStarted: 'old_string' in parsed.rawParams,
			oldStringComplete: parsed.doneParams.includes('old_string'),
			newStringFieldStarted: 'new_string' in parsed.rawParams,
			newStringComplete: parsed.doneParams.includes('new_string'),
		});

		assert.strictEqual(preview, '<style>\nbody { color: red; }\n</style>');
	});

	test('normalizes camelCase streamed edit params to canonical tool params', () => {
		const parsed = parsePartialToolParams('{"filePath":"/tmp/a.html","oldString":"old","newString":"new"}');

		assert.strictEqual(parsed.rawParams.path, '/tmp/a.html');
		assert.strictEqual(parsed.rawParams.old_string, 'old');
		assert.strictEqual(parsed.rawParams.new_string, 'new');
		assert.ok(parsed.doneParams.includes('path'));
		assert.ok(parsed.doneParams.includes('old_string'));
		assert.ok(parsed.doneParams.includes('new_string'));
		assert.strictEqual(parsed.isDone, true);
	});

	test('edit_file legacy name resolves to strReplace when old_string is present', () => {
		const rawParams = { path: '/tmp/a.ts', old_string: 'const x = 1' };
		assert.strictEqual(getEditToolContentType('edit_file', undefined, rawParams), 'strReplace');
	});

	test('edit_file with only search_replace_blocks stays legacy-diff', () => {
		const rawParams = { path: '/tmp/a.ts', search_replace_blocks: '<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE' };
		assert.strictEqual(getEditToolContentType('edit_file', undefined, rawParams), 'legacy-diff');
	});

	test('streams partial old_string before field completes', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","old_string":"function hello');

		assert.strictEqual(parsed.rawParams.old_string, 'function hello');
		assert.ok(!parsed.doneParams.includes('old_string'));
		assert.strictEqual(parsed.isDone, false);

		const preview = getStrReplaceStreamingContent({
			oldString: parsed.rawParams.old_string ?? '',
			newString: '',
			oldStringFieldStarted: 'old_string' in parsed.rawParams,
			oldStringComplete: parsed.doneParams.includes('old_string'),
			newStringFieldStarted: false,
			newStringComplete: false,
		});

		assert.strictEqual(preview, 'function hello');
	});

	test('switches to new_string once old_string completes', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","old_string":"old","new_string":"new partial');

		const preview = getStrReplaceStreamingContent({
			oldString: parsed.rawParams.old_string ?? '',
			newString: parsed.rawParams.new_string ?? '',
			oldStringFieldStarted: true,
			oldStringComplete: parsed.doneParams.includes('old_string'),
			newStringFieldStarted: 'new_string' in parsed.rawParams,
			newStringComplete: parsed.doneParams.includes('new_string'),
		});

		assert.strictEqual(preview, 'new partial');
	});

	test('rewrite contents partial stream returns write body', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","contents":"export const x = ');

		assert.ok(parsed.rawParams.contents?.startsWith('export const x ='));
		assert.strictEqual(getEditToolContentType('Write', undefined, parsed.rawParams), 'rewrite');
	});

	test('rewrite_file legacy name resolves to rewrite', () => {
		const rawParams = { path: '/tmp/a.ts', contents: 'hello' };
		assert.strictEqual(getEditToolContentType('rewrite_file', undefined, rawParams), 'rewrite');
	});

	test('rewrite_file with legacy newContent param resolves to rewrite, not legacy-diff', () => {
		// Regression: newContent/new_content are rewrite-content aliases that are also
		// listed in LEGACY_BLOCKS_PARAM_NAMES. The tool name must win so the whole-file
		// rewrite view is used instead of the search/replace-block renderer.
		assert.strictEqual(getEditToolContentType('rewrite_file', undefined, { path: '/tmp/a.ts', newContent: 'hello world' }), 'rewrite');
		assert.strictEqual(getEditToolContentType('create_file_or_folder', undefined, { path: '/tmp/a.ts', new_content: 'hello world' }), 'rewrite');
	});

	test('strReplace diff stats stay zero until new_string finishes streaming', () => {
		// old_string is complete but new_string is still arriving — computing stats now
		// would briefly show the entire old block as "removed" (flicker).
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","old_string":"const a = 1","new_string":"const a = ');
		const midStream: RawToolCallObj = {
			id: 'ds1',
			name: 'StrReplace' as RawToolCallObj['name'],
			rawParams: parsed.rawParams,
			doneParams: parsed.doneParams as RawToolCallObj['doneParams'],
			isDone: parsed.isDone,
		};
		assert.ok(parsed.doneParams.includes('old_string'));
		assert.ok(!parsed.doneParams.includes('new_string'));
		const midCard = computeStreamingEditToolCardState(midStream);
		assert.ok(midCard);
		assert.strictEqual(midCard!.diffStats.additions, 0);
		assert.strictEqual(midCard!.diffStats.deletions, 0);

		// Once both fields are complete, real stats are computed.
		const doneParsed = parsePartialToolParams('{"path":"/tmp/a.ts","old_string":"const a = 1","new_string":"const a = 2"}');
		const doneCard = computeStreamingEditToolCardState({
			id: 'ds2',
			name: 'StrReplace' as RawToolCallObj['name'],
			rawParams: doneParsed.rawParams,
			doneParams: doneParsed.doneParams as RawToolCallObj['doneParams'],
			isDone: doneParsed.isDone,
		});
		assert.ok(doneCard);
		assert.ok(doneCard!.diffStats.additions + doneCard!.diffStats.deletions > 0);
	});

	test('legacy edit_file passes StreamingMessagePane render filter', () => {
		const tool: RawToolCallObj = { id: 't1', name: 'edit_file' as RawToolCallObj['name'], rawParams: {}, doneParams: [], isDone: false };
		assert.ok(isRenderableStreamingToolCall(tool, { mcpToolNames: new Set() }));
	});

	test('legacy rewrite_file passes StreamingMessagePane render filter', () => {
		const tool: RawToolCallObj = { id: 't2', name: 'rewrite_file' as RawToolCallObj['name'], rawParams: {}, doneParams: [], isDone: false };
		assert.ok(isRenderableStreamingToolCall(tool, { mcpToolNames: new Set() }));
	});

	test('partial edit_file stream produces card block with streaming code', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","old_string":"function hello');
		const tool: RawToolCallObj = {
			id: 't3',
			name: 'edit_file' as RawToolCallObj['name'],
			rawParams: parsed.rawParams,
			doneParams: parsed.doneParams as RawToolCallObj['doneParams'],
			isDone: parsed.isDone,
		};

		assert.ok(isRenderableStreamingToolCall(tool, { mcpToolNames: new Set() }));

		const card = computeStreamingEditToolCardState(tool);
		assert.ok(card);
		assert.strictEqual(card!.effectiveToolName, 'StrReplace');
		assert.strictEqual(card!.editToolType, 'strReplace');
		assert.strictEqual(card!.phase, 'content');
		assert.strictEqual(card!.useStreamingCode, true);
		assert.strictEqual(card!.streamingText, 'function hello');
		assert.strictEqual(card!.hasDisplayableContent, true);
	});

	test('non-edit streaming tools keep fallback display code from raw params', () => {
		const rawParams = { path: '/tmp/a.ts', old_string: 'function main() {}' };
		const code = computeNonEditStreamingDisplayCode('Grep', rawParams);
		assert.strictEqual(code, 'function main() {}');
		assert.strictEqual(computeStreamingEditToolCardState({
			id: 't5',
			name: 'Grep' as RawToolCallObj['name'],
			rawParams,
			doneParams: [],
			isDone: false,
		}), null);
	});

	test('partial rewrite_file stream produces card block with write contents', () => {
		const parsed = parsePartialToolParams('{"path":"/tmp/a.ts","contents":"export const x = ');
		const tool: RawToolCallObj = {
			id: 't4',
			name: 'rewrite_file' as RawToolCallObj['name'],
			rawParams: parsed.rawParams,
			doneParams: parsed.doneParams as RawToolCallObj['doneParams'],
			isDone: parsed.isDone,
		};

		assert.ok(isRenderableStreamingToolCall(tool, { mcpToolNames: new Set() }));

		const card = computeStreamingEditToolCardState(tool);
		assert.ok(card);
		assert.strictEqual(card!.effectiveToolName, 'Write');
		assert.strictEqual(card!.editToolType, 'rewrite');
		assert.strictEqual(card!.phase, 'content');
		assert.strictEqual(card!.useStreamingCode, true);
		assert.ok(card!.streamingText.startsWith('export const x ='));
	});

	test('code field key present with empty value still mounts streaming viewport', () => {
		const tool: RawToolCallObj = {
			id: 't6',
			name: 'StrReplace' as RawToolCallObj['name'],
			rawParams: { path: '/tmp/a.ts', old_string: '' },
			doneParams: ['path'] as RawToolCallObj['doneParams'],
			isDone: false,
		};

		const card = computeStreamingEditToolCardState(tool);
		assert.ok(card);
		assert.strictEqual(card!.phase, 'content');
		assert.strictEqual(card!.useStreamingCode, true);
		assert.strictEqual(card!.streamingText, '');
		assert.strictEqual(card!.hasDisplayableContent, true);
	});
});
