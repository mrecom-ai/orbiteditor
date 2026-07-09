/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Orbit Editor. All rights reserved.
 *  Licensed under the Apache License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';

/**
 * Minimal shape that mirrors the tool-message branch of `SimpleLLMMessage`
 * from `convertToLLMMessageService`. We test the deduplication logic in
 * isolation without importing the private type.
 */
interface TestToolMessage {
	role: 'tool';
	id: string;
	content: string;
	name: string;
	rawParams: Record<string, unknown>;
}

/**
 * Reproduces the core deduplication logic from `prepareMessages_openai_tools`
 * and `prepareMessages_anthropic_tools`: when the chat thread contains
 * multiple tool messages with the same id (e.g. a transient `running_now`
 * that wasn't swapped before a `success`), only the LAST occurrence must be
 * sent to the LLM. Otherwise OpenAI-compatible providers reject the payload
 * with `400 Duplicate value for 'tool_call_id'`.
 */
function dedupeToolMessages<T extends { id?: string }>(toolMessages: T[]): T[] {
	const deduped: T[] = [];
	const seen = new Set<string>();
	for (let k = toolMessages.length - 1; k >= 0; k--) {
		const tm = toolMessages[k];
		const tid = (tm.id ?? '').trim();
		if (tid && seen.has(tid)) continue;
		if (tid) seen.add(tid);
		deduped.unshift(tm);
	}
	return deduped;
}

suite('convertToLLMMessageService - tool_call_id deduplication', () => {
	test('keeps last occurrence when duplicate ids exist', () => {
		const msgs: TestToolMessage[] = [
			{ role: 'tool', id: 'call_1', content: 'running', name: 'browser_snapshot', rawParams: {} },
			{ role: 'tool', id: 'call_1', content: 'success-yaml', name: 'browser_snapshot', rawParams: {} },
		];
		const result = dedupeToolMessages(msgs);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].content, 'success-yaml');
	});

	test('preserves order for unique ids', () => {
		const msgs: TestToolMessage[] = [
			{ role: 'tool', id: 'call_a', content: 'a', name: 'browser_snapshot', rawParams: {} },
			{ role: 'tool', id: 'call_b', content: 'b', name: 'browser_click', rawParams: {} },
		];
		const result = dedupeToolMessages(msgs);
		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].id, 'call_a');
		assert.strictEqual(result[1].id, 'call_b');
	});

	test('handles three duplicates keeping last', () => {
		const msgs: TestToolMessage[] = [
			{ role: 'tool', id: 'call_x', content: 'running_now', name: 'browser_navigate', rawParams: {} },
			{ role: 'tool', id: 'call_x', content: 'tool_request', name: 'browser_navigate', rawParams: {} },
			{ role: 'tool', id: 'call_x', content: 'success', name: 'browser_navigate', rawParams: {} },
		];
		const result = dedupeToolMessages(msgs);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].content, 'success');
	});

	test('handles mixed duplicate and unique ids', () => {
		const msgs: TestToolMessage[] = [
			{ role: 'tool', id: 'call_1', content: 'running', name: 'browser_snapshot', rawParams: {} },
			{ role: 'tool', id: 'call_2', content: 'success-2', name: 'browser_click', rawParams: {} },
			{ role: 'tool', id: 'call_1', content: 'success-1', name: 'browser_snapshot', rawParams: {} },
		];
		const result = dedupeToolMessages(msgs);
		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].id, 'call_2');
		assert.strictEqual(result[1].id, 'call_1');
		assert.strictEqual(result[1].content, 'success-1');
	});

	test('empty input returns empty', () => {
		const result = dedupeToolMessages<TestToolMessage>([]);
		assert.strictEqual(result.length, 0);
	});
});
