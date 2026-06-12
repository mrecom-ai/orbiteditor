/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Serializes read-modify-write operations on a single plan file path
 * so PlanTodoSyncService and plan tools cannot overwrite each other.
 */
export class PlanFileLock {
	private readonly _chains = new Map<string, Promise<void>>();

	async withLock<T>(planPath: string, fn: () => Promise<T>): Promise<T> {
		const previous = (this._chains.get(planPath) ?? Promise.resolve()).catch(() => { });
		let release: () => void = () => { };
		const gate = new Promise<void>(resolve => { release = resolve; });
		const chained = previous.then(() => gate);
		this._chains.set(planPath, chained);

		await previous;
		try {
			return await fn();
		} finally {
			release();
			if (this._chains.get(planPath) === chained) {
				this._chains.delete(planPath);
			}
		}
	}
}

export const planFileLock = new PlanFileLock();