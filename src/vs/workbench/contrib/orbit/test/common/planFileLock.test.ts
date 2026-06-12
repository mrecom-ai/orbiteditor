/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { PlanFileLock } from '../../common/planFileLock.js';

suite('PlanFileLock', () => {
	test('serializes operations on the same plan path', async () => {
		const lock = new PlanFileLock();
		const order: number[] = [];

		const first = lock.withLock('/tmp/plan-a.md', async () => {
			order.push(1);
			await new Promise(resolve => setTimeout(resolve, 20));
			order.push(2);
		});

		const second = lock.withLock('/tmp/plan-a.md', async () => {
			order.push(3);
		});

		await Promise.all([first, second]);
		assert.deepStrictEqual(order, [1, 2, 3]);
	});

	test('allows concurrent operations on different plan paths', async () => {
		const lock = new PlanFileLock();
		let aStarted = false;
		let bStarted = false;

		const first = lock.withLock('/tmp/plan-a.md', async () => {
			aStarted = true;
			await new Promise(resolve => setTimeout(resolve, 30));
		});

		const second = lock.withLock('/tmp/plan-b.md', async () => {
			bStarted = true;
		});

		await new Promise(resolve => setTimeout(resolve, 5));
		assert.strictEqual(aStarted, true);
		assert.strictEqual(bStarted, true);

		await Promise.all([first, second]);
	});

	test('propagates errors without blocking the chain', async () => {
		const lock = new PlanFileLock();

		await assert.rejects(
			lock.withLock('/tmp/plan-a.md', async () => {
				throw new Error('boom');
			}),
			/boom/,
		);

		let ran = false;
		await lock.withLock('/tmp/plan-a.md', async () => {
			ran = true;
		});
		assert.strictEqual(ran, true);
	});

	test('handles many acquisitions without leaving stale chains', async () => {
		const lock = new PlanFileLock();
		const planPath = '/tmp/plan-stress.md';

		for (let i = 0; i < 50; i++) {
			await lock.withLock(planPath, async () => {
				// no-op
			});
		}

		let ran = false;
		await lock.withLock(planPath, async () => {
			ran = true;
		});
		assert.strictEqual(ran, true);
	});
});