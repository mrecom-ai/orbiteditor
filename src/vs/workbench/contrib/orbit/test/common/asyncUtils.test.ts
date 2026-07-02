/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { withTimeout } from '../../common/asyncUtils.js';

suite('withTimeout', () => {
	test('resolves with the underlying value when it settles before the deadline', async () => {
		const result = await withTimeout(Promise.resolve('ok'), 1000, 'fastTool');
		assert.strictEqual(result, 'ok');
	});

	test('rejects with the original error when the promise rejects before the deadline', async () => {
		await assert.rejects(
			withTimeout(Promise.reject(new Error('boom')), 1000, 'failingTool'),
			/boom/,
		);
	});

	test('rejects with a timeout error, naming the tool, when the promise never settles', async () => {
		const hung = new Promise<string>(() => { });
		await assert.rejects(
			withTimeout(hung, 20, 'slowTool'),
			/slowTool.*timed out after 20ms/,
		);
	});

	test('does not fire the timeout once the promise has already resolved (no leaked timer error)', async () => {
		await withTimeout(Promise.resolve('done'), 20, 'quickTool');
		await new Promise(res => setTimeout(res, 40)); // outlive what would have been the timeout
		// If the timer weren't cleared, an unhandled rejection would surface here — nothing to assert
		// beyond "the test process didn't crash", which the runner itself verifies.
	});
});
