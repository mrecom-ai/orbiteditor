/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import * as glob from '../../../../base/common/glob.js';
import { basename, relativePath } from '../../../../base/common/resources.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';
import { BuiltinToolCallParams, GrepFileResult, GrepOutputMode } from './toolsServiceTypes.js';

const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}

const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	if (uriStr.includes('://')) {
		try {
			return URI.parse(uriStr)
		} catch (e) {
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	}
	return URI.file(uriStr)
}

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number')
		return numStr
	if (isFalsy(numStr)) return opts.default

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}

	return opts.default
}

const validateNonNegativeInteger = (argName: string, value: unknown, opts: { default: number | null }) => {
	const n = validateNumber(value, opts)
	if (n === null) return null
	if (!Number.isFinite(n) || !Number.isInteger(n)) {
		throw new Error(`Invalid ${argName}: must be a non-negative integer. Got: ${JSON.stringify(value)}.`)
	}
	if (n < 0) {
		throw new Error(`Invalid ${argName}: must be a non-negative integer. Got: ${JSON.stringify(value)}.`)
	}
	return n
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}

const validateGrepOutputMode = (value: unknown): GrepOutputMode => {
	if (isFalsy(value)) return 'content'
	const outputMode = validateStr('output_mode', value).trim()
	if (outputMode === 'content' || outputMode === 'files_with_matches' || outputMode === 'count') {
		return outputMode
	}
	throw new Error(`Invalid output_mode: "${outputMode}". Must be one of: content, files_with_matches, count.`)
}

export const GREP_DEFAULT_CONTENT_HEAD_LIMIT = 500
export const GREP_DEFAULT_FILE_HEAD_LIMIT = 500
export const GREP_MAX_HEAD_LIMIT = 5_000
export const GREP_MAX_SEARCH_RESULTS = 20_000

export const getEffectiveGrepHeadLimit = (headLimit: number | null, outputMode: GrepOutputMode): number => {
	const defaultHeadLimit = outputMode === 'content' ? GREP_DEFAULT_CONTENT_HEAD_LIMIT : GREP_DEFAULT_FILE_HEAD_LIMIT
	return Math.min(headLimit && headLimit > 0 ? headLimit : defaultHeadLimit, GREP_MAX_HEAD_LIMIT)
}

export const grepTypeGlobMap: Record<string, string[]> = {
	c: ['*.c', '*.h'],
	cpp: ['*.cpp', '*.cc', '*.cxx', '*.hpp', '*.hh', '*.hxx'],
	csharp: ['*.cs'],
	css: ['*.css'],
	dart: ['*.dart'],
	go: ['*.go'],
	html: ['*.html', '*.htm'],
	java: ['*.java'],
	js: ['*.js', '*.jsx', '*.mjs', '*.cjs'],
	json: ['*.json'],
	kotlin: ['*.kt', '*.kts'],
	markdown: ['*.md', '*.markdown'],
	md: ['*.md', '*.markdown'],
	php: ['*.php'],
	py: ['*.py', '*.pyw'],
	python: ['*.py', '*.pyw'],
	rb: ['*.rb'],
	ruby: ['*.rb'],
	rust: ['*.rs'],
	rs: ['*.rs'],
	scss: ['*.scss'],
	sh: ['*.sh', '*.bash', '*.zsh'],
	shell: ['*.sh', '*.bash', '*.zsh'],
	swift: ['*.swift'],
	ts: ['*.ts', '*.tsx'],
	tsx: ['*.tsx'],
	txt: ['*.txt'],
	xml: ['*.xml'],
	yaml: ['*.yaml', '*.yml'],
	yml: ['*.yaml', '*.yml'],
}

export const normalizeGrepGlob = (pattern: string) => {
	const trimmed = pattern.trim()
	if (trimmed.startsWith('.')) return `*${trimmed}`
	return trimmed
}

export const uriMatchesAnyGrepGlob = (uri: URI, roots: URI[], patterns: string[]) => {
	if (patterns.length === 0) return true
	const normalizedPatterns = patterns.map(normalizeGrepGlob).filter(Boolean)
	const candidates = new Set<string>([uri.fsPath.replace(/\\/g, '/'), basename(uri)])
	for (const root of roots) {
		const rel = relativePath(root, uri)?.replace(/\\/g, '/')
		if (rel) candidates.add(rel)
	}

	for (const pattern of normalizedPatterns) {
		const patternWithAnyPrefix = pattern.includes('/') || pattern.startsWith('**/') ? pattern : `**/${pattern}`
		for (const candidate of candidates) {
			if (glob.match(pattern, candidate) || glob.match(patternWithAnyPrefix, candidate)) {
				return true
			}
		}
	}
	return false
}

export const formatGrepOutput = (results: GrepFileResult[], outputMode: GrepOutputMode, truncated: boolean) => {
	let output = ''
	if (outputMode === 'files_with_matches') {
		output = results.map(result => result.uri.fsPath).join('\n')
	} else if (outputMode === 'count') {
		output = results.map(result => `${result.uri.fsPath}:${result.matchCount}`).join('\n')
	} else {
		output = results.map(result => {
			const lines = result.lines ?? []
			if (lines.length === 0) return result.uri.fsPath
			return [
				result.uri.fsPath,
				...lines.map(line => `${line.lineNumber}${line.isMatch ? ':' : '-'}${line.text}`)
			].join('\n')
		}).join('\n\n')
	}

	if (!output) {
		if (truncated) {
			return 'Results truncated; narrow the search or use offset/head_limit to page through more results.'
		}
		return 'No matches found.'
	}
	if (truncated) output += '\n\nResults truncated; narrow the search or use offset/head_limit to page through more results.'
	return output
}

export const validateGrepToolParams = (params: RawToolParamsObj): BuiltinToolCallParams['Grep'] => {
	const pattern = validateStr('pattern', params.pattern)
	if (!pattern) {
		throw new Error('Invalid LLM output format: pattern must be a non-empty string.')
	}

	const path = validateOptionalURI(params.path)
	const glob = validateOptionalStr('glob', params.glob)
	const outputMode = validateGrepOutputMode(params.output_mode)
	// Ripgrep: when -C is set, -B and -A are ignored.
	const context = validateNonNegativeInteger('-C', params['-C'], { default: null })
	let beforeContext: number
	let afterContext: number
	if (context !== null) {
		beforeContext = context
		afterContext = context
	} else {
		beforeContext = validateNonNegativeInteger('-B', params['-B'], { default: 0 }) ?? 0
		afterContext = validateNonNegativeInteger('-A', params['-A'], { default: 0 }) ?? 0
	}
	const caseInsensitive = validateBoolean(params['-i'], { default: false })
	const type = validateOptionalStr('type', params.type)?.trim().toLowerCase() ?? null
	if (type && !grepTypeGlobMap[type]) {
		throw new Error(`Unsupported Grep type "${type}". Supported common types: ${Object.keys(grepTypeGlobMap).sort().join(', ')}.`)
	}

	const headLimit = validateNonNegativeInteger('head_limit', params.head_limit, { default: null })
	const offset = validateNonNegativeInteger('offset', params.offset, { default: 0 }) ?? 0
	const multiline = validateBoolean(params.multiline, { default: false })

	return { pattern, path, glob, outputMode, beforeContext, afterContext, caseInsensitive, type, headLimit, offset, multiline }
}
