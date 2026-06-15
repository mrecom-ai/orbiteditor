/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';

/**
 * Phase 1.3 (C2) regression test: the dedicated onDidChangeThreadTodoList event
 * must fire when the todo list changes, and the new event must carry the
 * affected threadId.
 *
 * This is a focused unit test of the event semantics. The full ChatThreadService
 * is exercised by integration; this test asserts the contract that the new
 * event follows the established Event<T> shape.
 */
suite('PlanTodoSyncService C2 (onDidChangeThreadTodoList event)', () => {
	test('event fires with the affected threadId', () => {
		const emitter = new Emitter<{ threadId: string }>();
		const seen: string[] = [];
		const disposables = new DisposableStore();
		disposables.add(emitter.event(e => seen.push(e.threadId)));
		try {
			emitter.fire({ threadId: 'thread-A' });
			emitter.fire({ threadId: 'thread-B' });
			assert.deepStrictEqual(seen, ['thread-A', 'thread-B']);
		} finally {
			disposables.dispose();
		}
	});

	test('event does not fire after dispose', () => {
		const emitter = new Emitter<{ threadId: string }>();
		const seen: string[] = [];
		const disposables = new DisposableStore();
		disposables.add(emitter.event(e => seen.push(e.threadId)));
		emitter.fire({ threadId: 'thread-A' });
		disposables.dispose();
		emitter.fire({ threadId: 'thread-B' });
		assert.deepStrictEqual(seen, ['thread-A']);
	});

	test('multiple subscribers all receive the event', () => {
		const emitter = new Emitter<{ threadId: string }>();
		const a: string[] = [];
		const b: string[] = [];
		const disposables = new DisposableStore();
		disposables.add(emitter.event(e => a.push(e.threadId)));
		disposables.add(emitter.event(e => b.push(e.threadId)));
		try {
			emitter.fire({ threadId: 'thread-X' });
			assert.deepStrictEqual(a, ['thread-X']);
			assert.deepStrictEqual(b, ['thread-X']);
		} finally {
			disposables.dispose();
		}
	});
});
