/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { RawToolCallObj } from '../../../../../../common/sendLLMMessageTypes.js';
import { resolveLegacyToolName } from '../../constants/legacyToolNameMap.js';
import { computeDiffStats } from './unifiedDiffUtils.js';
import { editToolStrings } from './editToolStrings.js';
import {
	CONTENTS_PARAM_NAMES,
	EditToolContentType,
	getEditToolContentType,
	getEditToolPathParam,
	getStrReplaceStreamingContent,
	hasAnyDoneParam,
	hasAnyParam,
	LEGACY_BLOCKS_PARAM_NAMES,
	NEW_STRING_PARAM_NAMES,
	OLD_STRING_PARAM_NAMES,
	PATH_PARAM_NAMES,
	pickStringParam,
} from './editToolDisplayData.js';
type EditToolInnerPhase = 'content' | 'empty-write' | 'loading';

export type StreamingEditToolCardState = {
	isEditTool: boolean;
	effectiveToolName: string;
	editToolType: EditToolContentType;
	code: string;
	oldString?: string;
	newString?: string;
	displayFilename: string;
	showFileIcon: boolean;
	diffStats: { additions: number; deletions: number };
	contentDependencyKey: string;
	phase: EditToolInnerPhase;
	useStreamingCode: boolean;
	streamingText: string;
	isStreamingCode: boolean;
	showDiff: boolean;
	loadingMessage: string;
	hasDisplayableContent: boolean;
};

/** Display code for non-edit streaming tools (Shell, Grep, MCP, etc.) — preserves pre-refactor behavior. */
export const computeNonEditStreamingDisplayCode = (
	toolName: string,
	rawParams: Record<string, unknown>,
): string => {
	const editToolType = getEditToolContentType(toolName, undefined, rawParams);
	const oldString = pickStringParam(rawParams, OLD_STRING_PARAM_NAMES) ?? '';
	const newString = pickStringParam(rawParams, NEW_STRING_PARAM_NAMES) ?? '';
	const writeContents = pickStringParam(rawParams, CONTENTS_PARAM_NAMES) ?? pickStringParam(rawParams, ['newContent', 'new_content']) ?? '';
	const legacyBlocks = pickStringParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES) ?? '';

	if (editToolType === 'strReplace') {
		return oldString || newString;
	}
	if (editToolType === 'rewrite') {
		return writeContents;
	}
	return legacyBlocks;
};

const basenameFromPath = (pathStr: string | undefined): string => {
	if (!pathStr) {
		return '...';
	}
	const parts = pathStr.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] || pathStr;
};

export const computeStreamingEditToolCardState = (toolCallSoFar: RawToolCallObj): StreamingEditToolCardState | null => {
	const toolName = toolCallSoFar.name;
	if (!toolName) {
		return null;
	}

	const rawParams = toolCallSoFar.rawParams ?? {};
	const doneParams = toolCallSoFar.doneParams ?? [];
	const isDone = toolCallSoFar.isDone ?? false;

	const effectiveToolName = resolveLegacyToolName(toolName);
	const editToolType = getEditToolContentType(effectiveToolName, undefined, rawParams);
	const isEditTool = effectiveToolName === 'StrReplace' || effectiveToolName === 'Write' || editToolType === 'legacy-diff';
	if (!isEditTool) {
		return null;
	}

	const pathParam = getEditToolPathParam(rawParams);
	const pathStr = typeof pathParam === 'string' ? pathParam : undefined;
	const pathDone = hasAnyDoneParam(doneParams, PATH_PARAM_NAMES);
	const hasPath = !!(pathStr && pathStr.length > 0);

	const oldStringFieldStarted = editToolType === 'strReplace' && hasAnyParam(rawParams, OLD_STRING_PARAM_NAMES);
	const newStringFieldStarted = editToolType === 'strReplace' && hasAnyParam(rawParams, NEW_STRING_PARAM_NAMES);
	const contentsFieldStarted = editToolType === 'rewrite' && (hasAnyParam(rawParams, CONTENTS_PARAM_NAMES) || hasAnyParam(rawParams, ['newContent', 'new_content']));
	const legacyBlocksFieldStarted = editToolType === 'legacy-diff' && hasAnyParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES);

	const oldString = oldStringFieldStarted ? (pickStringParam(rawParams, OLD_STRING_PARAM_NAMES) ?? '') : undefined;
	const newString = newStringFieldStarted ? (pickStringParam(rawParams, NEW_STRING_PARAM_NAMES) ?? '') : undefined;
	const writeContents = contentsFieldStarted
		? (pickStringParam(rawParams, CONTENTS_PARAM_NAMES) ?? pickStringParam(rawParams, ['newContent', 'new_content']) ?? '')
		: undefined;
	const legacyBlocks = legacyBlocksFieldStarted ? (pickStringParam(rawParams, LEGACY_BLOCKS_PARAM_NAMES) ?? '') : undefined;

	const code = editToolType === 'strReplace'
		? ((oldString ?? '') || (newString ?? ''))
		: editToolType === 'rewrite'
			? (writeContents ?? '')
			: (legacyBlocks ?? '');

	const canShowStrReplaceDiff = editToolType === 'strReplace'
		&& oldString !== undefined
		&& oldString.length > 0
		&& (hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES) || newStringFieldStarted || isDone);

	const contentDone = editToolType === 'strReplace'
		? hasAnyDoneParam(doneParams, OLD_STRING_PARAM_NAMES) || hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES)
		: editToolType === 'rewrite'
			? hasAnyDoneParam(doneParams, CONTENTS_PARAM_NAMES) || hasAnyDoneParam(doneParams, ['newContent', 'new_content'])
			: hasAnyDoneParam(doneParams, LEGACY_BLOCKS_PARAM_NAMES);

	const hasAnyContent = !!(code && code.length > 0);
	const oldStringComplete = hasAnyDoneParam(doneParams, OLD_STRING_PARAM_NAMES);
	const newStringComplete = hasAnyDoneParam(doneParams, NEW_STRING_PARAM_NAMES);

	const streamingText = editToolType === 'strReplace'
		? getStrReplaceStreamingContent({
			oldString: oldString ?? '',
			newString: newString ?? '',
			oldStringFieldStarted,
			oldStringComplete,
			newStringFieldStarted,
			newStringComplete,
		})
		: editToolType === 'rewrite'
			? (writeContents ?? '')
			: code;

	const hasStartedCodeField = contentsFieldStarted || oldStringFieldStarted || newStringFieldStarted || legacyBlocksFieldStarted;
	const isActivelyStreamingCode = !isDone && hasStartedCodeField;

	// For strReplace, additions/deletions are only meaningful once BOTH old and new
	// strings are fully streamed. Using the looser `contentDone` (either field complete)
	// made the +/- counts flicker — briefly showing the entire old block as "removed"
	// while new_string was still arriving.
	const diffStatsReady = editToolType === 'strReplace'
		? (oldStringComplete && newStringComplete)
		: contentDone;
	const shouldComputeDiffStats = (editToolType === 'strReplace' || editToolType === 'rewrite')
		&& (hasAnyContent || contentsFieldStarted || oldStringFieldStarted || newStringFieldStarted)
		&& (!isActivelyStreamingCode || isDone || diffStatsReady);
	const diffStats = shouldComputeDiffStats
		? computeDiffStats(
			editToolType === 'strReplace' ? (oldString ?? '') : '',
			editToolType === 'strReplace' ? (newString ?? '') : (writeContents ?? ''),
		)
		: { additions: 0, deletions: 0 };

	const showStrReplaceDiff = editToolType === 'strReplace' && canShowStrReplaceDiff && !isActivelyStreamingCode;
	const showWriteDiff = editToolType === 'rewrite' && writeContents !== undefined && writeContents.length > 0 && !isActivelyStreamingCode;
	const showEmptyWrite = editToolType === 'rewrite' && contentsFieldStarted && contentDone && (writeContents?.length ?? 0) === 0;

	const desc1 = pathStr ? basenameFromPath(pathStr) : '...';
	const displayFilename = desc1 && desc1 !== '...'
		? desc1
		: (pathDone || hasPath ? editToolStrings.preparing : editToolStrings.loading);

	const phase: EditToolInnerPhase = showEmptyWrite
		? 'empty-write'
		: (showStrReplaceDiff || showWriteDiff || isActivelyStreamingCode || hasStartedCodeField)
			? 'content'
			: 'loading';

	const useStreamingCode = (isActivelyStreamingCode || hasStartedCodeField) && !showStrReplaceDiff && !showWriteDiff && !showEmptyWrite;

	return {
		isEditTool,
		effectiveToolName,
		editToolType,
		code,
		oldString: editToolType === 'strReplace' ? oldString : undefined,
		newString: editToolType === 'strReplace' ? newString : writeContents,
		displayFilename,
		showFileIcon: pathDone || hasPath,
		diffStats,
		contentDependencyKey: `${effectiveToolName}:${editToolType}:${oldString?.length ?? 0}:${newString?.length ?? 0}:${writeContents?.length ?? 0}:${legacyBlocks?.length ?? 0}:${isDone}`,
		phase,
		useStreamingCode,
		streamingText,
		isStreamingCode: !isDone,
		showDiff: showStrReplaceDiff || showWriteDiff,
		loadingMessage: !hasPath
			? editToolStrings.determiningFile
			: !contentDone && !hasStartedCodeField
				? editToolStrings.generatingCode
				: editToolStrings.processing,
		hasDisplayableContent: true,
	};
};