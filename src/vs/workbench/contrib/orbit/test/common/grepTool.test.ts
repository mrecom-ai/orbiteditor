/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { isLLMHiddenBuiltinToolName } from '../../common/prompt/prompts.js';
import {
	formatGrepOutput,
	getEffectiveGrepHeadLimit,
	GREP_DEFAULT_CONTENT_HEAD_LIMIT,
	GREP_DEFAULT_FILE_HEAD_LIMIT,
	normalizeGrepGlob,
	uriMatchesAnyGrepGlob,
	validateGrepToolParams,
} from '../../common/grepToolHelpers.js';
import type { GrepFileResult } from '../../common/toolsServiceTypes.js';

const workspaceRoot = URI.file('/workspace');

suite('GrepTool', () => {
	suite('validateGrepToolParams', () => {
		test('throws on empty pattern', () => {
			assert.throws(() => validateGrepToolParams({ pattern: '' }));
		});

		test('accepts valid pattern', () => {
			const params = validateGrepToolParams({ pattern: 'foo' });
			assert.strictEqual(params.pattern, 'foo');
			assert.strictEqual(params.outputMode, 'content');
		});

		test('throws on invalid output_mode', () => {
			assert.throws(() => validateGrepToolParams({ pattern: 'foo', output_mode: 'invalid' }));
		});

		test('throws on unsupported type', () => {
			assert.throws(() => validateGrepToolParams({ pattern: 'foo', type: 'not_a_real_type' }));
		});

		test('throws on negative head_limit', () => {
			assert.throws(() => validateGrepToolParams({ pattern: 'foo', head_limit: '-1' }));
		});

		test('conflicting context defaults work', () => {
			const params = validateGrepToolParams({ pattern: 'foo', '-C': '2' });
			assert.strictEqual(params.beforeContext, 2);
			assert.strictEqual(params.afterContext, 2);
		});

		test('-C takes precedence over -B and -A (ripgrep semantics)', () => {
			const params = validateGrepToolParams({ pattern: 'foo', '-C': '2', '-B': '5', '-A': '7' });
			assert.strictEqual(params.beforeContext, 2);
			assert.strictEqual(params.afterContext, 2);
		});
	});

	suite('getEffectiveGrepHeadLimit', () => {
		test('coerces head_limit 0 to default for content mode', () => {
			assert.strictEqual(getEffectiveGrepHeadLimit(0, 'content'), GREP_DEFAULT_CONTENT_HEAD_LIMIT);
		});

		test('coerces head_limit 0 to default for files_with_matches mode', () => {
			assert.strictEqual(getEffectiveGrepHeadLimit(0, 'files_with_matches'), GREP_DEFAULT_FILE_HEAD_LIMIT);
		});
	});

	suite('formatGrepOutput', () => {
		const sampleUri = URI.file('/workspace/src/foo.ts');
		const sampleResults: GrepFileResult[] = [{
			uri: sampleUri,
			matchCount: 1,
			lines: [{ lineNumber: 10, text: 'const foo = 1', isMatch: true }],
		}];

		test('content mode with no results', () => {
			assert.strictEqual(formatGrepOutput([], 'content', false), 'No matches found.');
		});

		test('content mode with results', () => {
			const output = formatGrepOutput(sampleResults, 'content', false);
			assert.ok(output.includes(sampleUri.fsPath));
			assert.ok(output.includes('10:const foo = 1'));
		});

		test('files_with_matches mode', () => {
			const output = formatGrepOutput([{ uri: sampleUri, matchCount: 2 }], 'files_with_matches', false);
			assert.strictEqual(output, sampleUri.fsPath);
		});

		test('count mode', () => {
			const output = formatGrepOutput([{ uri: sampleUri, matchCount: 3 }], 'count', false);
			assert.strictEqual(output, `${sampleUri.fsPath}:3`);
		});

		test('truncated with no results omits contradictory no-matches line', () => {
			const output = formatGrepOutput([], 'content', true);
			assert.ok(!output.includes('No matches found.'));
			assert.ok(output.includes('Results truncated'));
		});

		test('truncated with results appends truncation suffix', () => {
			const output = formatGrepOutput(sampleResults, 'content', true);
			assert.ok(output.includes('Results truncated'));
		});
	});

	suite('uriMatchesAnyGrepGlob', () => {
		test('absolute path matches *.ts', () => {
			const uri = URI.file('/workspace/src/foo.ts');
			assert.strictEqual(uriMatchesAnyGrepGlob(uri, [workspaceRoot], ['*.ts']), true);
		});

		test('relative path matches **/*.ts', () => {
			const uri = URI.file('/workspace/src/nested/foo.ts');
			assert.strictEqual(uriMatchesAnyGrepGlob(uri, [workspaceRoot], ['**/*.ts']), true);
		});

		test('no match returns false', () => {
			const uri = URI.file('/workspace/readme.md');
			assert.strictEqual(uriMatchesAnyGrepGlob(uri, [workspaceRoot], ['*.ts']), false);
		});

		test('multi-pattern OR', () => {
			const uri = URI.file('/workspace/foo.py');
			assert.strictEqual(uriMatchesAnyGrepGlob(uri, [workspaceRoot], ['*.ts', '*.py']), true);
		});
	});

	suite('normalizeGrepGlob', () => {
		test('.ts becomes *.ts', () => {
			assert.strictEqual(normalizeGrepGlob('.ts'), '*.ts');
		});

		test('src/*.ts unchanged', () => {
			assert.strictEqual(normalizeGrepGlob('src/*.ts'), 'src/*.ts');
		});

		test('**/*.ts unchanged', () => {
			assert.strictEqual(normalizeGrepGlob('**/*.ts'), '**/*.ts');
		});
	});

	suite('isLLMHiddenBuiltinToolName', () => {
		test('Glob is visible (not LLM-hidden)', () => {
			assert.strictEqual(isLLMHiddenBuiltinToolName('Glob'), false);
		});

		test('Grep is visible', () => {
			assert.strictEqual(isLLMHiddenBuiltinToolName('Grep'), false);
		});

		test('unknown tool is not hidden', () => {
			assert.strictEqual(isLLMHiddenBuiltinToolName('not_a_tool'), false);
		});
	});
});
