/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';

/** Max paths returned to the LLM per Glob call. */
export const GLOB_RESULT_LIMIT = 500;

/** Max matches to mtime-stat before sorting (bounds latency on huge repos). */
export const GLOB_MTIME_SORT_CAP = 15_000;

const GLOB_METACHAR_RE = /[*?\[\]{}!]/;

/**
 * Cursor-style glob normalization: prepend recursive prefix unless already present.
 */
export const normalizeGlobPattern = (pattern: string): string => {
	const trimmed = pattern.trim();
	if (!trimmed) {
		throw new Error('glob_pattern must be a non-empty string.');
	}
	if (trimmed.startsWith('**/')) {
		return trimmed;
	}
	return `**/${trimmed}`;
};

/**
 * Build a glob for filename / @-mention substring search (not sent by the LLM).
 * Plain text becomes a recursive wildcard substring match.
 */
export const toFilenameSearchGlobPattern = (query: string): string => {
	const trimmed = query.trim();
	if (!trimmed) {
		return '**/*';
	}
	if (GLOB_METACHAR_RE.test(trimmed)) {
		return normalizeGlobPattern(trimmed);
	}
	return normalizeGlobPattern(`*${trimmed}*`);
};

export const sortUrisByMtimeDescending = async (fileService: IFileService, uris: URI[]): Promise<URI[]> => {
	if (uris.length === 0) {
		return [];
	}

	const results = await fileService.resolveAll(
		uris.map(resource => ({ resource, options: { resolveMetadata: true } }))
	);

	const withMtime: { uri: URI; mtime: number }[] = [];
	for (let i = 0; i < uris.length; i++) {
		withMtime.push({ uri: uris[i], mtime: results[i].stat?.mtime ?? 0 });
	}

	withMtime.sort((a, b) => b.mtime - a.mtime);
	return withMtime.map(entry => entry.uri);
};

export type GlobSearchOutcome = {
	uris: URI[];
	totalMatches: number;
	hasNextPage: boolean;
	mtimeSortTruncated: boolean;
};

/**
 * Sort matches by mtime (newest first), cap to GLOB_RESULT_LIMIT, and compute pagination flags.
 */
export const finalizeGlobSearchResults = async (
	fileService: IFileService,
	rawUris: URI[],
): Promise<GlobSearchOutcome> => {
	const totalMatches = rawUris.length;
	const mtimeSortTruncated = totalMatches > GLOB_MTIME_SORT_CAP;
	const sortPool = mtimeSortTruncated ? rawUris.slice(0, GLOB_MTIME_SORT_CAP) : rawUris;

	const sorted = await sortUrisByMtimeDescending(fileService, sortPool);
	const uris = sorted.slice(0, GLOB_RESULT_LIMIT);
	const hasNextPage = totalMatches > GLOB_RESULT_LIMIT;

	return { uris, totalMatches, hasNextPage, mtimeSortTruncated };
};
