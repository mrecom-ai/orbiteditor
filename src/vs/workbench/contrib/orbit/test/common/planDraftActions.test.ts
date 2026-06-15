/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { PlanFileLock } from '../../common/planFileLock.js';

/**
 * Minimal in-memory IFileService for exercising TOCTOU-sensitive code paths.
 * Records every operation so tests can inspect the order in which calls happened.
 */
class InMemoryFileService {
	existsCalls: URI[] = [];
	writeCalls: { uri: URI; content: string }[] = [];
	private files = new Map<string, string>();

	async exists(uri: URI): Promise<boolean> {
		this.existsCalls.push(uri);
		return this.files.has(uri.fsPath);
	}
	async writeFile(uri: URI, content: any): Promise<void> {
		const str = typeof content === 'string' ? content : content.toString();
		this.files.set(uri.fsPath, str);
		this.writeCalls.push({ uri, content: str });
	}
	async readFile(uri: URI): Promise<{ value: { toString(): string } }> {
		const s = this.files.get(uri.fsPath) ?? '';
		return { value: { toString: () => s } };
	}
	async createFolder(_uri: URI): Promise<void> {
		// no-op for the test
	}
}

/**
 * Phase 1.2 (C1) regression test: two parallel `savePlanDraftToWorkspace` calls
 * with the same proposed name must produce two distinct files, because the
 * existence check is now inside the directory-level lock.
 */
suite('planDraftActions C1 (TOCTOU)', () => {
	test('two concurrent save calls produce distinct paths', async () => {
		// We don't have a full mock for the chat thread / editor service, so we
		// just exercise the file-locking + "find an unused name" path in
		// isolation by calling `withLock` against the directory and using an
		// in-memory file service. This validates the core invariant: the
		// exists() check must happen *inside* the lock and must observe a
		// stable view of the world.
		const fs = new InMemoryFileService();
		const lock = new PlanFileLock();
		const planDir = URI.file('/tmp/workspace/.void/plans');
		const proposedName = URI.joinPath(planDir, 'plan.md');

		// Both calls want to use the same name. After the first writes, the
		// second call's "exists" check (still inside the lock) should see the
		// file and pick a different name.
		const results: string[] = [];
		const callSave = async (): Promise<void> => {
			await lock.withLock(planDir.fsPath, async () => {
				let chosen = proposedName;
				// re-check inside lock
				let attempt = 0;
				while (await fs.exists(chosen) && attempt < 100) {
					attempt += 1;
					chosen = URI.joinPath(planDir, `plan-${attempt + 1000}.md`);
				}
				await fs.writeFile(chosen, '# Plan');
				results.push(chosen.fsPath);
			});
		};
		await Promise.all([callSave(), callSave()]);
		assert.strictEqual(results.length, 2);
		assert.notStrictEqual(results[0], results[1]);
	});
});
