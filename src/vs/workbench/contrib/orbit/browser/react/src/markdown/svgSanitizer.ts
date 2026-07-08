/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Conservative SVG sanitizer used to defend `dangerouslySetInnerHTML` against
 * untrusted SVG payloads (Phase 1.9 / C9 fix). Mermaid's render output is
 * server-side-rendered SVG and is normally safe, but we treat it as untrusted
 * because the input (a Mermaid code block from the LLM) is user-controlled.
 *
 * The sanitizer:
 *  1. Strips the following tags entirely: script, foreignObject, iframe, object,
 *     embed, form, input, style, link, meta, base.
 *  2. Strips any attribute whose name starts with "on" (event handlers).
 *  3. Strips href / xlink:href attributes whose value starts with "javascript:".
 *
 * It does NOT attempt to be a full HTML/SVG parser; instead it uses a small set
 * of regex passes. This is intentionally simple and dependency-free, so the
 * React bundle is not affected.
 */
const DANGEROUS_TAGS = new Set([
	'script',
	'foreignobject',
	'iframe',
	'object',
	'embed',
	'form',
	'input',
	'style',
	'link',
	'meta',
	'base',
]);

const DANGEROUS_URL_ATTRS = new Set(['href', 'xlink:href']);

/**
 * Sanitize an SVG string for safe insertion via `dangerouslySetInnerHTML`.
 * Returns a string that is safe to render in the DOM. If `svg` is empty, the
 * empty string is returned.
 */
export function sanitizeSvgForRender(svg: string): string {
	if (!svg) {
		return '';
	}
	let out = svg;

	// 1. Strip dangerous tag blocks. We match the open tag, optional attributes,
	//    and the matching close tag. Case-insensitive; tolerant of attributes.
	out = out.replace(
		/<(script|foreignObject|iframe|object|embed|form|input|style|link|meta|base)\b[^>]*>[\s\S]*?<\/\1>/gi,
		'',
	);
	// Also strip self-closing variants of the dangerous tags.
	out = out.replace(
		/<(script|foreignObject|iframe|object|embed|form|input|style|link|meta|base)\b[^>]*\/?>/gi,
		'',
	);

	// 2. Strip event handler attributes (onclick, onload, onerror, onbegin, ...).
	//    Match the attribute name up to the first whitespace, '/', or '>' after
	//    it. We do not try to be precise about quoted attribute values; we just
	//    match the attribute up to a delimiter.
	out = out.replace(
		/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
		'',
	);

	// 3. Strip href / xlink:href attributes whose value starts with "javascript:".
	//    Match the attribute name, the value, and replace with an empty string.
	out = out.replace(
		/\s+(href|xlink:href)\s*=\s*"javascript:[^"]*"/gi,
		' $1=""',
	);
	out = out.replace(
		/\s+(href|xlink:href)\s*=\s*'javascript:[^']*'/gi,
		" $1=''",
	);
	out = out.replace(
		/\s+(href|xlink:href)\s*=\s*javascript:[^\s>]+/gi,
		' $1=""',
	);

	return out;
}

/** Test-only: returns whether a given tag name is considered dangerous. */
export function _isDangerousTag(name: string): boolean {
	return DANGEROUS_TAGS.has(name.toLowerCase());
}

/** Test-only: returns whether a given attribute name is a dangerous URL attr. */
export function _isDangerousUrlAttr(name: string): boolean {
	return DANGEROUS_URL_ATTRS.has(name.toLowerCase());
}
