/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { safeForLog } from '../../common/helpers/sanitizeForLog.js';

suite('sanitizeForLog (H8)', () => {
	test('redacts apiKey at top level', () => {
		const out = safeForLog({ apiKey: 'sk-abc-123', name: 'claude' });
		assert.deepStrictEqual(out, { apiKey: '[REDACTED]', name: 'claude' });
	});

	test('redacts nested apiKey inside headers', () => {
		const out = safeForLog({
			headers: {
				Authorization: 'Bearer xyz',
				'X-Custom': 'ok',
			},
		});
		assert.deepStrictEqual(out, {
			headers: {
				Authorization: '[REDACTED]',
				'X-Custom': 'ok',
			},
		});
	});

	test('redacts case-insensitive matches (api_key, ApiKey, AUTH_TOKEN)', () => {
		const out = safeForLog({
			api_key: 'a',
			ApiKey: 'b',
			AUTH_TOKEN: 'c',
			authToken: 'd',
		});
		assert.deepStrictEqual(out, {
			api_key: '[REDACTED]',
			ApiKey: '[REDACTED]',
			AUTH_TOKEN: '[REDACTED]',
			authToken: '[REDACTED]',
		});
	});

	test('redacts requestBody / responseBody', () => {
		const out = safeForLog({
			requestBody: { secret: 'leak' },
			responseBody: { apiKey: 'leak2' },
			other: 'safe',
		});
		assert.deepStrictEqual(out, {
			requestBody: '[REDACTED]',
			responseBody: '[REDACTED]',
			other: 'safe',
		});
	});

	test('does not mutate the input', () => {
		const input = { apiKey: 'sk-abc', headers: { Authorization: 'Bearer x' } };
		const before = JSON.stringify(input);
		safeForLog(input);
		assert.strictEqual(JSON.stringify(input), before);
	});

	test('handles arrays of objects', () => {
		const out = safeForLog([
			{ apiKey: 'a', name: 'one' },
			{ apiKey: 'b', name: 'two' },
		]);
		assert.deepStrictEqual(out, [
			{ apiKey: '[REDACTED]', name: 'one' },
			{ apiKey: '[REDACTED]', name: 'two' },
		]);
	});

	test('preserves null and undefined', () => {
		assert.strictEqual(safeForLog(null), null);
		assert.strictEqual(safeForLog(undefined), undefined);
	});

	test('breaks cycles with [Circular]', () => {
		const a: any = { name: 'a' };
		const b: any = { name: 'b', a };
		a.b = b;
		const out = safeForLog(a) as any;
		assert.strictEqual(out.name, 'a');
		assert.strictEqual(out.b.name, 'b');
		assert.strictEqual(out.b.a, '[Circular]');
	});
});
