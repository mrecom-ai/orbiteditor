/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RawToolParamsObj } from '../../common/sendLLMMessageTypes.js';

const PATH_FIELDS = [
	{ field: 'path', target: 'path' },
	{ field: 'uri', target: 'uri' },
	{ field: 'file_path', target: 'path' },
	{ field: 'filePath', target: 'path' },
	{ field: 'target_file', target: 'path' },
	{ field: 'targetFile', target: 'path' },
] as const;
const CONTENT_FIELDS = [
	{ field: 'contents', target: 'contents' },
	{ field: 'content', target: 'contents' },
	{ field: 'old_string', target: 'old_string' },
	{ field: 'oldString', target: 'old_string' },
	{ field: 'new_string', target: 'new_string' },
	{ field: 'newString', target: 'new_string' },
	{ field: 'search_replace_blocks', target: 'search_replace_blocks' },
	{ field: 'searchReplaceBlocks', target: 'search_replace_blocks' },
	{ field: 'new_content', target: 'new_content' },
	{ field: 'newContent', target: 'new_content' },
] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeParsedParams = (parsed: Record<string, unknown>): RawToolParamsObj => {
	const rawParams: RawToolParamsObj = { ...parsed } as RawToolParamsObj;

	for (const { field, target } of PATH_FIELDS) {
		if (rawParams[target as keyof RawToolParamsObj] === undefined && Object.prototype.hasOwnProperty.call(parsed, field)) {
			rawParams[target as keyof RawToolParamsObj] = parsed[field] as string;
		}
	}

	for (const { field, target } of CONTENT_FIELDS) {
		if (rawParams[target as keyof RawToolParamsObj] === undefined && Object.prototype.hasOwnProperty.call(parsed, field)) {
			rawParams[target as keyof RawToolParamsObj] = parsed[field] as string;
		}
	}

	return rawParams;
};

const unescapePartialJsonString = (value: string): string => {
	if (!value) {
		return '';
	}
	try {
		return JSON.parse(`"${value}"`);
	} catch {
		return value
			.replace(/\\n/g, '\n')
			.replace(/\\r/g, '\r')
			.replace(/\\t/g, '\t')
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, '\\');
	}
};

const extractStringFieldFromPartialJson = (
	json: string,
	fieldName: string,
): { value: string; isComplete: boolean } | undefined => {
	const keyPattern = new RegExp(`"${escapeRegExp(fieldName)}"\\s*:\\s*"`);
	const match = keyPattern.exec(json);
	if (!match) {
		return undefined;
	}

	let index = match.index + match[0].length;
	let rawValue = '';
	let isComplete = false;

	while (index < json.length) {
		const char = json[index];
		if (char === '\\') {
			if (index + 1 >= json.length) {
				break;
			}
			rawValue += json[index] + json[index + 1];
			index += 2;
			continue;
		}
		if (char === '"') {
			isComplete = true;
			break;
		}
		rawValue += char;
		index += 1;
	}

	return {
		value: unescapePartialJsonString(rawValue),
		isComplete,
	};
};

export const parsePartialToolParams = (toolParamsStr: string): {
	rawParams: RawToolParamsObj;
	doneParams: string[];
	isDone: boolean;
} => {
	const trimmed = toolParamsStr.trim();
	if (!trimmed) {
		return { rawParams: {}, doneParams: [], isDone: false };
	}

	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === 'object' && parsed !== null) {
			const rawParams = normalizeParsedParams(parsed as Record<string, unknown>);
			return {
				rawParams,
				doneParams: Object.keys(rawParams),
				isDone: true,
			};
		}
	} catch {
		// fall through to partial extraction
	}

	const rawParams: RawToolParamsObj = {};
	const doneParams: string[] = [];

	for (const { field, target } of PATH_FIELDS) {
		const extracted = extractStringFieldFromPartialJson(trimmed, field);
		if (!extracted) {
			continue;
		}
		rawParams[target as keyof RawToolParamsObj] = extracted.value;
		if (extracted.isComplete) {
			doneParams.push(target);
		}
		break;
	}

	for (const { field, target } of CONTENT_FIELDS) {
		const extracted = extractStringFieldFromPartialJson(trimmed, field);
		if (!extracted) {
			continue;
		}
		rawParams[target as keyof RawToolParamsObj] = extracted.value;
		if (extracted.isComplete) {
			doneParams.push(target);
		}
	}

	return {
		rawParams,
		doneParams,
		isDone: false,
	};
};
