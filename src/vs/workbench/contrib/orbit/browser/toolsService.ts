import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { basename, dirname } from '../../../../base/common/resources.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { ICommandService } from '../../../../platform/commands/common/commands.js'
import { IEditorService } from '../../../services/editor/common/editorService.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { ILogService } from '../../../../platform/log/common/log.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { IFileMatch, ISearchService, ITextSearchMatch, resultIsMatch } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, NavigationWaitCondition, AccessibilityNode, IToolsService, ValidateBuiltinParams, CallBuiltinTool, BuiltinToolResultToString, GrepContentLine, GrepFileResult } from '../common/toolsServiceTypes.js'
import { TodoWriteItem } from '../common/chatThreadServiceTypes.js'
import { IVoidModelService } from '../common/orbitModelService.js'
import { IVoidCommandBarService } from './orbitCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_FILE_CHARS_PAGE, MIN_NOTIFY_DEBOUNCE_MS } from '../common/prompt/prompts.js'
import { extractPdfText } from '../common/pdfTextExtract.js'
import {
	fileExtensionFromUri,
	formatNumberedFileLines,
	imageMimeFromExtension,
	READ_IMAGE_EXTENSIONS,
	sliceFileLines,
	validateReadToolParams,
} from '../common/readFileToolHelpers.js'
import { generatePlanFileName, updatePlanSection, addTodoToChecklist, markTodoComplete, isValidSectionName, PlanSection, createAtomicPlanContent, TodoItem as PlanTodoItem } from '../common/planTemplate.js'
import { encodeBase64, VSBuffer } from '../../../../base/common/buffer.js'
import { IVoidSettingsService } from '../common/orbitSettingsService.js'
import {
	validateAwaitShellParams,
	validateShellParams,
	stringOfAwaitShellResult,
	stringOfShellResult,
	buildShellCommandWithCwd,
} from '../common/shellToolHelpers.js'
import { Emitter } from '../../../../base/common/event.js'
import { IDisposable } from '../../../../base/common/lifecycle.js'
import { IMetricsService } from '../common/metricsService.js'
import type { IAutomationResult } from '../../../../platform/browserAutomation/common/browserAutomation.js'
import { ISubAgentService } from './subAgentService.js'
import { getSubAgent, listSubAgents } from '../common/subAgentRegistry.js'
import {
	finalizeGlobSearchResults,
	GLOB_MTIME_SORT_CAP,
	normalizeGlobPattern,
} from '../common/globToolHelpers.js'
import {
	formatGrepOutput,
	getEffectiveGrepHeadLimit,
	grepTypeGlobMap,
	GREP_MAX_SEARCH_RESULTS,
	normalizeGrepGlob,
	uriMatchesAnyGrepGlob,
	validateGrepToolParams,
} from '../common/grepToolHelpers.js'
import { validateTodoWriteItems } from '../common/todoToolHelpers.js'

const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const pathToURI = (pathUnknown: unknown) => {
	const uriStr = pathUnknown
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateURI = pathToURI

const assertPathIsFile = async (path: URI, toolName: string, fileService: IFileService) => {
	const stat = await fileService.stat(path)
	if (stat.isDirectory) {
		throw new Error(`${toolName}: path is a directory, not a file: ${path.fsPath}`)
	}
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
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

const countGrepMatches = (fileMatch: IFileMatch) => {
	return fileMatch.results?.filter(resultIsMatch).length ?? 0
}

// removed legacy validateProposedTerminalId

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

const MAX_BROWSER_TIMEOUT_MS = 60_000 // 1 minute max (optimized for speed)
const MAX_BROWSER_TYPE_DELAY_MS = 5_000

type BrowserNavigationOptions = { timeout?: number; waitUntil?: NavigationWaitCondition }
type BrowserWaitForSelectorOptions = { visible?: boolean; hidden?: boolean; timeout?: number }
type BrowserTypeOptions = { delay?: number }
type BrowserScreenshotOptions = { fullPage?: boolean }

const validateTimeout = (timeoutUnknown: unknown, defaultTimeout: number) => {
	const safeDefault = Number.isFinite(defaultTimeout) ? Math.max(0, Math.min(MAX_BROWSER_TIMEOUT_MS, Math.floor(defaultTimeout))) : 30_000
	if (isFalsy(timeoutUnknown)) return safeDefault

	const timeout = typeof timeoutUnknown === 'number' ? timeoutUnknown : Number.parseInt(timeoutUnknown + '', 10)
	if (!Number.isFinite(timeout) || !Number.isInteger(timeout)) {
		throw new Error(`Invalid LLM output format: timeout must be an integer number of milliseconds. Full value: ${JSON.stringify(timeoutUnknown)}.`)
	}
	if (timeout < 0 || timeout > MAX_BROWSER_TIMEOUT_MS) {
		throw new Error(`Invalid timeout: ${timeout}. Must be between 0 and ${MAX_BROWSER_TIMEOUT_MS} ms.`)
	}
	return timeout
}

const validateWaitUntil = (waitUntilUnknown: unknown, opts: { default: NavigationWaitCondition }) => {
	if (isFalsy(waitUntilUnknown)) return opts.default

	const waitUntilStr = validateStr('wait_until', waitUntilUnknown).trim().toLowerCase()
	if (waitUntilStr === 'load') return 'load'
	if (waitUntilStr === 'domcontentloaded') return 'domcontentloaded'
	if (waitUntilStr === 'networkidle0') return 'networkidle0'
	if (waitUntilStr === 'networkidle2') return 'networkidle2'

	throw new Error(`Invalid wait_until: "${waitUntilStr}". Must be one of: load, domcontentloaded, networkidle0, networkidle2.`)
}

const validateSelector = (selectorUnknown: unknown) => {
	const selector = validateStr('selector', selectorUnknown).trim()
	if (!selector) {
		throw new Error(`Invalid LLM output format: selector must be a non-empty string.`)
	}
	if (selector.length > 500) {
		throw new Error(`Selector too long (${selector.length} chars). Keep it under 500 characters. Simplify your selector or use a more specific target element.`)
	}
	return selector
}

const validateTypeDelayMs = (delayUnknown: unknown, opts: { default: number }) => {
	if (isFalsy(delayUnknown)) return opts.default
	const delayMs = typeof delayUnknown === 'number' ? delayUnknown : Number.parseInt(delayUnknown + '', 10)
	if (!Number.isFinite(delayMs) || !Number.isInteger(delayMs)) {
		throw new Error(`Invalid LLM output format: delay_ms must be an integer number of milliseconds. Full value: ${JSON.stringify(delayUnknown)}.`)
	}
	if (delayMs < 0 || delayMs > MAX_BROWSER_TYPE_DELAY_MS) {
		throw new Error(`Invalid delay_ms: ${delayMs}. Must be between 0 and ${MAX_BROWSER_TYPE_DELAY_MS} ms. For instant fill without delay, use browser_fill instead.`)
	}
	return delayMs
}

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	private readonly _onShellNotify = new Emitter<{ shellId: string; matchedText: string; reason: string }>();
	public readonly onShellNotify = this._onShellNotify.event;

	/** Set by chatThreadService before Shell callTool so shells can be tied to a thread. */
	public currentShellThreadId: string | null = null;

	// Mutex to serialize mutating/terminal tool calls
	private _mutatingToolInProgress: boolean = false;
	private _currentMutatingTool: string | null = null;

	// Plan mode state
	private _activePlanPath: string | null = null;
	private readonly _planDir = '.void/plans';


	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IMetricsService private readonly _metricsService: IMetricsService,
		@IEditorService private readonly editorService: IEditorService,
		@ISubAgentService private readonly _subAgentService: ISubAgentService,
		@ILogService private readonly logService: ILogService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		this.validateParams = {
			Read: (params: RawToolParamsObj) => {
				return validateReadToolParams(params)
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params
				const uri = validateURI(uriStr)
				return { uri }
			},
			Glob: (params: RawToolParamsObj) => {
				const {
					glob_pattern: globUnknown,
					target_directory: dirUnknown,
				} = params

				const globPattern = validateStr('glob_pattern', globUnknown)
				const targetDirectory = (dirUnknown === undefined || dirUnknown === null)
					? null
					: validateURI(dirUnknown)

				return { globPattern, targetDirectory }
			},
			Grep: validateGrepToolParams,

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			StrReplace: (params: RawToolParamsObj) => {
				const { path: pathUnknown, old_string: oldStringUnknown, new_string: newStringUnknown, replace_all: replaceAllUnknown } = params
				const path = pathToURI(pathUnknown)
				const oldString = validateStr('old_string', oldStringUnknown)
				const newString = validateStr('new_string', newStringUnknown)
				if (oldString.length === 0) {
					throw new Error('StrReplace: old_string must not be empty.')
				}
				if (oldString === newString) {
					throw new Error('StrReplace: old_string and new_string must be different.')
				}
				const replaceAll = validateBoolean(replaceAllUnknown, { default: false })
				return { path, oldString, newString, replaceAll }
			},

			Write: (params: RawToolParamsObj) => {
				const { path: pathUnknown, contents: contentsUnknown } = params
				const path = pathToURI(pathUnknown)
				const contents = validateStr('contents', contentsUnknown)
				return { path, contents }
			},

			// ---

			Shell: (params: RawToolParamsObj) => validateShellParams(params),
			AwaitShell: (params: RawToolParamsObj) => validateAwaitShellParams(params),

			// --- browser automation

			browser_navigate: (params: RawToolParamsObj): BuiltinToolCallParams['browser_navigate'] => {
				const url = validateStr('url', params.url).trim()
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					throw new Error(`URL must start with http:// or https://, got: ${url}`)
				}

				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				const waitUntil = validateWaitUntil(params.wait_until, { default: 'load' })

				return { url, timeout, waitUntil }
			},

			browser_click: (params: RawToolParamsObj): BuiltinToolCallParams['browser_click'] => {
				const selector = validateSelector(params.selector)
				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				return { selector, timeout }
			},

			browser_type: (params: RawToolParamsObj): BuiltinToolCallParams['browser_type'] => {
				const selector = validateSelector(params.selector)
				const text = validateStr('text', params.text)
				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				const delayMs = validateTypeDelayMs(params.delay_ms, { default: 0 })
				return { selector, text, timeout, delayMs }
			},

			browser_fill: (params: RawToolParamsObj): BuiltinToolCallParams['browser_fill'] => {
				const selector = validateSelector(params.selector)
				const value = validateStr('value', params.value)
				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				return { selector, value, timeout }
			},

			browser_screenshot: (params: RawToolParamsObj): BuiltinToolCallParams['browser_screenshot'] => {
				const fullPage = validateBoolean(params.full_page, { default: false })
				return { fullPage }
			},

			browser_get_content: (_params: RawToolParamsObj): BuiltinToolCallParams['browser_get_content'] => {
				return {}
			},

			browser_extract_text: (params: RawToolParamsObj): BuiltinToolCallParams['browser_extract_text'] => {
				const selector = validateSelector(params.selector)
				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				return { selector, timeout }
			},

			browser_evaluate: (params: RawToolParamsObj): BuiltinToolCallParams['browser_evaluate'] => {
				const script = validateStr('script', params.script)
				return { script }
			},

			browser_wait_for_selector: (params: RawToolParamsObj): BuiltinToolCallParams['browser_wait_for_selector'] => {
				const selector = validateSelector(params.selector)
				const defaultTimeout = this.voidSettingsService.state.globalSettings.browserDefaultTimeout
				const timeout = validateTimeout(params.timeout, defaultTimeout)
				const visible = validateBoolean(params.visible, { default: true })
				const hidden = validateBoolean(params.hidden, { default: false })
				if (visible && hidden) {
					throw new Error(`Invalid wait_for_selector options: "visible" and "hidden" cannot both be true.`)
				}
				return { selector, timeout, visible, hidden }
			},

			browser_get_url: (_params: RawToolParamsObj): BuiltinToolCallParams['browser_get_url'] => {
				return {}
			},

			browser_snapshot: (params: RawToolParamsObj): BuiltinToolCallParams['browser_snapshot'] => {
				const interestingOnly = validateBoolean(params.interesting_only, { default: true })

				let maxDepth = validateNumber(params.max_depth, { default: 10 })
				if (maxDepth !== null) {
					if (maxDepth < 1) maxDepth = 1
					if (maxDepth > 10) maxDepth = 10
				} else {
					maxDepth = 10
				}

				return { interestingOnly, maxDepth }
			},

			TodoWrite: (params: RawToolParamsObj): BuiltinToolCallParams['TodoWrite'] => {
				let todos: TodoWriteItem[];
				if (typeof params.todos === 'string') {
					try {
						todos = JSON.parse(params.todos);
					} catch (e) {
						throw new Error(`Invalid todos parameter: must be valid JSON array. ${e}`);
					}
				} else if (Array.isArray(params.todos)) {
					todos = params.todos;
				} else {
					throw new Error('todos must be a JSON array string or array');
				}

				const merge = validateBoolean(params.merge, { default: false });
				const validation = validateTodoWriteItems(todos, { merge });
				if (!validation.valid) {
					throw new Error(validation.error);
				}

				return { todos: validation.todos, merge };
			},

			// --- Plan tools ---

			create_plan: (params: RawToolParamsObj): BuiltinToolCallParams['create_plan'] => {
				const name = validateOptionalStr('name', params.name);
				const overview = validateStr('overview', params.overview);
				const plan = validateStr('plan', params.plan);
				let todos: PlanTodoItem[] = [];

				if (params.todos) {
					if (typeof params.todos === 'string') {
						try {
							todos = JSON.parse(params.todos);
						} catch (e) {
							throw new Error(`Invalid todos parameter: must be valid JSON array. ${e}`);
						}
					} else if (Array.isArray(params.todos)) {
						todos = params.todos;
					}

					// Validate todo structure
					if (!Array.isArray(todos)) {
						throw new Error('Todos must be an array');
					}
					for (const todo of todos) {
						if (!todo.id || typeof todo.id !== 'string') {
							throw new Error('Each todo must have an "id" field (string)');
						}
						if (!todo.content || typeof todo.content !== 'string') {
							throw new Error('Each todo must have a "content" field (string)');
						}
					}
				}

				return { name, overview, plan, todos };
			},

			read_plan: (_params: RawToolParamsObj): BuiltinToolCallParams['read_plan'] => {
				return {};
			},

			update_plan_section: (params: RawToolParamsObj): BuiltinToolCallParams['update_plan_section'] => {
				const sectionName = validateStr('section_name', params.section_name);
				if (!isValidSectionName(sectionName)) {
					throw new Error(`Invalid section name: "${sectionName}". Must be one of: overview, files, steps, checklist, testing, notes`);
				}
				const content = validateStr('content', params.content);
				return { sectionName, content };
			},

			add_plan_todo: (params: RawToolParamsObj): BuiltinToolCallParams['add_plan_todo'] => {
				const todoText = validateStr('todo_text', params.todo_text);
				const category = validateOptionalStr('category', params.category);
				return { todoText, category };
			},

			mark_plan_item_complete: (params: RawToolParamsObj): BuiltinToolCallParams['mark_plan_item_complete'] => {
				const itemIndex = validateNumber(params.item_index, { default: null });
				if (itemIndex === null || itemIndex < 1) {
					throw new Error(`Invalid item_index: "${params.item_index}". Must be a positive integer (1-based).`);
				}
				return { itemIndex };
			},

			task: (params: RawToolParamsObj): BuiltinToolCallParams['task'] => {
				const subagent_type = typeof params.subagent_type === 'string' ? params.subagent_type.trim() : '';
				if (!subagent_type) throw new Error('subagent_type is required');
				if (!getSubAgent(subagent_type)) throw new Error(`Unknown agent type '${subagent_type}'. Available: ${listSubAgents().map(a => a.agentType).join(', ')}`);
				const description = typeof params.description === 'string' ? params.description.trim() : '';
				if (!description) throw new Error('description is required');
				const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
				if (!prompt) throw new Error('prompt is required');
				const model = typeof params.model === 'string' && params.model.trim() ? params.model.trim() : undefined;
				const run_in_background = params.run_in_background === 'true' || String(params.run_in_background) === 'true';
				return { subagent_type, description, prompt, model, run_in_background };
			},

		}


		const browserAutomationHintedError = (toolName: string, rawMessage: string) => {
			const msg = rawMessage.trim()
			const lower = msg.toLowerCase()

			if (lower.includes('no active session') || lower.includes('session not found')) {
				return `${msg} Try starting with browser_navigate first.`
			}

			if (lower.includes('timeout') || lower.includes('timed out')) {
				const hasWaitSelector = lower.includes('wait') && lower.includes('selector')
				const suggestion = hasWaitSelector
					? 'Element may not exist or took too long to appear. Verify selector with browser_get_content first.'
					: 'Page may be slow or content is dynamic. Try: (1) Increase timeout parameter, (2) Use browser_wait_for_selector, or (3) Use faster wait_until like "load" or "domcontentloaded".'
				return `${msg}\n\n${suggestion}`
			}

			if (lower.includes('no node found for selector') || lower.includes('failed to find') || lower.includes('selector')) {
				return `${msg}

Troubleshooting:
1. Use browser_get_content to inspect the current DOM
2. Try more specific selectors (data-testid, aria-label, name)
3. Check if element is inside an iframe (requires different approach)
4. Verify the element loaded (use browser_wait_for_selector first)`
			}

			if (lower.includes('chrome/chromium') && lower.includes('install')) {
				return msg
			}

			return `${toolName} failed: ${msg}`
		}

		const browserAutomationErrorFromThrown = (commandId: string, error: unknown) => {
			const raw = error instanceof Error ? error.message : String(error)
			const lower = raw.toLowerCase()

			if (lower.includes('command') && lower.includes('not found')) {
				return `Browser automation command "${commandId}" is unavailable. Make sure the built-in "simple-browser" extension is enabled.`
			}

			return `Browser automation command "${commandId}" failed: ${raw}`
		}

		const executeBrowserAutomationCommand = async <T>(commandId: string, ...args: unknown[]): Promise<Awaited<T> | undefined> => {
			try {
				return await this.commandService.executeCommand<T>(commandId, ...args)
			} catch (error) {
				throw new Error(browserAutomationErrorFromThrown(commandId, error))
			}
		}

		const executeBrowserAutomationResult = async <T>(toolName: string, commandId: string, ...args: unknown[]): Promise<T> => {
			const result = await executeBrowserAutomationCommand<IAutomationResult<T>>(commandId, ...args)

			if (!result) {
				throw new Error(`Browser automation command "${commandId}" returned no result. Make sure the built-in "simple-browser" extension is enabled.`)
			}
			if (!result.success) {
				throw new Error(browserAutomationHintedError(toolName, result.error || 'Unknown error'))
			}

			return result.data as T
		}

		const ensureBrowserSession = async (toolNameForErr: string) => {
			const urlResult = await executeBrowserAutomationCommand<IAutomationResult<string> | undefined>('simpleBrowser.automation.getUrl', undefined)

			if (urlResult?.success) {
				return
			}

			const errLower = (urlResult?.error ?? '').toLowerCase()
			if (errLower.includes('no active session') || errLower.includes('session not found')) {
				await executeBrowserAutomationResult<string>(toolNameForErr, 'simpleBrowser.automation.createSession', 'about:blank')
				return
			}

			throw new Error(browserAutomationHintedError(toolNameForErr, urlResult?.error || 'Failed to determine browser session state'))
		}

		this.callTool = {
			Read: async ({ uri, offset, limit }) => {
				const ext = fileExtensionFromUri(uri)

				if (READ_IMAGE_EXTENSIONS.has(ext)) {
					const data = await fileService.readFile(uri)
					const mime = imageMimeFromExtension(ext)
					if (!mime) {
						throw new Error(`Unsupported image format: .${ext}`)
					}
					return {
						result: {
							kind: 'image',
							mime,
							base64: encodeBase64(data.value),
							sizeBytes: data.value.byteLength,
						},
					}
				}

				if (ext === 'pdf') {
					const data = await fileService.readFile(uri)
					const { textContent, totalPages } = await extractPdfText(data.value)
					return { result: { kind: 'pdf', textContent, totalPages } }
				}

				const data = await fileService.readFile(uri)
				const raw = data.value.toString()
				if (raw.length === 0) {
					return { result: { kind: 'text', fileContents: '', totalNumLines: 0, firstLineNumber: 1 } }
				}

				const { contentLines, startLineIndex, totalNumLines } = sliceFileLines(raw, offset, limit)
				return {
					result: {
						kind: 'text',
						fileContents: contentLines.join('\n'),
						totalNumLines,
						firstLineNumber: startLineIndex + 1,
					},
				}
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			Glob: async ({ globPattern, targetDirectory }) => {
				const workspaceFolders = workspaceContextService.getWorkspace().folders.map(f => f.uri)
				const searchFolders = targetDirectory ? [targetDirectory] : workspaceFolders

				if (searchFolders.length === 0) {
					throw new Error('Glob requires either a workspace folder or an explicit target_directory.')
				}

				const normalizedPattern = normalizeGlobPattern(globPattern)

				// Push the glob to ripgrep via includePattern so matching happens at the engine level (fast).
				const query = queryBuilder.file(searchFolders, {
					includePattern: normalizedPattern,
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const rawUris = data.results.map(({ resource }) => resource)
				const { uris, totalMatches, hasNextPage, mtimeSortTruncated } = await finalizeGlobSearchResults(fileService, rawUris)

				return { result: { uris, hasNextPage, totalMatches, mtimeSortTruncated } }
			},

			Grep: async ({ pattern, path, glob: globPattern, outputMode, beforeContext, afterContext, caseInsensitive, type, headLimit, offset, multiline }) => {
				const tokenSource = new CancellationTokenSource()
				const resultPromise = (async () => {
					const workspaceFolders = workspaceContextService.getWorkspace().folders.map(f => f.uri)
					let searchFolders = workspaceFolders
					let exactFilePath: string | null = null

					if (path) {
						try {
							const stat = await fileService.stat(path)
							if (stat.isDirectory) {
								searchFolders = [path]
							} else {
								exactFilePath = path.fsPath
								searchFolders = [dirname(path)]
							}
						} catch (statError) {
							throw new Error(`Grep: cannot stat path "${path.fsPath}": ${statError instanceof Error ? statError.message : String(statError)}`)
						}
					}

					if (searchFolders.length === 0) {
						throw new Error('Grep requires either a workspace folder or an explicit path.')
					}

					const typeGlobs = type ? grepTypeGlobMap[type] : null
					const explicitGlobs = globPattern ? [globPattern] : null
					const includePatterns = exactFilePath ? [basename(path!)]
						: explicitGlobs ? explicitGlobs
							: typeGlobs

					const effectiveHeadLimit = getEffectiveGrepHeadLimit(headLimit, outputMode)
					const requestedSearchResults = outputMode === 'content'
						? offset + effectiveHeadLimit + 1
						: GREP_MAX_SEARCH_RESULTS
					const searchMaxResults = Math.max(1, Math.min(requestedSearchResults, GREP_MAX_SEARCH_RESULTS))
					// (?s:...) enables dotall (. matches newline); isMultiline sets ripgrep multiline ^/$ behavior.
					const effectivePattern = multiline ? `(?s:${pattern})` : pattern

					const query = queryBuilder.text({
						pattern: effectivePattern,
						isRegExp: true,
						isCaseSensitive: !caseInsensitive,
						isMultiline: multiline,
					}, searchFolders, {
						includePattern: includePatterns?.length ? includePatterns.map(normalizeGrepGlob).filter(Boolean) : undefined,
						maxResults: searchMaxResults,
					})

					const data = await searchService.textSearch(query, tokenSource.token)

					const allFileMatches = data.results
						.filter(fileMatch => {
							if (exactFilePath && fileMatch.resource.fsPath !== exactFilePath) return false
							if (explicitGlobs && !uriMatchesAnyGrepGlob(fileMatch.resource, searchFolders, explicitGlobs)) return false
							if (typeGlobs && !uriMatchesAnyGrepGlob(fileMatch.resource, searchFolders, typeGlobs)) return false
							return countGrepMatches(fileMatch) > 0
						})
						.map(fileMatch => ({
							uri: fileMatch.resource,
							matches: fileMatch.results?.filter(resultIsMatch) ?? [],
						}))

					const totalMatchCount = allFileMatches.reduce((total, fileMatch) => total + fileMatch.matches.length, 0)
					const totalFileCount = allFileMatches.length

					let shownMatchCount = 0
					let selectedResults: GrepFileResult[] = []

					if (outputMode === 'content') {
						let matchesToSkip = offset
						let matchesRemaining = effectiveHeadLimit
						const fileMatchJobs: { uri: URI; matchCount: number; selectedMatches: ITextSearchMatch[] }[] = []

						for (const fileMatch of allFileMatches) {
							if (matchesRemaining <= 0) break
							const selectedMatches: ITextSearchMatch[] = []
							for (const match of fileMatch.matches) {
								if (matchesToSkip > 0) {
									matchesToSkip--
									continue
								}
								if (matchesRemaining <= 0) break
								selectedMatches.push(match)
								matchesRemaining--
							}
							if (selectedMatches.length === 0) continue
							fileMatchJobs.push({ uri: fileMatch.uri, matchCount: fileMatch.matches.length, selectedMatches })
						}

						const contentResults = await Promise.all(fileMatchJobs.map(async ({ uri, matchCount, selectedMatches }) => {
							try {
								await voidModelService.initializeModel(uri)
							} catch (modelInitErr) {
								this.logService.warn(`[Grep] Failed to initialize model for ${uri.fsPath}: ${modelInitErr instanceof Error ? modelInitErr.message : String(modelInitErr)}`)
								return null
							}
							const { model } = await voidModelService.getModelSafe(uri)
							if (!model) {
								this.logService.warn(`[Grep] Model unavailable for ${uri.fsPath}`)
								return null
							}

							const linesByNumber = new Map<number, GrepContentLine>()
							for (const match of selectedMatches) {
								const ranges = match.rangeLocations.map(rl => rl.source).filter(Boolean)
								if (ranges.length === 0) continue
								const matchStartLine = Math.min(...ranges.map(r => r.startLineNumber))
								const matchEndLine = Math.max(...ranges.map(r => r.endLineNumber))
								const startLine = Math.max(1, matchStartLine - beforeContext)
								const endLine = Math.min(model.getLineCount(), matchEndLine + afterContext)
								for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
									const existing = linesByNumber.get(lineNumber)
									const isMatch = lineNumber >= matchStartLine && lineNumber <= matchEndLine
									if (existing) {
										existing.isMatch = existing.isMatch || isMatch
										continue
									}
									linesByNumber.set(lineNumber, {
										lineNumber,
										text: model.getLineContent(lineNumber),
										isMatch,
									})
								}
							}

							const lines = [...linesByNumber.values()].sort((a, b) => a.lineNumber - b.lineNumber)
							return { uri, matchCount, lines, selectedMatchCount: selectedMatches.length }
						}))

						for (const fileResult of contentResults) {
							if (!fileResult) continue
							shownMatchCount += fileResult.selectedMatchCount
							selectedResults.push({ uri: fileResult.uri, matchCount: fileResult.matchCount, lines: fileResult.lines })
						}
					} else {
						const selectedFileMatches = allFileMatches.slice(offset, offset + effectiveHeadLimit)
						shownMatchCount = selectedFileMatches.reduce((total, fileMatch) => total + fileMatch.matches.length, 0)
						selectedResults = selectedFileMatches.map(fileMatch => ({
							uri: fileMatch.uri,
							matchCount: fileMatch.matches.length,
						}))
					}

					const truncatedBySearch = !!data.limitHit
					const truncatedByWindow = outputMode === 'content'
						? totalMatchCount > offset + shownMatchCount
						: allFileMatches.length > offset + selectedResults.length
					const truncated = truncatedBySearch || truncatedByWindow
					const output = formatGrepOutput(selectedResults, outputMode, truncated)

					return {
						output,
						results: selectedResults,
						totalMatchCount,
						shownMatchCount,
						totalFileCount,
						shownFileCount: selectedResults.length,
						truncated,
						outputMode,
					}
				})()

				return {
					result: resultPromise,
					interruptTool: () => tokenSource.cancel(),
				}
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			StrReplace: async ({ path, oldString, newString, replaceAll }) => {
				this._acquireMutatingLock('StrReplace');
				try {
					if (!(await fileService.exists(path))) {
						throw new Error(`StrReplace: file not found: ${path.fsPath}`)
					}
					await assertPathIsFile(path, 'StrReplace', fileService)
					await voidModelService.initializeModel(path)
					const { model } = await voidModelService.getModelSafe(path)
					if (!model) {
						throw new Error(`Could not open file: ${path.fsPath}`)
					}
					if (this.commandBarService.getStreamState(path) === 'streaming') {
						throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
					}
					await editCodeService.callBeforeApplyOrEdit(path)
					editCodeService.instantlyApplyStrReplace({ uri: path, oldString, newString, replaceAll })

					const lintErrorsPromise = Promise.resolve().then(async () => {
						await timeout(2000)
						const { lintErrors } = this._getLintErrors(path)
						this._releaseMutatingLock();
						return { lintErrors }
					})

					return { result: lintErrorsPromise }
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},

			Write: async ({ path, contents }) => {
				this._acquireMutatingLock('Write');
				try {
					const exists = await fileService.exists(path)
					if (!exists) {
						try {
							await fileService.createFile(path, VSBuffer.fromString(''))
						} catch (e) {
							const msg = e instanceof Error ? e.message : String(e)
							if (msg.includes('ENOENT') || msg.toLowerCase().includes('no such file')) {
								throw new Error(`Write: parent directory does not exist for ${path.fsPath}. Create it first (e.g. Shell with mkdir -p) before using Write.`)
							}
							throw e
						}
					}

					await assertPathIsFile(path, 'Write', fileService)
					await voidModelService.initializeModel(path)
					if (this.commandBarService.getStreamState(path) === 'streaming') {
						throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
					}
					await editCodeService.callBeforeApplyOrEdit(path)
					editCodeService.instantlyWriteFile({ uri: path, contents })

					const lintErrorsPromise = Promise.resolve().then(async () => {
						await timeout(2000)
						const { lintErrors } = this._getLintErrors(path)
						this._releaseMutatingLock();
						return { lintErrors }
					})
					return { result: lintErrorsPromise }
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},
			// ---
			Shell: async (params) => {
				this._acquireMutatingLock('Shell');
				try {
					const threadId = this.currentShellThreadId;
					if (!threadId) {
						throw new Error('Shell requires an active chat thread.');
					}

					const { shellId, pid } = await this.terminalToolService.getOrCreateShellForThread({
						threadId,
						proposedShellId: params.shellId,
						workingDirectory: params.workingDirectory,
					});

					const shell = this.terminalToolService.getShell(shellId);
					const { command, workingDirectory } = buildShellCommandWithCwd(
						params.command,
						params.workingDirectory,
						shell?.workingDirectory ?? null,
					);

					const notifyDisposables: IDisposable[] = [];
					if (params.notifyOnOutput) {
						const d = this.terminalToolService.addNotifyWatcher(shellId, {
							pattern: params.notifyOnOutput.pattern,
							debounceMs: Math.max(MIN_NOTIFY_DEBOUNCE_MS, params.notifyOnOutput.debounceMs),
							reason: params.notifyOnOutput.reason,
							onMatch: (matchedText) => {
								this._onShellNotify.fire({ shellId, matchedText, reason: params.notifyOnOutput!.reason });
							},
						});
						notifyDisposables.push(d);
					}

					const startedAt = Date.now();
					const interrupt = () => { this.terminalToolService.interruptShell(shellId); };

					if (params.blockUntilMs === 0) {
						const resPromise = this.terminalToolService.runShell(shellId, command, { blockUntilMs: 0, workingDirectory })
							.then(() => {
								this._releaseMutatingLock();
							})
							.catch((error) => {
								this._releaseMutatingLock();
								throw error;
							});
						void resPromise;
						return {
							result: { kind: 'backgrounded' as const, shellId, pid: pid ?? undefined },
							interruptTool: interrupt,
						};
					}

					const resPromise = this.terminalToolService.runShell(shellId, command, { blockUntilMs: params.blockUntilMs, workingDirectory })
						.then((runRes) => {
							notifyDisposables.forEach(d => d.dispose());
							const durationMs = Date.now() - startedAt;
							this._releaseMutatingLock();
							if (runRes.kind === 'done') {
								return {
									kind: 'done' as const,
									result: runRes.result,
									exitCode: runRes.exitCode ?? 0,
									shellId,
									durationMs,
								};
							}
							if (runRes.kind === 'backgrounded') {
								return {
									kind: 'backgrounded' as const,
									shellId,
									pid: runRes.pid ?? pid ?? undefined,
									durationMs,
								};
							}
							return {
								kind: 'timeout' as const,
								result: runRes.result ?? '',
								shellId,
								durationMs,
								elapsedMs: params.blockUntilMs,
							};
						})
						.catch((error) => {
							this._releaseMutatingLock();
							throw error;
						});

					return { result: resPromise, interruptTool: interrupt };
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},
			AwaitShell: async (params) => {
				this._acquireMutatingLock('AwaitShell');
				try {
					if (params.shellId && !this.terminalToolService.shellExists(params.shellId)) {
						this._releaseMutatingLock();
						return { result: { kind: 'notfound' as const, error: `Shell with id "${params.shellId}" does not exist.`, runningForMs: 0 } };
					}

					const resPromise = this.terminalToolService.awaitShell(params.shellId, {
						blockUntilMs: params.blockUntilMs,
						pattern: params.pattern,
					}).then((awaitRes) => {
						this._releaseMutatingLock();
						return awaitRes;
					}).catch((error) => {
						this._releaseMutatingLock();
						throw error;
					});

					return { result: resPromise };
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},

			// --- browser automation

			browser_navigate: async ({ url, timeout, waitUntil }) => {
				this._acquireMutatingLock('browser_navigate')
				try {
					await ensureBrowserSession('browser_navigate')

					const options: BrowserNavigationOptions = { timeout, waitUntil }
					const navigatedUrl = await executeBrowserAutomationResult<string>('browser_navigate', 'simpleBrowser.automation.navigate', undefined, url, options)
					return { result: { url: navigatedUrl || url } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_click: async ({ selector, timeout }) => {
				this._acquireMutatingLock('browser_click')
				try {
					await ensureBrowserSession('browser_click')

					const waitOptions: BrowserWaitForSelectorOptions = { timeout, visible: true }
					await executeBrowserAutomationResult<void>('browser_click', 'simpleBrowser.automation.waitForSelector', undefined, selector, waitOptions)
					await executeBrowserAutomationResult<void>('browser_click', 'simpleBrowser.automation.click', undefined, selector)
					return { result: { selector } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_type: async ({ selector, text, timeout, delayMs }) => {
				this._acquireMutatingLock('browser_type')
				try {
					await ensureBrowserSession('browser_type')

					const waitOptions: BrowserWaitForSelectorOptions = { timeout, visible: true }
					await executeBrowserAutomationResult<void>('browser_type', 'simpleBrowser.automation.waitForSelector', undefined, selector, waitOptions)

					const typeOptions: BrowserTypeOptions | undefined = delayMs > 0 ? { delay: delayMs } : undefined
					await executeBrowserAutomationResult<void>('browser_type', 'simpleBrowser.automation.type', undefined, selector, text, typeOptions)
					return { result: { selector, textLength: text.length } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_fill: async ({ selector, value, timeout }) => {
				this._acquireMutatingLock('browser_fill')
				try {
					await ensureBrowserSession('browser_fill')

					const waitOptions: BrowserWaitForSelectorOptions = { timeout, visible: true }
					await executeBrowserAutomationResult<void>('browser_fill', 'simpleBrowser.automation.waitForSelector', undefined, selector, waitOptions)
					await executeBrowserAutomationResult<void>('browser_fill', 'simpleBrowser.automation.fill', undefined, selector, value)
					return { result: { selector } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_screenshot: async ({ fullPage }) => {
				this._acquireMutatingLock('browser_screenshot')
				try {
					await ensureBrowserSession('browser_screenshot')

					const options: BrowserScreenshotOptions | undefined = fullPage ? { fullPage } : undefined
					const base64 = await executeBrowserAutomationResult<string>('browser_screenshot', 'simpleBrowser.automation.screenshot', undefined, options)
					return { result: { base64: base64 || '' } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_get_content: async (_params: BuiltinToolCallParams['browser_get_content']) => {
				this._acquireMutatingLock('browser_get_content')
				try {
					await ensureBrowserSession('browser_get_content')

					const title = await executeBrowserAutomationResult<string>('browser_get_content', 'simpleBrowser.automation.getTitle', undefined)
					const html = await executeBrowserAutomationResult<string>('browser_get_content', 'simpleBrowser.automation.getContent', undefined)
					return { result: { title: title || '', html: html || '' } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_extract_text: async ({ selector, timeout }) => {
				this._acquireMutatingLock('browser_extract_text')
				try {
					await ensureBrowserSession('browser_extract_text')

					const waitOptions: BrowserWaitForSelectorOptions = { timeout, visible: true }
					await executeBrowserAutomationResult<void>('browser_extract_text', 'simpleBrowser.automation.waitForSelector', undefined, selector, waitOptions)

					const text = await executeBrowserAutomationResult<string>('browser_extract_text', 'simpleBrowser.automation.extractText', undefined, selector)
					return { result: { selector, text: text || '' } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_evaluate: async ({ script }) => {
				this._acquireMutatingLock('browser_evaluate')
				try {
					await ensureBrowserSession('browser_evaluate')

					const result = await executeBrowserAutomationResult<unknown>('browser_evaluate', 'simpleBrowser.automation.evaluate', undefined, script)
					return { result: { result } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_wait_for_selector: async ({ selector, timeout, visible, hidden }) => {
				this._acquireMutatingLock('browser_wait_for_selector')
				try {
					await ensureBrowserSession('browser_wait_for_selector')

					const options: BrowserWaitForSelectorOptions = { timeout, visible, hidden }
					await executeBrowserAutomationResult<void>('browser_wait_for_selector', 'simpleBrowser.automation.waitForSelector', undefined, selector, options)
					return { result: { selector } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_get_url: async (_params: BuiltinToolCallParams['browser_get_url']) => {
				this._acquireMutatingLock('browser_get_url')
				try {
					await ensureBrowserSession('browser_get_url')

					const url = await executeBrowserAutomationResult<string>('browser_get_url', 'simpleBrowser.automation.getUrl', undefined)
					return { result: { url: url || '' } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			browser_snapshot: async ({ interestingOnly, maxDepth }) => {
				this._acquireMutatingLock('browser_snapshot')
				try {
					await ensureBrowserSession('browser_snapshot')

					const options = { interestingOnly }
					const snapshotResult = await executeBrowserAutomationResult<any>(
						'browser_snapshot',
						'simpleBrowser.automation.snapshot',
						undefined,
						options
					)

					if (!snapshotResult) {
						return { result: { snapshot: null, truncated: false, nodeCount: 0 } }
					}

					// Post-process: add selectors and truncate depth
					let nodeCount = 0
					const processedSnapshot = this._processAccessibilityTree(
						snapshotResult,
						maxDepth,
						(node) => { nodeCount++ }
					)

					// Check if output too large (>50KB JSON)
					const jsonStr = JSON.stringify(processedSnapshot)
					const truncated = jsonStr.length > 50_000

					return { result: { snapshot: processedSnapshot, truncated, nodeCount } }
				} finally {
					this._releaseMutatingLock()
				}
			},

			TodoWrite: async (params: BuiltinToolCallParams['TodoWrite']) => {
				const { todos, merge } = params;

				this._metricsService.capture('TodoWrite', {
					todosCount: todos.length,
					completedCount: todos.filter(t => t.status === 'completed').length,
					isMerge: merge,
				});

				// The actual merge logic is handled in chatThreadService
				// This tool just validates and returns success
				const result = {
					success: true,
					todosCount: todos.length,
					mergeMode: merge
				};

				return { result };
			},

			// --- Plan tools ---

			create_plan: async (params: BuiltinToolCallParams['create_plan']) => {
				const { name, overview, plan, todos } = params;

				// Get workspace folders
				const folders = workspaceContextService.getWorkspace().folders;
				if (folders.length === 0) {
					throw new Error('No workspace folder open. Please open a folder to create a plan.');
				}

				const workspaceRoot = folders[0].uri;

				// Ensure .void/plans directory exists
				const plansDirUri = URI.joinPath(workspaceRoot, this._planDir);
				try {
					await fileService.createFolder(plansDirUri);
				} catch {
					// Folder might already exist, which is fine
				}

				// Generate filename with effective name
				const effectiveName = name || 'Implementation Plan';
				const fileName = generatePlanFileName(effectiveName);
				const planUri = URI.joinPath(plansDirUri, fileName);

				// Use atomic plan content generator (Cursor AI style)
				const planContent = createAtomicPlanContent({
					name: effectiveName,
					overview,
					plan,
					todos,
					metadata: {
						title: effectiveName,
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						status: 'planning',
						model: this.voidSettingsService.state.modelSelectionOfFeature.Chat?.modelName,
					},
				});

				// Write the plan file
				await fileService.writeFile(planUri, VSBuffer.fromString(planContent));

				// Set as active plan
				this._activePlanPath = planUri.fsPath;

				// Open the plan file directly in custom editor (preview mode, not split view)
				await this.editorService.openEditor({
					resource: planUri,
					options: {
						override: 'workbench.editor.voidPlanEditor',  // Force our custom plan editor
						preserveFocus: false,
						pinned: true
					}
				});

				// Capture metrics
				this._metricsService.capture('Create Plan', {
					planName: effectiveName,
					todosCount: todos.length,
				});

				return {
					result: {
						planPath: planUri.fsPath,
						planName: effectiveName,
					}
				};
			},

			read_plan: async (_params: BuiltinToolCallParams['read_plan']) => {
				if (!this._activePlanPath) {
					return {
						result: {
							planContent: 'No active plan. Use create_plan to create a new implementation plan.',
							planPath: '',
							exists: false,
						}
					};
				}

				const planUri = URI.file(this._activePlanPath);

				try {
					const content = await fileService.readFile(planUri);
					const planContent = content.value.toString();

					return {
						result: {
							planContent,
							planPath: this._activePlanPath,
							exists: true,
						}
					};
				} catch {
					// File might have been deleted
					this._activePlanPath = null;
					return {
						result: {
							planContent: 'Active plan file no longer exists. Use create_plan to create a new plan.',
							planPath: '',
							exists: false,
						}
					};
				}
			},

			update_plan_section: async (params: BuiltinToolCallParams['update_plan_section']) => {
				const { sectionName, content } = params;

				if (!this._activePlanPath) {
					throw new Error('No active plan. Use create_plan first to create a plan.');
				}

				const planUri = URI.file(this._activePlanPath);

				// Read current content
				const fileContent = await fileService.readFile(planUri);
				const currentContent = fileContent.value.toString();

				// Update the section
				const updatedContent = updatePlanSection(currentContent, sectionName as PlanSection, content);

				// Write back
				await fileService.writeFile(planUri, VSBuffer.fromString(updatedContent));

				// Capture metrics
				this._metricsService.capture('Update Plan Section', {
					sectionName,
					contentLength: content.length,
				});

				return {
					result: {
						success: true,
						updatedSection: sectionName,
					}
				};
			},

			add_plan_todo: async (params: BuiltinToolCallParams['add_plan_todo']) => {
				const { todoText, category } = params;

				if (!this._activePlanPath) {
					throw new Error('No active plan. Use create_plan first to create a plan.');
				}

				const planUri = URI.file(this._activePlanPath);

				// Read current content
				const fileContent = await fileService.readFile(planUri);
				const currentContent = fileContent.value.toString();

				// Add the todo item
				const result = addTodoToChecklist(currentContent, todoText, category ?? undefined);

				// Write back
				await fileService.writeFile(planUri, VSBuffer.fromString(result.content));

				// Capture metrics
				this._metricsService.capture('Add Plan Todo', {
					hasCategory: !!category,
					todoCount: result.todoCount,
				});

				return {
					result: {
						success: true,
						todoCount: result.todoCount,
					}
				};
			},

			mark_plan_item_complete: async (params: BuiltinToolCallParams['mark_plan_item_complete']) => {
				const { itemIndex } = params;

				if (!this._activePlanPath) {
					throw new Error('No active plan. Use create_plan first to create a plan.');
				}

				const planUri = URI.file(this._activePlanPath);

				// Read current content
				const fileContent = await fileService.readFile(planUri);
				const currentContent = fileContent.value.toString();

				// Mark the item complete
				const result = markTodoComplete(currentContent, itemIndex);

				// Write back
				await fileService.writeFile(planUri, VSBuffer.fromString(result.content));

				// Capture metrics
				this._metricsService.capture('Mark Plan Item Complete', {
					itemIndex,
					completedItem: result.completedItem,
				});

				return {
					result: {
						success: true,
						completedItem: result.completedItem,
					}
				};
			},

			task: async ({ subagent_type, description, prompt, model, run_in_background, internalToolId, internalThreadId }: BuiltinToolCallParams['task']) => {
				const agent = getSubAgent(subagent_type)!;
				const toolId = internalToolId ?? this._subAgentService.pendingToolId;
				const threadId = internalThreadId ?? this._subAgentService.pendingThreadId;
				if (!toolId || !threadId) {
					throw new Error('Internal error: task tool is missing chat thread context.');
				}
				const abortRef: { current: (() => void) | null } = { current: null };
				const result = this._subAgentService.runSubAgent({ agent, prompt, description, toolId, threadId, modelOverride: model, runInBackground: run_in_background, abortRef });
				return {
					result,
					interruptTool: () => abortRef.current?.(),
				};
			},
		}


		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE)
		}

		const MAX_BROWSER_RESULT_CHARS_FOR_LLM = 5_000

		const truncateForLLM = (s: string, maxChars: number = MAX_BROWSER_RESULT_CHARS_FOR_LLM) => {
			if (s.length <= maxChars) return s
			return s.substring(0, maxChars) + '\n\n... (truncated)'
		}

		const formatEvalResultForLLM = (value: unknown) => {
			if (value === null) return 'null'
			if (value === undefined) return 'undefined'
			if (typeof value === 'string') return value
			if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)

			try {
				const json = JSON.stringify(value, null, 2)
				return json === undefined ? String(value) : json
			} catch {
				return '[Unserializable result]'
			}
		}

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			Read: (params, result) => {
				if (result.kind === 'image') {
					return `[Image: ${params.uri.fsPath} (${result.mime}, ${(result.sizeBytes / 1024).toFixed(1)} KB)]`
				}
				if (result.kind === 'pdf') {
					const numbered = formatNumberedFileLines(result.textContent.split('\n'), 1)
					const pageNote = result.totalPages > 0 ? ` (${result.totalPages} page${result.totalPages !== 1 ? 's' : ''})` : ''
					return `${params.uri.fsPath}${pageNote}\n\`\`\`\n${numbered}\n\`\`\``
				}
				if (result.totalNumLines === 0 && result.fileContents === '') {
					return 'File is empty.'
				}
				const lines = result.fileContents.split('\n')
				const numbered = formatNumberedFileLines(lines, result.firstLineNumber)
				let out = `${params.uri.fsPath}\n\`\`\`\n${numbered}\n\`\`\``
				const returnedLines = lines.length
				if (returnedLines > 0 && result.firstLineNumber + returnedLines - 1 < result.totalNumLines) {
					out += `\n[Showing lines ${result.firstLineNumber}-${result.firstLineNumber + returnedLines - 1} of ${result.totalNumLines}. Use offset to read more.]`
				}
				return out
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			Glob: (_params, result) => {
				const paths = result.uris.map(uri => uri.fsPath).join('\n')
				const notes: string[] = []
				if (result.hasNextPage) {
					notes.push(`[Showing first ${result.uris.length} of ${result.totalMatches} matches. Refine your glob_pattern (e.g. add a directory prefix) to narrow the results.]`)
				}
				if (result.mtimeSortTruncated) {
					notes.push(`[Found ${result.totalMatches} matches; mtime sorting applied to the first ${GLOB_MTIME_SORT_CAP}. Narrow your glob_pattern for faster, complete results.]`)
				}
				if (notes.length === 0) {
					return paths
				}
				return paths ? `${paths}\n\n${notes.join('\n')}` : notes.join('\n')
			},
		Grep: (_params, result) => {
			return result.output
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			StrReplace: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.path.fsPath}.${lintErrsString}`
			},
			Write: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Successfully wrote ${params.path.fsPath}.${lintErrsString}`
			},
			Shell: stringOfShellResult,
			AwaitShell: stringOfAwaitShellResult,

			// --- browser automation
			browser_navigate: (_params, result) => {
				return `Successfully navigated to ${result.url}`
			},
			browser_click: (params, _result) => {
				return `Clicked "${params.selector}".`
			},
			browser_type: (params, result) => {
				const delayStr = params.delayMs > 0 ? ` (delay ${params.delayMs}ms)` : ''
				return `Typed ${result.textLength} characters into "${params.selector}"${delayStr}.`
			},
			browser_fill: (params, _result) => {
				return `Filled "${params.selector}".`
			},
			browser_screenshot: (params, result) => {
				const kind = params.fullPage ? 'full page' : 'viewport'
				const sizeKB = (result.base64.length / 1024).toFixed(1)
				return `Screenshot captured (${kind}). Base64 size: ~${sizeKB} KB.`
			},
			browser_get_content: (_params, result) => {
				const truncatedHtml = truncateForLLM(result.html)
				return `Page Title: ${result.title}\n\nHTML Content:\n\`\`\`html\n${truncatedHtml}\n\`\`\``
			},
			browser_extract_text: (params, result) => {
				const truncatedText = truncateForLLM(result.text)
				return `Extracted text from "${params.selector}":\n\`\`\`\n${truncatedText}\n\`\`\``
			},
			browser_evaluate: (_params, result) => {
				const formatted = formatEvalResultForLLM(result.result)
				const truncated = truncateForLLM(formatted)
				return `JavaScript result:\n\`\`\`\n${truncated}\n\`\`\``
			},
			browser_wait_for_selector: (params, result) => {
				const condition = params.visible ? ' (visible)' : params.hidden ? ' (hidden)' : ''
				return `Selector "${result.selector}" found${condition}.`
			},
			browser_get_url: (_params, result) => {
				return `Current page URL: ${result.url}`
			},

			browser_snapshot: (_params, result) => {
				if (!result.snapshot) {
					return 'Page has no accessibility tree (empty page or all content is inaccessible).'
				}

				// Format as structured text for LLM
				const lines: string[] = []
				lines.push(`Accessibility Snapshot (${result.nodeCount} nodes${result.truncated ? ', truncated' : ''}):`)
				lines.push('')

				const formatNode = (node: AccessibilityNode, indent: number = 0): void => {
					const prefix = '  '.repeat(indent)

					let line = `${prefix}- ${node.role}`
					if (node.name) line += `: "${node.name}"`
					if (node.value) line += ` (value: "${node.value}")`

					// Add state indicators
					const states: string[] = []
					if (node.focused) states.push('focused')
					if (node.disabled) states.push('disabled')
					if (node.checked === true) states.push('checked')
					if (node.checked === 'mixed') states.push('partially-checked')
					if (node.expanded === true) states.push('expanded')
					if (node.expanded === false) states.push('collapsed')

					if (states.length > 0) {
						line += ` [${states.join(', ')}]`
					}

					lines.push(line)

					// Add selector
					if (node.selector && !node.selector.includes('/*')) {
						lines.push(`${prefix}  selector: ${node.selector}`)
					}

					// Add description
					if (node.description) {
						lines.push(`${prefix}  description: "${node.description}"`)
					}

					// Process children
					if (node.children && node.children.length > 0) {
						node.children.forEach(child => formatNode(child, indent + 1))
					}
				}

				formatNode(result.snapshot)

				const output = lines.join('\n')

				// Safety truncation
				const MAX_LLM_OUTPUT = 15_000
				if (output.length > MAX_LLM_OUTPUT) {
					return output.substring(0, MAX_LLM_OUTPUT) + '\n\n... (output truncated, use smaller max_depth)'
				}

				return output
			},

			TodoWrite: (params, result) => {
				const mergeStr = result.mergeMode ? ' (merged)' : ' (replaced)';
				return `Successfully updated TODO list with ${result.todosCount} items${mergeStr}.`;
			},

			// --- Plan tools ---

			create_plan: (params, result) => {
				return `Plan "${result.planName}" created successfully at ${result.planPath}.\nThe plan file is now open in the editor. To modify the plan, you can edit the file directly using StrReplace.`;
			},

			read_plan: (params, result) => {
				if (!result.exists) {
					return result.planContent;
				}
				return `Plan file at ${result.planPath}:\n\n${result.planContent}`;
			},

			update_plan_section: (params, result) => {
				return `Successfully updated the "${result.updatedSection}" section of the plan.`;
			},

			add_plan_todo: (params, result) => {
				return `Successfully added TODO item. The plan now has ${result.todoCount} checklist item(s).`;
			},

			mark_plan_item_complete: (params, result) => {
				return `Successfully marked item as complete: "${result.completedItem}"`;
			},

			task: (_params, result) => {
				if (result.status === 'background_launched') {
					return result.output;
				}
				if (result.status === 'failed' || result.status === 'cancelled') {
					const meta = `[Agent: ${result.agentType} | Status: ${result.status} | Tools used: ${result.toolUseCount} | Duration: ${result.durationMs < 1000 ? `${result.durationMs}ms` : `${(result.durationMs / 1000).toFixed(1)}s`}]`;
					return `${result.output}\n\n${meta}`;
				}
				const meta = `[Agent: ${result.agentType} | Tools used: ${result.toolUseCount} | Duration: ${result.durationMs < 1000 ? `${result.durationMs}ms` : `${(result.durationMs / 1000).toFixed(1)}s`}]`;
				return `${result.output}\n\n${meta}`;
			},
		}



	}


	private _acquireMutatingLock(toolName: string): void {
		if (this._mutatingToolInProgress) {
			throw new Error(`Cannot run ${toolName} while another mutating/terminal tool (${this._currentMutatingTool}) is in progress. Mutating and terminal tools must run sequentially and alone. Please wait for the current operation to complete.`);
		}
		this._mutatingToolInProgress = true;
		this._currentMutatingTool = toolName;
	}

	private _releaseMutatingLock(): void {
		this._mutatingToolInProgress = false;
		this._currentMutatingTool = null;
	}

	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}

	/**
	 * Process accessibility tree: add selectors, truncate depth, count nodes
	 */
	private _processAccessibilityTree(
		node: any,
		maxDepth: number,
		onNode?: (node: any) => void,
		currentDepth: number = 0,
		ancestorSelectors: string[] = []
	): AccessibilityNode | null {
		if (!node || currentDepth > maxDepth) {
			return null
		}

		if (onNode) onNode(node)

		const processed: AccessibilityNode = {
			role: node.role || 'unknown',
		}

		// Add optional properties
		if (node.name) processed.name = node.name
		if (node.value) processed.value = node.value
		if (node.description) processed.description = node.description
		if (node.focused) processed.focused = node.focused
		if (node.disabled) processed.disabled = node.disabled
		if (node.checked !== undefined) processed.checked = node.checked
		if (node.expanded !== undefined) processed.expanded = node.expanded
		if (node.level !== undefined) processed.level = node.level

		// Generate CSS selector
		processed.selector = this._generateSelectorForNode(node, ancestorSelectors)

		// Process children recursively
		if (node.children && node.children.length > 0 && currentDepth < maxDepth) {
			const childSelectors = processed.selector ? [...ancestorSelectors, processed.selector] : ancestorSelectors
			processed.children = node.children
				.map((child: any) => this._processAccessibilityTree(child, maxDepth, onNode, currentDepth + 1, childSelectors))
				.filter((child: AccessibilityNode | null) => child !== null) as AccessibilityNode[]

			if (processed.children.length === 0) {
				delete processed.children
			}
		}

		return processed
	}

	/**
	 * Generate CSS selector for accessibility node
	 */
	private _generateSelectorForNode(node: any, ancestorSelectors: string[]): string {
		const roleToElement: Record<string, string> = {
			'button': 'button',
			'link': 'a',
			'textbox': 'input[type="text"], input:not([type]), textarea',
			'searchbox': 'input[type="search"]',
			'combobox': 'select',
			'checkbox': 'input[type="checkbox"]',
			'radio': 'input[type="radio"]',
			'heading': 'h1, h2, h3, h4, h5, h6',
			'img': 'img',
			'list': 'ul, ol',
			'listitem': 'li',
			'navigation': 'nav',
			'main': 'main',
			'form': 'form',
		}

		const element = roleToElement[node.role] || '*'
		const parts: string[] = [element]

		// Add ARIA role if not matching element
		if (node.role && !roleToElement[node.role]) {
			parts[0] = `[role="${node.role}"]`
		}

		// Add name-based selectors
		if (node.name && node.name.length > 0 && node.name.length < 100) {
			const nameParts: string[] = [`[aria-label="${node.name}"]`]
			parts.push(`:is(${nameParts.join(', ')})`)
		}

		let selector = parts.join('')

		// Add name as hint
		if (node.name) {
			selector = `${selector} /* "${node.name.substring(0, 30)}${node.name.length > 30 ? '...' : ''}" */`
		}

		return selector
	}



}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
