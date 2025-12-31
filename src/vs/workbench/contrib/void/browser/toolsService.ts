import { CancellationToken } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { ICommandService } from '../../../../platform/commands/common/commands.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName, NavigationWaitCondition, AccessibilityNode } from '../common/toolsServiceTypes.js'
import { parseMarkdownChecklist, validateTodoItems } from '../common/chatThreadServiceTypes.js'
import { IVoidModelService } from '../common/voidModelService.js'
import { EndOfLinePreference } from '../../../../editor/common/model.js'
import { IVoidCommandBarService } from './voidCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../common/prompt/prompts.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { IMetricsService } from '../common/metricsService.js'
import type { IAutomationResult } from '../../../../platform/browserAutomation/common/browserAutomation.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const validateURI = (uriStr: unknown) => {
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

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
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

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`)
	const terminalId = terminalIdUnknown + ''
	return terminalId
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


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
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

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	// Mutex to serialize mutating/terminal tool calls
	private _mutatingToolInProgress: boolean = false;
	private _currentMutatingTool: string | null = null;


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
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })

				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, startLine, endLine, pageNumber }
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
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params

				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)

				return { query: queryStr, includePattern, pageNumber }

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = validateOptionalURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return {
					query: queryStr,
					isRegex,
					searchInFolder,
					pageNumber
				}
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params
				const uri = validateURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isFolder }
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = validateURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = validateURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				return { uri, newContent }
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = validateURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				// No parameters needed; will open a new background terminal
				return { cwd };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

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

			update_todo_list: (params: RawToolParamsObj): BuiltinToolCallParams['update_todo_list'] => {
				const todos = validateStr('todos', params.todos);
				return { todos };
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
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) { throw new Error(`No contents; File does not exist.`) }

				let contents: string
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF)
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}

				const totalNumLines = model.getLineCount()

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1) // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				const totalFileLen = contents.length
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { uris, hasNextPage } }
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder]

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders)

				const data = await searchService.textSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { queryStr, uris, hasNextPage } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				this._acquireMutatingLock('create_file_or_folder');
				try {
					if (isFolder)
						await fileService.createFolder(uri)
					else {
						await fileService.createFile(uri)
					}
					return { result: {} }
				} finally {
					this._releaseMutatingLock();
				}
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				this._acquireMutatingLock('delete_file_or_folder');
				try {
					await fileService.del(uri, { recursive: isRecursive })
					return { result: {} }
				} finally {
					this._releaseMutatingLock();
				}
			},

			rewrite_file: async ({ uri, newContent }) => {
				this._acquireMutatingLock('rewrite_file');
				try {
					await voidModelService.initializeModel(uri)
					if (this.commandBarService.getStreamState(uri) === 'streaming') {
						throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
					}
					await editCodeService.callBeforeApplyOrEdit(uri)
					editCodeService.instantlyRewriteFile({ uri, newContent })
					// at end, get lint errors
					const lintErrorsPromise = Promise.resolve().then(async () => {
						await timeout(2000)
						const { lintErrors } = this._getLintErrors(uri)
						this._releaseMutatingLock();
						return { lintErrors }
					})
					return { result: lintErrorsPromise }
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				this._acquireMutatingLock('edit_file');
				try {
					await voidModelService.initializeModel(uri)
					if (this.commandBarService.getStreamState(uri) === 'streaming') {
						throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
					}
					await editCodeService.callBeforeApplyOrEdit(uri)
					editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })

					// at end, get lint errors
					const lintErrorsPromise = Promise.resolve().then(async () => {
						await timeout(2000)
						const { lintErrors } = this._getLintErrors(uri)
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
			run_command: async ({ command, cwd, terminalId }) => {
				this._acquireMutatingLock('run_command');
				try {
					const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
					// Wrap the result promise to release lock after completion
					const wrappedPromise = resPromise.then((result) => {
						this._releaseMutatingLock();
						return result;
					}).catch((error) => {
						this._releaseMutatingLock();
						throw error;
					});
					return { result: wrappedPromise, interruptTool: interrupt }
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				this._acquireMutatingLock('run_persistent_command');
				try {
					const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
					// Wrap the result promise to release lock after completion
					const wrappedPromise = resPromise.then((result) => {
						this._releaseMutatingLock();
						return result;
					}).catch((error) => {
						this._releaseMutatingLock();
						throw error;
					});
					return { result: wrappedPromise, interruptTool: interrupt }
				} catch (error) {
					this._releaseMutatingLock();
					throw error;
				}
			},
			open_persistent_terminal: async ({ cwd }) => {
				this._acquireMutatingLock('open_persistent_terminal');
				try {
					const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
					return { result: { persistentTerminalId } }
				} finally {
					this._releaseMutatingLock();
				}
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				this._acquireMutatingLock('kill_persistent_terminal');
				try {
					// Close the background terminal by sending exit
					await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
					return { result: {} }
				} finally {
					this._releaseMutatingLock();
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

			update_todo_list: async (params: BuiltinToolCallParams['update_todo_list']) => {
				// 1. Input validation
				if (!params.todos || params.todos.trim() === '') {
					throw new Error('TODO list cannot be empty');
				}
				if (params.todos.length > 10000) {
					throw new Error('TODO list too long (max 10,000 chars)');
				}

				// 2. Parse markdown checklist using shared utility
				const todoItems = parseMarkdownChecklist(params.todos);

				// 3. Count validation
				if (todoItems.length === 0) {
					throw new Error('No valid TODO items found. Use format: [ ], [x], or [-]');
				}
				if (todoItems.length > 20) {
					throw new Error('Too many items (max 20). Break into smaller tasks.');
				}

				// 4. Content length validation
				for (const [i, item] of todoItems.entries()) {
					if (item.content.length > 500) {
						throw new Error(`Item ${i + 1} too long (max 500 chars)`);
					}
				}

				// 5. Structure validation
				const validation = validateTodoItems(todoItems);
				if (!validation.valid) {
					throw new Error(validation.error || 'Invalid TODO items');
				}

				// Capture metrics
				this._metricsService.capture('Update TODO List', {
					todosCount: todoItems.length,
					completedCount: todoItems.filter(t => t.status === 'completed').length,
				});

				// Store in current thread (handled by chatThreadService)
				const result = {
					success: true,
					todosCount: todoItems.length
				};

				return { result };
			},
		}


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : ''

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
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			create_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully created.`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},

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

			update_todo_list: (params, result) => {
				return `Successfully updated TODO list with ${result.todosCount} items.`;
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
