/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { PlanFileLock } from '../../common/planFileLock.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';

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

	test('H7: does not break the lock chain when an inner promise rejects (regression)', async () => {
		// Phase 2.6 (H7) fix: if a `withLock` callback's promise rejects, the chain
		// must continue to work for the next caller. The implementation catches the
		// rejection internally so the next acquisition can proceed.
		const lock = new PlanFileLock();
		const planPath = '/tmp/plan-rejection.md';

		// Trigger a rejection
		await assert.rejects(
			() => lock.withLock(planPath, async () => {
				throw new Error('intentional');
			}),
			/intentional/,
		);

		// The chain must still be usable.
		let ran = false;
		await lock.withLock(planPath, async () => {
			ran = true;
		});
		assert.strictEqual(ran, true);
	});

	test('M20: withLockCancellable throws on pre-cancelled token', async () => {
		// Phase 3 (M20) fix: a pre-cancelled token must abort the call before any
		// file IO is performed.
		const lock = new PlanFileLock();
		const tokenSource = new CancellationTokenSource();
		tokenSource.cancel();
		await assert.rejects(
			() => lock.withLockCancellable('/tmp/plan-cancelled.md', tokenSource.token, async () => {
				throw new Error('fn should not run');
			}),
			/cancelled before lock acquired/,
		);
	});

	test('M20: withLockCancellable aborts while waiting for previous holder', async () => {
		// Phase 3 (M20) fix: cancellation while queued for the lock must not
		// invoke the callback.
		const lock = new PlanFileLock();
		const tokenSource = new CancellationTokenSource();
		const planPath = '/tmp/plan-wait-cancel.md';

		// Acquire the lock and hold it.
		let release: () => void = () => { };
		const holdingPromise = lock.withLock(planPath, () => new Promise<void>((resolve) => {
			release = resolve;
		}));

		// Queue a second caller, then cancel its token.
		const queuePromise = lock.withLockCancellable(planPath, tokenSource.token, async () => {
			throw new Error('fn should not run after cancel');
		}).catch((e) => e);

		// Allow the queue to register.
		await new Promise((r) => setImmediate(r));
		tokenSource.cancel();

		const result = await queuePromise;
		assert.ok(result instanceof Error, 'expected Error from cancelled lock attempt');
		assert.match(result.message, /cancelled while waiting/);

		// Release the original holder.
		release();
		await holdingPromise;
	});
});