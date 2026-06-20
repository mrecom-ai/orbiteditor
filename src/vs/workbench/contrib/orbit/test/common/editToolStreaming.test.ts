/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parsePartialToolParams } from '../../electron-main/llmMessage/parsePartialToolParams.js';
import { getStrReplaceStreamingContent } from '../../browser/react/src/sidebar-tsx/components/editTool/editToolDisplayData.js';

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
});
