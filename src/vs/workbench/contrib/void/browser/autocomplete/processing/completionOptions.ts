/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ITextModel } from '../../../../../../editor/common/model.js';
import { allLinebreakSymbols, _ln } from '../constants.js';
import { removeAllWhitespace } from '../utils/stringUtils.js';
import { getLanguageInfo, isInsideStringOrComment } from '../utils/languageAnalysis.js';
import type { PrefixAndSuffixInfo, CompletionOptions } from '../types.js';

export const getCompletionOptions = (prefixAndSuffix: PrefixAndSuffixInfo, relevantContext: string, justAcceptedAutocompletion: boolean, model: ITextModel, cursorOffset: number): CompletionOptions => {

	let { prefix, suffix, prefixToTheLeftOfCursor, suffixToTheRightOfCursor, suffixLines, prefixLines } = prefixAndSuffix

	// Get language info for context-aware completion
	const { languageId } = getLanguageInfo(model);

	// Check if inside string or comment (skip completion)
	if (isInsideStringOrComment(prefix, suffix, languageId)) {
		return {
			predictionType: 'do-not-predict',
			shouldGenerate: false,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: []
		};
	}

	// trim prefix and suffix to not be very large (using 30 lines for better accuracy, following best practices from Copilot/Cursor)
	// Research shows 25-40 lines provides optimal context for accuracy without excessive latency
	suffixLines = suffix.split(_ln).slice(0, 30)
	prefixLines = prefix.split(_ln).slice(-30)

	// Reconstruct prefix/suffix (smart context like imports and enclosing context is gathered in autocompleteService when calling prepareFIMMessage)
	prefix = prefixLines.join(_ln)
	suffix = suffixLines.join(_ln)

	let completionOptions: CompletionOptions

	// Analyze current line context for better prediction
	const isLineEmpty = !prefixToTheLeftOfCursor.trim() && !suffixToTheRightOfCursor.trim()
	const isLinePrefixEmpty = removeAllWhitespace(prefixToTheLeftOfCursor).length === 0
	const isLineSuffixEmpty = removeAllWhitespace(suffixToTheRightOfCursor).length === 0

	// Get previous line to understand intent
	const previousLine = prefixLines.length > 1 ? prefixLines[prefixLines.length - 2] : '';
	const previousLineTrimmed = previousLine.trim();

	// Detect multi-line triggers (function declarations, if statements, etc.)
	const multiLineTriggers = [
		/[{:]\s*$/, // Ends with { or : (Python)
		/^\s*(function|class|interface|enum|type|def|async\s+def|if|else|elif|for|while|try|catch|finally)\b/,
		/^\s*(public|private|protected|static)\s+(class|interface|enum)/,
	];

	const shouldStartMultiLine = multiLineTriggers.some(pattern => pattern.test(previousLineTrimmed));

	// Language-specific stop tokens (more comprehensive to prevent over-generation)
	const languageStopTokens: Record<string, string[]> = {
		'python': ['\n\n', '\ndef ', '\nclass ', '\n#', '\n@', '\nif __name__'],
		'javascript': ['\n\n', '\nfunction ', '\nclass ', '\nconst ', '\nlet ', '\nvar ', '\n//', '\nexport ', '\nimport '],
		'typescript': ['\n\n', '\nfunction ', '\nclass ', '\ninterface ', '\ntype ', '\nconst ', '\nlet ', '\nvar ', '\n//', '\nexport ', '\nimport '],
		'javascriptreact': ['\n\n', '\nfunction ', '\nconst ', '\nclass ', '\n//', '\nexport ', '\nimport '],
		'typescriptreact': ['\n\n', '\nfunction ', '\nconst ', '\ninterface ', '\ntype ', '\nclass ', '\n//', '\nexport ', '\nimport '],
		'go': ['\n\n', '\nfunc ', '\ntype ', '\npackage ', '\n//'],
		'rust': ['\n\n', '\nfn ', '\npub ', '\nuse ', '\nstruct ', '\n//'],
		'java': ['\n\n', '\npublic ', '\nprivate ', '\nprotected ', '\nclass ', '\n//'],
		'csharp': ['\n\n', '\npublic ', '\nprivate ', '\nprotected ', '\nclass ', '\n//'],
		'cpp': ['\n\n', '\nvoid ', '\nint ', '\nclass ', '\n//'],
		'c': ['\n\n', '\nvoid ', '\nint ', '\nstruct ', '\n//'],
	};

	const defaultStopTokens = allLinebreakSymbols;
	const multiLineStopTokens = languageStopTokens[languageId] || [`${_ln}${_ln}`, '\n//'];

	// if we just accepted an autocompletion, predict a multiline completion starting on the next line
	if (justAcceptedAutocompletion && isLineSuffixEmpty) {
		const prefixWithNewline = prefix + _ln
		completionOptions = {
			predictionType: 'multi-line-start-on-next-line',
			shouldGenerate: true,
			llmPrefix: prefixWithNewline,
			llmSuffix: suffix,
			stopTokens: multiLineStopTokens
		}
	}
	// if previous line suggests multi-line and current line is empty
	else if (shouldStartMultiLine && isLineEmpty) {
		completionOptions = {
			predictionType: 'multi-line-start-on-next-line',
			shouldGenerate: true,
			llmPrefix: prefix + _ln,
			llmSuffix: suffix,
			stopTokens: multiLineStopTokens
		}
	}
	// if the current line is empty, predict a single-line completion
	else if (isLineEmpty) {
		completionOptions = {
			predictionType: 'single-line-fill-middle',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: defaultStopTokens
		}
	}
	// if suffix is very small (≤5 chars) or only punctuation, complete line ignoring it
	else if (removeAllWhitespace(suffixToTheRightOfCursor).length <= 5 || /^[\s\);,}\]]*$/.test(suffixToTheRightOfCursor)) {
		const suffixLinesIgnoringThisLine = suffixLines.slice(1)
		const suffixStringIgnoringThisLine = suffixLinesIgnoringThisLine.length === 0 ? '' : _ln + suffixLinesIgnoringThisLine.join(_ln)
		completionOptions = {
			predictionType: 'single-line-redo-suffix',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffixStringIgnoringThisLine,
			stopTokens: defaultStopTokens
		}
	}
	// else attempt to complete the middle of the line if there is a prefix (the completion looks bad if there is no prefix)
	else if (!isLinePrefixEmpty) {
		completionOptions = {
			predictionType: 'single-line-fill-middle',
			shouldGenerate: true,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: defaultStopTokens
		}
	} else {
		completionOptions = {
			predictionType: 'do-not-predict',
			shouldGenerate: false,
			llmPrefix: prefix,
			llmSuffix: suffix,
			stopTokens: []
		}
	}

	return completionOptions

}
