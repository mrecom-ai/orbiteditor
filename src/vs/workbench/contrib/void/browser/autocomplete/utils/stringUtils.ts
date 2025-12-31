/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EndOfLinePreference, ITextModel } from '../../../../../../editor/common/model.js';
import { Position } from '../../../../../../editor/common/core/position.js';
import { extractCodeFromRegular } from '../../../common/helpers/extractCodeFromResult.js';
import { _ln, MAX_TRIM_CACHE_SIZE } from '../constants.js';
import type { PrefixAndSuffixInfo } from '../types.js';

// postprocesses the result - removes markdown, explanations, and keeps only code
export const processStartAndEndSpaces = (result: string) => {

	// Extract code from markdown blocks if present
	[result,] = extractCodeFromRegular({ text: result, recentlyAddedTextLen: result.length })

	// Remove common instruction prefixes that models might add
	const instructionPrefixes = [
		'Here is the code:',
		'Here\'s the code:',
		'The code is:',
		'Complete code:',
		'Completion:',
		'```',
	];

	for (const prefix of instructionPrefixes) {
		if (result.toLowerCase().startsWith(prefix.toLowerCase())) {
			result = result.substring(prefix.length).trim();
		}
	}

	// Remove any trailing markdown or explanations after the code
	const explanationMarkers = [
		'\n\nThis',
		'\n\nThe above',
		'\n\nNote:',
		'\n\n#',
		'\n\n//',
	];

	for (const marker of explanationMarkers) {
		const idx = result.indexOf(marker);
		if (idx > 0) {
			result = result.substring(0, idx);
		}
	}

	const hasLeadingSpace = result.startsWith(' ');
	const hasTrailingSpace = result.endsWith(' ');

	return (hasLeadingSpace ? ' ' : '')
		+ result.trim()
		+ (hasTrailingSpace ? ' ' : '');

}

// trims the end of the prefix to improve cache hit rate
// Memoization cache for expensive string operations
const _trimCache = new Map<string, string>();

export const removeLeftTabsAndTrimEnds = (s: string): string => {
	// Check cache first
	const cached = _trimCache.get(s);
	if (cached !== undefined) return cached;

	const trimmedString = s.trimEnd();
	const trailingEnd = s.slice(trimmedString.length);

	// keep only a single trailing newline
	if (trailingEnd.includes(_ln)) {
		s = trimmedString + _ln;
	}

	s = s.replace(/^\s+/gm, ''); // remove left tabs

	// Store in cache (with size limit)
	if (_trimCache.size >= MAX_TRIM_CACHE_SIZE) {
		// Remove oldest entry (first key)
		const firstKey = _trimCache.keys().next().value;
		if (firstKey !== undefined) {
			_trimCache.delete(firstKey);
		}
	}
	_trimCache.set(s, s);

	return s;
}

export const removeAllWhitespace = (str: string): string => str.replace(/\s+/g, '');

export const getPrefixAndSuffixInfo = (model: ITextModel, position: Position): PrefixAndSuffixInfo => {

	const fullText = model.getValue(EndOfLinePreference.LF);

	const cursorOffset = model.getOffsetAt(position)
	const prefix = fullText.substring(0, cursorOffset)
	const suffix = fullText.substring(cursorOffset)


	const prefixLines = prefix.split(_ln)
	const suffixLines = suffix.split(_ln)

	const prefixToTheLeftOfCursor = prefixLines.slice(-1)[0] ?? ''
	const suffixToTheRightOfCursor = suffixLines[0] ?? ''

	return { prefix, suffix, prefixLines, suffixLines, prefixToTheLeftOfCursor, suffixToTheRightOfCursor }

}

export const getIndex = (str: string, line: number, char: number) => {
	return str.split(_ln).slice(0, line).join(_ln).length + (line > 0 ? 1 : 0) + char;
}

export const getLastLine = (s: string): string => {
	const matches = s.match(new RegExp(`[^${_ln}]*$`))
	return matches ? matches[0] : ''
}
