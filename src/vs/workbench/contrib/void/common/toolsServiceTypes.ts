import { URI } from '../../../../base/common/uri.js'
import { RawMCPToolCall } from './mcpServiceTypes.js';
import { builtinTools } from './prompt/prompts.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';



export type TerminalResolveReason = { type: 'timeout' } | { type: 'done', exitCode: number }

export type LintErrorItem = { code: string, message: string, startLineNumber: number, endLineNumber: number }

export type NavigationWaitCondition = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'

export type AccessibilityNode = {
	role: string;
	name?: string;
	value?: string;
	description?: string;
	selector?: string;
	focused?: boolean;
	disabled?: boolean;
	checked?: boolean | 'mixed';
	expanded?: boolean;
	level?: number;
	children?: AccessibilityNode[];
}

// Partial of IFileStat
export type ShallowDirectoryItem = {
	uri: URI;
	name: string;
	isDirectory: boolean;
	isSymbolicLink: boolean;
}


export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'browser_automation' | 'MCP tools' }> = {
	'create_file_or_folder': 'edits',
	'delete_file_or_folder': 'edits',
	'rewrite_file': 'edits',
	'edit_file': 'edits',
	'run_command': 'terminal',
	'run_persistent_command': 'terminal',
	'open_persistent_terminal': 'terminal',
	'kill_persistent_terminal': 'terminal',
	'browser_navigate': 'browser_automation',
	'browser_click': 'browser_automation',
	'browser_type': 'browser_automation',
	'browser_fill': 'browser_automation',
	'browser_screenshot': 'browser_automation',
	'browser_get_content': 'browser_automation',
	'browser_extract_text': 'browser_automation',
	'browser_evaluate': 'browser_automation',
	'browser_wait_for_selector': 'browser_automation',
	'browser_get_url': 'browser_automation',
	'browser_snapshot': 'browser_automation',
}


export type ToolApprovalType = NonNullable<(typeof approvalTypeOfBuiltinToolName)[keyof typeof approvalTypeOfBuiltinToolName]>;


export const toolApprovalTypes = new Set<ToolApprovalType>([
	...Object.values(approvalTypeOfBuiltinToolName),
	'MCP tools',
])




// PARAMS OF TOOL CALL
export type BuiltinToolCallParams = {
	'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
	'ls_dir': { uri: URI, pageNumber: number },
	'get_dir_tree': { uri: URI },
	'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
	'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
	'search_in_file': { uri: URI, query: string, isRegex: boolean },
	'read_lint_errors': { uri: URI },
	// ---
	'rewrite_file': { uri: URI, newContent: string },
	'edit_file': { uri: URI, searchReplaceBlocks: string },
	'create_file_or_folder': { uri: URI, isFolder: boolean },
	'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
	// ---
	'run_command': { command: string; cwd: string | null, terminalId: string },
	'open_persistent_terminal': { cwd: string | null },
	'run_persistent_command': { command: string; persistentTerminalId: string },
	'kill_persistent_terminal': { persistentTerminalId: string },
	// ---
	'browser_navigate': { url: string, timeout: number, waitUntil: NavigationWaitCondition },
	'browser_click': { selector: string, timeout: number },
	'browser_type': { selector: string, text: string, timeout: number, delayMs: number },
	'browser_fill': { selector: string, value: string, timeout: number },
	'browser_screenshot': { fullPage: boolean },
	'browser_get_content': {},
	'browser_extract_text': { selector: string, timeout: number },
	'browser_evaluate': { script: string },
	'browser_wait_for_selector': { selector: string, timeout: number, visible: boolean, hidden: boolean },
	'browser_get_url': {},
	'browser_snapshot': { interestingOnly: boolean, maxDepth: number },
	// ---
	'update_todo_list': { todos: string },
}

// RESULT OF TOOL CALL
export type BuiltinToolResultType = {
	'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
	'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
	'get_dir_tree': { str: string, },
	'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
	'search_for_files': { uris: URI[], hasNextPage: boolean },
	'search_in_file': { lines: number[]; },
	'read_lint_errors': { lintErrors: LintErrorItem[] | null },
	// ---
	'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'create_file_or_folder': {},
	'delete_file_or_folder': {},
	// ---
	'run_command': { result: string; resolveReason: TerminalResolveReason; },
	'run_persistent_command': { result: string; resolveReason: TerminalResolveReason; },
	'open_persistent_terminal': { persistentTerminalId: string },
	'kill_persistent_terminal': {},
	// ---
	'browser_navigate': { url: string },
	'browser_click': { selector: string },
	'browser_type': { selector: string, textLength: number },
	'browser_fill': { selector: string },
	'browser_screenshot': { base64: string },
	'browser_get_content': { title: string, html: string },
	'browser_extract_text': { selector: string, text: string },
	'browser_evaluate': { result: unknown },
	'browser_wait_for_selector': { selector: string },
	'browser_get_url': { url: string },
	'browser_snapshot': { snapshot: AccessibilityNode | null, truncated: boolean, nodeCount: number },
	// ---
	'update_todo_list': { success: boolean, todosCount: number },
}


export type ToolCallParams<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolCallParams[T] : RawToolParamsObj
export type ToolResult<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolResultType[T] : RawMCPToolCall

export type BuiltinToolName = keyof BuiltinToolResultType

type BuiltinToolParamNameOfTool<T extends BuiltinToolName> = keyof (typeof builtinTools)[T]['params']
export type BuiltinToolParamName = { [T in BuiltinToolName]: BuiltinToolParamNameOfTool<T> }[BuiltinToolName]


export type ToolName = BuiltinToolName | (string & {})
export type ToolParamName<T extends ToolName> = T extends BuiltinToolName ? BuiltinToolParamNameOfTool<T> : string
