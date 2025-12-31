/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { removeLeftTabsAndTrimEnds, getIndex, getLastLine } from '../utils/stringUtils.js';
import { _ln } from '../constants.js';
import type { Autocompletion, AutocompletionMatchupBounds } from '../types.js';

// returns the startIdx of the match if there is a match, or undefined if there is no match
// all results are wrt `autocompletion.result`
export const getAutocompletionMatchup = ({ prefix, autocompletion }: { prefix: string, autocompletion: Autocompletion }): AutocompletionMatchupBounds | undefined => {

	const trimmedCurrentPrefix = removeLeftTabsAndTrimEnds(prefix)
	const trimmedCompletionPrefix = removeLeftTabsAndTrimEnds(autocompletion.prefix)
	const trimmedCompletionMiddle = removeLeftTabsAndTrimEnds(autocompletion.insertText)

	// console.log('@result: ', JSON.stringify(autocompletion.insertText))
	// console.log('@trimmedCurrentPrefix: ', JSON.stringify(trimmedCurrentPrefix))
	// console.log('@trimmedCompletionPrefix: ', JSON.stringify(trimmedCompletionPrefix))
	// console.log('@trimmedCompletionMiddle: ', JSON.stringify(trimmedCompletionMiddle))

	if (trimmedCurrentPrefix.length < trimmedCompletionPrefix.length) { // user must write text beyond the original prefix at generation time
		// console.log('@undefined1')
		return undefined
	}

	if ( // check that completion starts with the prefix
		!(trimmedCompletionPrefix + trimmedCompletionMiddle)
			.startsWith(trimmedCurrentPrefix)
	) {
		// console.log('@undefined2')
		return undefined
	}

	// reverse map to find position wrt `autocompletion.result`
	const lineStart =
		trimmedCurrentPrefix.split(_ln).length -
		trimmedCompletionPrefix.split(_ln).length;

	if (lineStart < 0) {
		// console.log('@undefined3')

		console.error('Error: No line found.');
		return undefined;
	}
	const currentPrefixLine = getLastLine(trimmedCurrentPrefix)
	const completionPrefixLine = lineStart === 0 ? getLastLine(trimmedCompletionPrefix) : ''
	const completionMiddleLine = autocompletion.insertText.split(_ln)[lineStart]
	const fullCompletionLine = completionPrefixLine + completionMiddleLine

	// console.log('currentPrefixLine', currentPrefixLine)
	// console.log('completionPrefixLine', completionPrefixLine)
	// console.log('completionMiddleLine', completionMiddleLine)

	const charMatchIdx = fullCompletionLine.indexOf(currentPrefixLine)
	if (charMatchIdx < 0) {
		// console.log('@undefined4', charMatchIdx)

		console.error('Warning: Found character with negative index. This should never happen.')
		return undefined
	}

	const character = (charMatchIdx +
		currentPrefixLine.length
		- completionPrefixLine.length
	)

	const startIdx = getIndex(autocompletion.insertText, lineStart, character)

	return {
		startLine: lineStart,
		startCharacter: character,
		startIdx,
	}

}
