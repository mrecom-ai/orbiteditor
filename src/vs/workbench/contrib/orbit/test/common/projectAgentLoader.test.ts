/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { parseFrontmatter, loadAgentsFromDir } from '../../browser/projectAgentLoader.js';

type FakeChild = { name: string; resource: URI; size?: number };

/** Minimal in-memory IFileService stand-in — only the surface loadAgentsFromDir touches. */
class InMemoryFileService {
	private dirChildren = new Map<string, FakeChild[]>();
	private fileContents = new Map<string, string>();

	setDir(dir: URI, files: { name: string; content: string; size?: number }[]): void {
		const children: FakeChild[] = [];
		for (const f of files) {
			const resource = URI.joinPath(dir, f.name);
			this.fileContents.set(resource.toString(), f.content);
			children.push({ name: f.name, resource, size: f.size });
		}
		this.dirChildren.set(dir.toString(), children);
	}

	async resolve(dir: URI): Promise<{ children?: FakeChild[] }> {
		const children = this.dirChildren.get(dir.toString());
		if (!children) throw new Error('ENOENT');
		return { children };
	}

	async readFile(resource: URI): Promise<{ value: { byteLength: number; toString(): string } }> {
		const content = this.fileContents.get(resource.toString());
		if (content === undefined) throw new Error('ENOENT');
		return { value: { byteLength: content.length, toString: () => content } };
	}
}

const agentFile = (frontmatter: Record<string, string>, body: string): string => {
	const lines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`);
	return `---\n${lines.join('\n')}\n---\n${body}`;
};

suite('parseFrontmatter', () => {
	test('parses a well-formed frontmatter block', () => {
		const { meta, body } = parseFrontmatter('---\nagentType: foo\nwhenToUse: bar\n---\nSystem prompt body.');
		assert.strictEqual(meta.agentType, 'foo');
		assert.strictEqual(meta.whenToUse, 'bar');
		assert.strictEqual(body, 'System prompt body.');
	});

	test('falls back to whole content as body when there is no opening delimiter', () => {
		const { meta, body } = parseFrontmatter('no frontmatter here');
		assert.deepStrictEqual(meta, {});
		assert.strictEqual(body, 'no frontmatter here');
	});

	test('falls back to whole content as body when the closing delimiter is missing', () => {
		const { meta, body } = parseFrontmatter('---\nagentType: foo\nSystem prompt with no closing ---marker');
		assert.deepStrictEqual(meta, {});
		assert.strictEqual(body, '---\nagentType: foo\nSystem prompt with no closing ---marker');
	});

	test('ignores lines without a colon', () => {
		const { meta } = parseFrontmatter('---\nnotakeyvalue\nagentType: foo\n---\nbody');
		assert.strictEqual(meta.agentType, 'foo');
		assert.strictEqual(Object.keys(meta).length, 1);
	});
});

suite('loadAgentsFromDir', () => {
	const dir = URI.file('/home/user/.orbit/agents');

	test('loads a valid agent file', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'reviewer.md', content: agentFile({ agentType: 'reviewer', whenToUse: 'Review code' }, 'You are a reviewer.') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 1);
		assert.strictEqual(agents[0].agentType, 'reviewer');
		assert.strictEqual(agents[0].source, 'user');
		assert.strictEqual(agents[0].getSystemPrompt(), 'You are a reviewer.');
	});

	test('skips a file with an invalid agentType format', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'bad.md', content: agentFile({ agentType: '1-bad-start', whenToUse: 'x' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'project', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('skips a file with a space in agentType', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'bad2.md', content: agentFile({ agentType: 'has space', whenToUse: 'x' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'project', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('accepts agentType with digits, dashes, and underscores after the first letter', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'ok.md', content: agentFile({ agentType: 'a1_b-2', whenToUse: 'x' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'project', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 1);
		assert.strictEqual(agents[0].agentType, 'a1_b-2');
	});

	test('skips a file missing whenToUse', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'noWhen.md', content: agentFile({ agentType: 'foo' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('skips a file with an empty body', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'empty.md', content: agentFile({ agentType: 'foo', whenToUse: 'x' }, '') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('permissionMode takes precedence over disallowedTools when both are set', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{
			name: 'agent.md',
			content: agentFile({ agentType: 'foo', whenToUse: 'x', permissionMode: 'read_only', disallowedTools: 'Write' }, 'body'),
		}]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents[0].permissionMode, 'read_only');
		assert.deepStrictEqual(agents[0].disallowedTools, []);
	});

	test('parses disallowedTools when permissionMode is absent, dropping unknown tool names', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{
			name: 'agent.md',
			content: agentFile({ agentType: 'foo', whenToUse: 'x', disallowedTools: 'Write, NotARealTool, Shell' }, 'body'),
		}]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.deepStrictEqual(agents[0].disallowedTools, ['Write', 'Shell']);
	});

	test('invalid permissionMode value is treated as unset', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'agent.md', content: agentFile({ agentType: 'foo', whenToUse: 'x', permissionMode: 'bogus' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents[0].permissionMode, undefined);
	});

	test('parses a valid maxTurns', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'agent.md', content: agentFile({ agentType: 'foo', whenToUse: 'x', maxTurns: '20' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents[0].maxTurns, 20);
	});

	test('non-integer or non-positive maxTurns falls back to undefined', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [
			{ name: 'a.md', content: agentFile({ agentType: 'foo1', whenToUse: 'x', maxTurns: '0' }, 'body') },
			{ name: 'b.md', content: agentFile({ agentType: 'foo2', whenToUse: 'x', maxTurns: 'abc' }, 'body') },
			{ name: 'c.md', content: agentFile({ agentType: 'foo3', whenToUse: 'x', maxTurns: '-5' }, 'body') },
		]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		for (const a of agents) assert.strictEqual(a.maxTurns, undefined);
	});

	test('a decimal maxTurns is truncated by parseInt to its integer part (documents actual behavior)', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'a.md', content: agentFile({ agentType: 'foo', whenToUse: 'x', maxTurns: '3.9' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents[0].maxTurns, 3);
	});

	test('skips a file whose stat size exceeds the 1MB cap without reading it', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'huge.md', content: agentFile({ agentType: 'huge', whenToUse: 'x' }, 'body'), size: 2_000_000 }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('skips a file whose content byteLength exceeds the 1MB cap when stat size is unavailable', async () => {
		const fs = new InMemoryFileService();
		const bigBody = 'x'.repeat(1_000_001);
		fs.setDir(dir, [{ name: 'huge2.md', content: agentFile({ agentType: 'huge2', whenToUse: 'x' }, bigBody) }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('ignores non-.md files', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'notes.txt', content: agentFile({ agentType: 'foo', whenToUse: 'x' }, 'body') }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('malformed frontmatter falls back gracefully instead of throwing', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, [{ name: 'malformed.md', content: 'agentType: foo\nwhenToUse: bar\nno delimiters at all' }]);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('returns an empty list for a missing directory', async () => {
		const fs = new InMemoryFileService();
		const agents = await loadAgentsFromDir(URI.file('/does/not/exist'), 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});

	test('returns an empty list for an empty directory', async () => {
		const fs = new InMemoryFileService();
		fs.setDir(dir, []);
		const agents = await loadAgentsFromDir(dir, 'user', fs as unknown as IFileService);
		assert.strictEqual(agents.length, 0);
	});
});
