/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ITextModel } from '../../../../../../editor/common/model.js';
import { _ln } from '../constants.js';

// Extract language/file type from model
export const getLanguageInfo = (model: ITextModel): { languageId: string, fileName: string, fileExtension: string } => {
	const languageId = model.getLanguageId();
	const fileName = model.uri.path.split('/').pop() || 'untitled';
	const fileExtension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
	return { languageId, fileName, fileExtension };
}

// Get imports from the beginning of the file (critical context)
export const getImportsContext = (fullText: string, languageId: string): string => {
	const lines = fullText.split(_ln);
	const importLines: string[] = [];

	// Language-specific import patterns
	const importPatterns: Record<string, RegExp[]> = {
		'typescript': [/^\s*import\s+/, /^\s*from\s+/, /^\s*require\(/],
		'javascript': [/^\s*import\s+/, /^\s*from\s+/, /^\s*require\(/],
		'typescriptreact': [/^\s*import\s+/, /^\s*from\s+/, /^\s*require\(/],
		'javascriptreact': [/^\s*import\s+/, /^\s*from\s+/, /^\s*require\(/],
		'python': [/^\s*import\s+/, /^\s*from\s+.+import/],
		'go': [/^\s*import\s+\(/, /^\s*import\s+"/, /^\s*package\s+/],
		'rust': [/^\s*use\s+/, /^\s*extern\s+crate/],
		'java': [/^\s*import\s+/, /^\s*package\s+/],
		'csharp': [/^\s*using\s+/],
		'cpp': [/^\s*#include\s+/],
		'c': [/^\s*#include\s+/],
	};

	const patterns = importPatterns[languageId] || importPatterns['javascript'];

	// Collect imports (usually at top of file, limit to first 50 lines)
	for (let i = 0; i < Math.min(50, lines.length); i++) {
		const line = lines[i];
		// Skip empty lines and comments
		if (!line.trim() || line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
			continue;
		}
		// Check if line matches import pattern
		if (patterns.some(pattern => pattern.test(line))) {
			importLines.push(line);
		}
		// Stop if we hit non-import code (but allow blank lines)
		else if (line.trim() && importLines.length > 0) {
			break;
		}
	}

	return importLines.length > 0 ? importLines.join(_ln) + _ln : '';
}

// Get function/class context that cursor is inside
export const getEnclosingContext = (fullText: string, cursorOffset: number, languageId: string): string => {
	const beforeCursor = fullText.substring(0, cursorOffset);
	const lines = beforeCursor.split(_ln);

	// Patterns for function/class declarations
	const functionPatterns: Record<string, RegExp[]> = {
		'typescript': [
			/^\s*(export\s+)?(async\s+)?function\s+(\w+)/,
			/^\s*(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
			/^\s*(private|public|protected|static)?\s*(async\s+)?(\w+)\s*\(/,
		],
		'javascript': [
			/^\s*(export\s+)?(async\s+)?function\s+(\w+)/,
			/^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
		],
		'python': [
			/^\s*def\s+(\w+)/,
			/^\s*async\s+def\s+(\w+)/,
		],
		'go': [
			/^\s*func\s+(\w+)/,
			/^\s*func\s+\([^)]+\)\s+(\w+)/,
		],
		'rust': [
			/^\s*(pub\s+)?(async\s+)?fn\s+(\w+)/,
		],
		'java': [
			/^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/,
		],
		'csharp': [
			/^\s*(public|private|protected|internal)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/,
		],
	};

	const classPatterns: Record<string, RegExp[]> = {
		'typescript': [/^\s*(export\s+)?(abstract\s+)?class\s+(\w+)/],
		'javascript': [/^\s*(export\s+)?class\s+(\w+)/],
		'python': [/^\s*class\s+(\w+)/],
		'go': [/^\s*type\s+(\w+)\s+struct/],
		'rust': [/^\s*(pub\s+)?struct\s+(\w+)/, /^\s*(pub\s+)?impl\s+(\w+)/],
		'java': [/^\s*(public|private|protected)?\s*(abstract\s+)?class\s+(\w+)/],
		'csharp': [/^\s*(public|private|protected|internal)?\s*(abstract\s+)?class\s+(\w+)/],
	};

	const funcPatterns = functionPatterns[languageId] || functionPatterns['javascript'];
	const clsPatterns = classPatterns[languageId] || classPatterns['javascript'];

	// Search backwards for function/class declaration
	for (let i = lines.length - 1; i >= Math.max(0, lines.length - 100); i--) {
		const line = lines[i];

		// Check for function
		for (const pattern of funcPatterns) {
			if (pattern.test(line)) {
				return line.trim();
			}
		}

		// Check for class
		for (const pattern of clsPatterns) {
			if (pattern.test(line)) {
				return line.trim();
			}
		}
	}

	return '';
}

// Check if cursor is inside a string or comment (don't complete)
export const isInsideStringOrComment = (prefix: string, suffix: string, languageId: string): boolean => {
	const lastLine = prefix.split(_ln).pop() || '';
	// const nextLine = suffix.split(_ln)[0] || ''; // Reserved for future suffix analysis

	// Check for common string patterns
	const stringPatterns = [
		/["']([^"'\\]|\\.)*$/, // Unclosed string
		/`[^`]*$/, // Unclosed template literal
	];

	// Check for comment patterns
	const commentPatterns: Record<string, RegExp[]> = {
		'typescript': [/\/\//, /\/\*[^*]*$/],
		'javascript': [/\/\//, /\/\*[^*]*$/],
		'python': [/#/, /"""[^"]*$/, /'''[^']*$/],
		'go': [/\/\//, /\/\*[^*]*$/],
		'rust': [/\/\//, /\/\*[^*]*$/],
		'java': [/\/\//, /\/\*[^*]*$/],
		'csharp': [/\/\//, /\/\*[^*]*$/],
		'cpp': [/\/\//, /\/\*[^*]*$/],
		'c': [/\/\//, /\/\*[^*]*$/],
	};

	const comments = commentPatterns[languageId] || commentPatterns['javascript'];

	// Check strings
	for (const pattern of stringPatterns) {
		if (pattern.test(lastLine)) {
			return true;
		}
	}

	// Check comments
	for (const pattern of comments) {
		if (pattern.test(lastLine)) {
			return true;
		}
	}

	return false;
}
