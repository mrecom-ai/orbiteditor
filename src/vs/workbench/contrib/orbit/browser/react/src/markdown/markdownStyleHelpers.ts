/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import type { CSSProperties } from 'react';

const FILE_EXTENSIONS = 'tsx?|jsx?|mjs|cjs|rs|py|go|java|kt|swift|cs|cpp|c|h|hpp|css|scss|less|html|vue|svelte|json|jsonc|md|yaml|yml|toml|lock|sh|bash|zsh|sql|graphql|proto|dockerfile';

const FILENAME_EXTENSION_RE = new RegExp(`\\.(${FILE_EXTENSIONS})$`, 'i');

/** Detect filenames like StreamingTool.tsx or architecture.md for link-style rendering. */
export const isLikelyFilename = (text: string): boolean => {
	const s = text.trim();
	if (!s || s.length > 200) {
		return false;
	}
	if (FILENAME_EXTENSION_RE.test(s)) {
		return true;
	}
	const basename = s.split('/').pop() ?? s;
	return FILENAME_EXTENSION_RE.test(basename);
};

/** Match bare filenames in plain text (e.g. list items: "architecture.md -- overview"). */
export const FILE_IN_TEXT_REGEX = new RegExp(
	`([\\w][\\w.-]*(?:\\/[\\w.-]+)*\\.(?:${FILE_EXTENSIONS}))`,
	'gi',
);

export type TextSegment = { type: 'text' | 'file'; value: string };

export const splitTextWithFileReferences = (text: string): TextSegment[] => {
	const segments: TextSegment[] = [];
	let lastIndex = 0;

	const re = new RegExp(FILE_IN_TEXT_REGEX.source, 'gi');
	let match: RegExpExecArray | null;

	while ((match = re.exec(text)) !== null) {
		const filename = match[1];
		if (!isLikelyFilename(filename)) {
			continue;
		}

		if (match.index > lastIndex) {
			segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
		}
		segments.push({ type: 'file', value: filename });
		lastIndex = match.index + filename.length;
	}

	if (lastIndex < text.length) {
		segments.push({ type: 'text', value: text.slice(lastIndex) });
	}

	if (segments.length === 0) {
		segments.push({ type: 'text', value: text });
	}

	return segments;
};

/** Single-line fenced blocks that should render as a compact pill, not a full editor. */
export const isCompactCodeBlock = (contents: string, opts: { isApplyEnabled?: boolean }): boolean => {
	if (opts.isApplyEnabled) {
		return false;
	}
	const trimmed = contents.trim();
	if (!trimmed || trimmed.includes('\n')) {
		return false;
	}
	return trimmed.length <= 220;
};

export const FILE_LINK_STYLE_CLASS = 'orbit-file-link';

/** Minimal inline overrides — main styling lives in styles.css for consistency. */
export const FILE_LINK_INLINE_STYLE: CSSProperties = {
	cursor: 'pointer',
};

export const INLINE_CODE_STYLE_CLASS = 'orbit-inline-code';