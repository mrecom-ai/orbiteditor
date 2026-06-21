/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { diffLines } from '../../../../out/diff/index.js';

export type UnifiedDiffLineType = 'context' | 'added' | 'removed';

export interface UnifiedDiffLine {
	type: UnifiedDiffLineType;
	content: string;
}

const splitDiffValueIntoLines = (value: string): string[] => {
	const rawLines = value.split('\n');
	if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
		rawLines.pop();
	}
	return rawLines;
};

export const computeUnifiedDiffLines = (oldStr: string, newStr: string): UnifiedDiffLine[] => {
	const changes = diffLines(oldStr, newStr);
	const result: UnifiedDiffLine[] = [];

	for (const change of changes) {
		const type: UnifiedDiffLineType = change.added ? 'added' : change.removed ? 'removed' : 'context';
		for (const line of splitDiffValueIntoLines(change.value)) {
			result.push({ type, content: line });
		}
	}

	return result;
};

export const computeDiffStats = (oldStr: string, newStr: string): { additions: number; deletions: number } => {
	const changes = diffLines(oldStr, newStr);
	let additions = 0;
	let deletions = 0;

	for (const change of changes) {
		const count = change.count ?? splitDiffValueIntoLines(change.value).length;
		if (change.added) {
			additions += count;
		}
		if (change.removed) {
			deletions += count;
		}
	}

	return { additions, deletions };
};

export const buildDiffModelContent = (lines: UnifiedDiffLine[]): string => {
	return lines.map(line => line.content).join('\n');
};
