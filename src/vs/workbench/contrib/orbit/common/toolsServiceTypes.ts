import { URI } from '../../../../base/common/uri.js'
import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { RawMCPToolCall } from './mcpServiceTypes.js';
import { builtinTools } from './prompt/prompts.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';



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

export type GrepOutputMode = 'content' | 'files_with_matches' | 'count'

export type GrepContentLine = {
	lineNumber: number;
	text: string;
	isMatch: boolean;
}

export type GrepFileResult = {
	uri: URI;
	matchCount: number;
	lines?: GrepContentLine[];
}

export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'browser_automation' | 'MCP tools' }> = {
	'StrReplace': 'edits',
	'Write': 'edits',
	'Shell': 'terminal',
	'AwaitShell': 'terminal',
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


// Plan todo item with unique ID for tracking (for create_plan tool only)
export interface PlanTodoItem {
	id: string;
	content: string;
}

// Import TodoWriteItem from chatThreadServiceTypes for TodoWrite patches
import type { AskQuestionItem, AskQuestionResult, TodoWriteItem } from './chatThreadServiceTypes.js';


// PARAMS OF TOOL CALL
export type BuiltinToolCallParams = {
	'Read': { uri: URI, offset: number, limit: number },
	'Glob': { globPattern: string, targetDirectory: URI | null },
	'Grep': { pattern: string, path: URI | null, glob: string | null, outputMode: GrepOutputMode, beforeContext: number, afterContext: number, caseInsensitive: boolean, type: string | null, headLimit: number | null, offset: number, multiline: boolean },
	'read_lint_errors': { uri: URI },
	// ---
	'StrReplace': { path: URI, oldString: string, newString: string, replaceAll: boolean },
	'Write': { path: URI, contents: string },
	// ---
	'Shell': {
		command: string;
		workingDirectory: string | null;
		blockUntilMs: number;
		description: string | null;
		notifyOnOutput: { pattern: string; debounceMs: number; reason: string } | null;
		requestSmartModeApproval: boolean;
		shellId: string;
	},
	'AwaitShell': {
		shellId: string | null;
		blockUntilMs: number;
		pattern: string | null;
	},
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
	'TodoWrite': { todos: TodoWriteItem[], merge: boolean },
	'AskQuestion': {
		title: string | null;
		questions: AskQuestionItem[];
	},
	// --- plan tools
	'create_plan': { name: string | null, overview: string, plan: string, todos: PlanTodoItem[] },
	'read_plan': {},
	'update_plan_section': { sectionName: string, content: string },
	'add_plan_todo': { todoText: string, category: string | null },
	'mark_plan_item_complete': { itemIndex: number },
	// --- sub-agent delegation
	'task': { subagent_type: string, description: string, prompt: string, model?: string, run_in_background?: boolean, internalToolId?: string, internalThreadId?: string },
}

// RESULT OF TOOL CALL
export type BuiltinToolResultType = {
	'Read': { kind: 'text'; fileContents: string; totalNumLines: number; firstLineNumber: number }
	| { kind: 'image'; mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; base64: string; sizeBytes: number }
	| { kind: 'pdf'; textContent: string; totalPages: number },
	'Glob': { uris: URI[], hasNextPage: boolean, totalMatches: number, mtimeSortTruncated: boolean },
	'Grep': { output: string, results: GrepFileResult[], totalMatchCount: number, shownMatchCount: number, totalFileCount: number, shownFileCount: number, truncated: boolean, outputMode: GrepOutputMode },
	'read_lint_errors': { lintErrors: LintErrorItem[] | null },
	// ---
	'StrReplace': Promise<{ lintErrors: LintErrorItem[] | null }>,
	'Write': Promise<{ lintErrors: LintErrorItem[] | null }>,
	// ---
	'Shell': {
		kind: 'done' | 'timeout' | 'backgrounded';
		result?: string;
		exitCode?: number;
		shellId: string;
		durationMs?: number;
		elapsedMs?: number;
		pid?: number;
	},
	'AwaitShell': {
		kind: 'done' | 'timeout' | 'notfound';
		result?: string;
		exitCode?: number;
		runningForMs: number;
		matchedPattern?: boolean;
		error?: string;
	},
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
	'TodoWrite': { success: boolean, todosCount: number, mergeMode: boolean },
	'AskQuestion': AskQuestionResult,
	// --- plan tools
	'create_plan': { planPath: string, planName: string },
	'read_plan': { planContent: string, planPath: string, exists: boolean },
	'update_plan_section': { success: boolean, updatedSection: string },
	'add_plan_todo': { success: boolean, todoCount: number },
	'mark_plan_item_complete': { success: boolean, completedItem: string },
	// --- sub-agent delegation
	'task': { output: string, agentType: string, durationMs: number, toolUseCount: number, status: 'completed' | 'background_launched' | 'failed' | 'cancelled' },
}


export type ToolCallParams<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolCallParams[T] : RawToolParamsObj
export type ToolResult<T extends BuiltinToolName | (string & {})> = T extends BuiltinToolName ? BuiltinToolResultType[T] : RawMCPToolCall

export type BuiltinToolName = keyof BuiltinToolResultType

/** Built-in tools safe for parallel read-only use (includes legacy hidden search tools). */
export const READ_ONLY_BUILTIN_TOOL_NAMES = [
	'Read',
	'Glob',
	'Grep',
	'read_lint_errors',
] as const satisfies readonly BuiltinToolName[]

export type ReadOnlyBuiltinToolName = (typeof READ_ONLY_BUILTIN_TOOL_NAMES)[number]

export type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
export type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
export type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
	readonly onShellNotify: Event<{ shellId: string; matchedText: string; reason: string }>;
	currentShellThreadId: string | null;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

type BuiltinToolParamNameOfTool<T extends BuiltinToolName> = keyof (typeof builtinTools)[T]['params']
export type BuiltinToolParamName = { [T in BuiltinToolName]: BuiltinToolParamNameOfTool<T> }[BuiltinToolName]


export type ToolName = BuiltinToolName | (string & {})
export type ToolParamName<T extends ToolName> = T extends BuiltinToolName ? BuiltinToolParamNameOfTool<T> : string
