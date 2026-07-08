/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Serializes read-modify-write operations on a single plan file path
 * so PlanTodoSyncService and plan tools cannot overwrite each other.
 */
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

export class PlanFileLock {
	private readonly _chains = new Map<string, Promise<void>>();

	async withLock<T>(planPath: string, fn: () => Promise<T>): Promise<T> {
		return this.withLockCancellable(planPath, CancellationToken.None, fn);
	}

	/**
	 * Phase 3 (M20) fix: optionally pass a CancellationToken. If cancellation is
	 * requested while we are waiting for the previous holder to release, we throw
	 * immediately rather than queueing. The function is still invoked only after
	 * the lock is acquired.
	 */
	async withLockCancellable<T>(
		planPath: string,
		token: CancellationToken,
		fn: () => Promise<T>,
	): Promise<T> {
		if (token.isCancellationRequested) {
			throw new Error('PlanFileLock: operation cancelled before lock acquired.');
		}
		const previous = (this._chains.get(planPath) ?? Promise.resolve()).catch(() => { });
		let release: () => void = () => { };
		const gate = new Promise<void>(resolve => { release = resolve; });
		const chained = previous.then(() => gate);
		this._chains.set(planPath, chained);

		// If cancellation fires while we're waiting, bail before acquiring.
		let cancellationListener: IDisposable | undefined;
		const cancellationPromise = new Promise<void>((resolve) => {
			if (token.isCancellationRequested) {
				resolve();
				return;
			}
			cancellationListener = token.onCancellationRequested(() => resolve());
		});

		try {
			await Promise.race([previous, cancellationPromise]);
			if (token.isCancellationRequested) {
				throw new Error('PlanFileLock: operation cancelled while waiting for lock.');
			}
			return await fn();
		} finally {
			cancellationListener?.dispose();
			release();
			if (this._chains.get(planPath) === chained) {
				this._chains.delete(planPath);
			}
		}
	}
}

export const planFileLock = new PlanFileLock();