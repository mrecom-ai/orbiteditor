/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Create normalized hash key for cache indexing (faster lookups)
export const createPrefixHash = (prefix: string): string => {
	// Normalize by removing all whitespace and taking last 200 chars
	// This allows matching even when indentation differs
	const normalized = removeAllWhitespace(prefix);
	return normalized.slice(-200); // Use suffix of normalized string
}

const removeAllWhitespace = (str: string): string => str.replace(/\s+/g, '');
