/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { RawToolParamsObj } from '../../../../../../common/sendLLMMessageTypes.js';
import { resolveLegacyToolName } from '../../constants/legacyToolNameMap.js';

export type EditToolContentType = 'strReplace' | 'legacy-diff' | 'rewrite';

type ParamBag = Record<string, unknown> | RawToolParamsObj | undefined;

const hasOwn = (params: ParamBag, key: string): boolean => !!params && Object.prototype.hasOwnProperty.call(params, key);

export const pickStringParam = (params: ParamBag, names: readonly string[]): string | undefined => {
	for (const name of names) {
		if (!hasOwn(params, name)) {
			continue;
		}
		const value = params?.[name as keyof typeof params];
		return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
	}
	return undefined;
};

export const hasAnyParam = (params: ParamBag, names: readonly string[]): boolean => names.some(name => hasOwn(params, name));

export const hasAnyDoneParam = (doneParams: readonly string[], names: readonly string[]): boolean => names.some(name => doneParams.includes(name));

export const PATH_PARAM_NAMES = ['path', 'uri', 'file_path', 'filePath', 'target_file', 'targetFile'] as const;
export const OLD_STRING_PARAM_NAMES = ['oldString', 'old_string'] as const;
export const NEW_STRING_PARAM_NAMES = ['newString', 'new_string'] as const;
export const CONTENTS_PARAM_NAMES = ['contents', 'content'] as const;
export const LEGACY_BLOCKS_PARAM_NAMES = ['searchReplaceBlocks', 'search_replace_blocks', 'newContent', 'new_content'] as const;

export const getEditToolContentType = (toolName: string, params?: ParamBag, rawParams?: ParamBag): EditToolContentType => {
	// A Write (incl. legacy rewrite_file / create_file_or_folder) is always a
	// whole-file rewrite. Resolve this BEFORE the legacy-block check, because
	// LEGACY_BLOCKS_PARAM_NAMES includes the rewrite content aliases (newContent /
	// new_content) and would otherwise misroute these to the search/replace-block
	// renderer.
	const resolved = resolveLegacyToolName(toolName);
	if (resolved === 'Write') {
		return 'rewrite';
	}

	const hasLegacyBlocks = hasAnyParam(params, LEGACY_BLOCKS_PARAM_NAMES) || hasAnyParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES);
	const hasModernReplaceFields = hasAnyParam(params, OLD_STRING_PARAM_NAMES) || hasAnyParam(params, NEW_STRING_PARAM_NAMES)
		|| hasAnyParam(rawParams, OLD_STRING_PARAM_NAMES) || hasAnyParam(rawParams, NEW_STRING_PARAM_NAMES);
	if (hasLegacyBlocks && !hasModernReplaceFields) {
		return 'legacy-diff';
	}

	return 'strReplace';
};

export const getEditToolPathParam = (params: ParamBag, rawParams?: ParamBag): unknown => {
	for (const source of [params, rawParams]) {
		for (const name of PATH_PARAM_NAMES) {
			if (hasOwn(source, name)) {
				return source?.[name as keyof typeof source];
			}
		}
	}
	return undefined;
};

export const getEditToolDisplayContent = (
	toolName: string,
	params: ParamBag,
	rawParams?: ParamBag,
): { content: string; oldString?: string; newString?: string; hasContent: boolean; type: EditToolContentType } => {
	const type = getEditToolContentType(toolName, params, rawParams);
	const sources = [params, rawParams] as const;

	if (type === 'rewrite') {
		let contents: string | undefined;
		let hasContents = false;
		for (const source of sources) {
			if (!source) {
				continue;
			}
			contents = pickStringParam(source, CONTENTS_PARAM_NAMES) ?? pickStringParam(source, ['newContent', 'new_content']);
			hasContents = hasAnyParam(source, CONTENTS_PARAM_NAMES) || hasAnyParam(source, ['newContent', 'new_content']);
			if (hasContents) {
				break;
			}
		}
		return { content: contents ?? '', newString: hasContents ? contents ?? '' : undefined, hasContent: hasContents, type };
	}

	if (type === 'legacy-diff') {
		let blocks: string | undefined;
		let hasBlocks = false;
		for (const source of sources) {
			if (!source) {
				continue;
			}
			blocks = pickStringParam(source, LEGACY_BLOCKS_PARAM_NAMES);
			hasBlocks = hasAnyParam(source, LEGACY_BLOCKS_PARAM_NAMES);
			if (hasBlocks) {
				break;
			}
		}
		return { content: blocks ?? '', hasContent: hasBlocks && !!blocks?.trim(), type };
	}

	let oldString: string | undefined;
	let newString: string | undefined;
	let hasOldString = false;
	let hasNewString = false;
	for (const source of sources) {
		if (!source) {
			continue;
		}
		if (!hasOldString && hasAnyParam(source, OLD_STRING_PARAM_NAMES)) {
			oldString = pickStringParam(source, OLD_STRING_PARAM_NAMES) ?? '';
			hasOldString = true;
		}
		if (!hasNewString && hasAnyParam(source, NEW_STRING_PARAM_NAMES)) {
			newString = pickStringParam(source, NEW_STRING_PARAM_NAMES) ?? '';
			hasNewString = true;
		}
	}

	return {
		content: oldString && oldString.length > 0 ? oldString : newString ?? '',
		oldString: hasOldString ? oldString ?? '' : undefined,
		newString: hasNewString ? newString ?? '' : undefined,
		hasContent: hasOldString || hasNewString,
		type,
	};
};

export const getStrReplaceStreamingContent = ({
	oldString,
	newString,
	oldStringFieldStarted,
	oldStringComplete,
	newStringFieldStarted,
	newStringComplete,
}: {
	oldString: string;
	newString: string;
	oldStringFieldStarted: boolean;
	oldStringComplete: boolean;
	newStringFieldStarted: boolean;
	newStringComplete: boolean;
}): string => {
	if (oldStringFieldStarted && !oldStringComplete) {
		return oldString;
	}
	if (newStringFieldStarted && !newStringComplete && newString.length > 0) {
		return newString;
	}
	if (newStringFieldStarted && newString.length > 0) {
		return newString;
	}
	if (oldStringFieldStarted) {
		return oldString;
	}
	return '';
};
