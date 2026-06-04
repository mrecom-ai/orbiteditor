/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';

export type PdfExtractResult = {
	textContent: string;
	totalPages: number;
};

const PDF_FAILED_MESSAGE = '[PDF: failed to extract text]';

/**
 * Best-effort PDF text extraction without a hard dependency on pdfjs-dist.
 * Handles common uncompressed text objects; falls back to a short error string.
 */
export const extractPdfText = async (value: VSBuffer): Promise<PdfExtractResult> => {
	try {
		const raw = new TextDecoder('latin1').decode(value.buffer);
		const totalPages = countPdfPages(raw);
		const text = extractTextFromPdfLatin1(raw);
		if (!text.trim()) {
			return { textContent: PDF_FAILED_MESSAGE, totalPages };
		}
		return { textContent: text, totalPages };
	} catch {
		return { textContent: PDF_FAILED_MESSAGE, totalPages: 0 };
	}
};

export const countPdfPages = (pdfLatin1: string): number => {
	const typePageMatches = pdfLatin1.match(/\/Type\s*\/Page\b/g);
	if (typePageMatches && typePageMatches.length > 0) {
		return typePageMatches.length;
	}
	const countMatch = pdfLatin1.match(/\/Count\s+(\d+)/);
	if (countMatch) {
		const n = Number.parseInt(countMatch[1], 10);
		if (Number.isInteger(n) && n > 0) {
			return n;
		}
	}
	return 0;
};

const extractTextFromPdfLatin1 = (raw: string): string => {
	const parts: string[] = [];

	// Parenthesized literal strings: (Hello World)
	const parenRegex = /\((?:\\.|[^\\)])*\)/g;
	let match: RegExpExecArray | null;
	while ((match = parenRegex.exec(raw)) !== null) {
		const inner = match[0].slice(1, -1);
		const decoded = decodePdfEscapedString(inner);
		if (decoded.trim()) {
			parts.push(decoded);
		}
	}

	return parts.join('\n');
};

const decodePdfEscapedString = (s: string): string => {
	return s
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\\(/g, '(')
		.replace(/\\\)/g, ')')
		.replace(/\\\\/g, '\\');
};
