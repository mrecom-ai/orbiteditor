/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { URI } from '../../../../../../../../base/common/uri.js';
import { BuiltinToolName } from '../../../../../common/toolsServiceTypes.js';
import { GREP_DEFAULT_CONTENT_HEAD_LIMIT, GREP_DEFAULT_FILE_HEAD_LIMIT } from '../../../../../common/grepToolHelpers.js';
import { useAccessor } from '../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from './toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../components/toolHeaders/ToolHeaderWrapper.js';
import { loadingTitleWrapper } from './toolTitles.js';
import { ToolChildrenWrapper } from '../components/toolWrappers/ToolChildrenWrapper.js';
import { CodeChildren } from '../components/toolWrappers/CodeChildren.js';
import { ListableToolItem } from '../components/toolWrappers/ListableToolItem.js';
import { SmallProseWrapper } from '../components/wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../markdown/ChatMarkdownRender.js';
import { voidOpenFileFn, getRelative, getBasename } from '../utils/fileUtils.js';
import { EditTool } from '../components/editTool/EditTool.js';
import { ShellToolCard } from '../components/toolResults/ShellToolCard.js';
import { BrowserToolBar } from '../../browser-tools-tsx/index.js';
import { PlanDetailsContent } from '../components/toolResults/PlanDetailsContent.js';
import { LintErrorChildren } from '../components/toolResults/LintErrorChildren.js';
import { ResultWrapper } from '../types/toolWrapperTypes.js';
import { TodoToolWithState } from '../components/toolResults/TodoTool.js';
import { computeTodoListBeforeMessage } from '../components/toolResults/todo/todoState.js';

/** Maps legacy tool names from older chat threads to current builtin tool renderers. */
export const LEGACY_TOOL_NAME_MAP: Record<string, BuiltinToolName> = {
	'edit_file': 'StrReplace',
	'rewrite_file': 'Write',
	'create_file_or_folder': 'Write',
}

export const resolveBuiltinToolComponentName = (toolName: string): BuiltinToolName | undefined => {
	if (toolName in LEGACY_TOOL_NAME_MAP) {
		return LEGACY_TOOL_NAME_MAP[toolName]
	}
	return toolName as BuiltinToolName
}

export const builtinToolNameToComponent: { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T>, } } = {
	'Read': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()

			const title = getTitle(toolMessage)

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams);
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { params } = toolMessage
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			let range: [number, number] | undefined = undefined

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				if (result.kind === 'image') {
					componentParams.desc2 = `${(result.sizeBytes / 1024).toFixed(1)} KB`
					componentParams.children = <ToolChildrenWrapper>
						<img
							src={`data:${result.mime};base64,${result.base64}`}
							alt={getBasename(params.uri.fsPath)}
							className='max-h-48 max-w-full rounded object-contain bg-void-bg-3'
						/>
					</ToolChildrenWrapper>
				} else if (result.kind === 'pdf') {
					componentParams.desc2 = result.totalPages > 0 ? `${result.totalPages} page${result.totalPages !== 1 ? 's' : ''}` : 'PDF'
					const preview = result.textContent.slice(0, 2000)
					componentParams.children = <ToolChildrenWrapper allowTextSelection>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={`\`\`\`\n${preview}${result.textContent.length > preview.length ? '\n…' : ''}\n\`\`\``}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ToolChildrenWrapper>
				} else {
					const returnedLines = result.fileContents ? result.fileContents.split('\n').length : 0
					if (returnedLines > 0) {
						const endLine = result.firstLineNumber + returnedLines - 1
						range = [result.firstLineNumber, endLine]
						if (endLine < result.totalNumLines) {
							componentParams.desc2 = `lines ${result.firstLineNumber}-${endLine} of ${result.totalNumLines}`
						} else if (result.firstLineNumber > 1) {
							componentParams.desc1 += ` (${result.firstLineNumber}-${endLine})`
						}
					}
				}
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor, range) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'get_dir_tree': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.children = <ToolChildrenWrapper>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={`\`\`\`\n${result.str}\n\`\`\``}
							chatMessageLocation={undefined}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// Show loading state - no additional children needed, icon already shows spinner
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />

		}
	},
	'ls_dir': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const explorerService = accessor.get('IExplorerService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.numResults = result.children?.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = !result.children || (result.children.length ?? 0) === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.children.map((child, i) => (<ListableToolItem key={i}
							name={`${child.name}${child.isDirectory ? '/' : ''}`}
							className='w-full overflow-auto'
							onClick={() => {
								voidOpenFileFn(child.uri, accessor)
								// commandService.executeCommand('workbench.view.explorer'); // open in explorer folders view instead
								// explorerService.select(child.uri, true);
							}}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={`Results truncated (${result.itemsRemaining} remaining).`} isSmall={true} className='w-full overflow-auto' />
						}
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// Show loading state - no additional children needed, icon already shows spinner
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'Glob': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (params.includePattern) {
				componentParams.info = `Only search in ${params.includePattern}`
			}

			if (toolMessage.type === 'success') {
				const { result, rawParams } = toolMessage
				componentParams.numResults = result.uris.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = result.uris.length === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.uris.map((uri, i) => (<ListableToolItem key={i}
							name={getBasename(uri.fsPath)}
							className='w-full overflow-auto'
							onClick={() => { voidOpenFileFn(uri, accessor) }}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={'Results truncated.'} isSmall={true} className='w-full overflow-auto' />
						}

					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// Show loading state - no additional children needed, icon already shows spinner
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'Grep': {
		resultWrapper: ({ toolMessage, threadId }) => {
			const accessor = useAccessor()
			const chatThreadsService = accessor.get('IChatThreadService')
			const title = getTitle(toolMessage)
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (toolMessage.type === 'success') {
				const { result, params } = toolMessage
				const fileResults = result.results
				const pageSize = params.headLimit && params.headLimit > 0
					? params.headLimit
					: (result.outputMode === 'content' ? GREP_DEFAULT_CONTENT_HEAD_LIMIT : GREP_DEFAULT_FILE_HEAD_LIMIT)
				const numResults = result.outputMode === 'content'
					? result.shownMatchCount
					: result.outputMode === 'count'
						? fileResults.reduce((sum, fileResult) => sum + fileResult.matchCount, 0)
						: fileResults.length
				componentParams.numResults = numResults
				componentParams.hasNextPage = result.truncated
				if (result.outputMode === 'files_with_matches') {
					componentParams.info = `${result.totalFileCount}${result.truncated ? '+' : ''} file${result.totalFileCount !== 1 ? 's' : ''}`
				} else {
					componentParams.info = `${result.totalMatchCount}${result.truncated ? '+' : ''} match${result.totalMatchCount !== 1 ? 'es' : ''}`
				}

				if (fileResults.length === 0) {
					componentParams.children = undefined
				} else if (result.outputMode === 'content') {
					componentParams.children = <ToolChildrenWrapper allowTextSelection>
						{fileResults.map((fileResult, i) => (
							<CodeChildren key={i} className='bg-void-bg-3 my-1'>
								<div className='px-1 text-[11px] text-void-fg-3 opacity-70'>
									{getRelative(fileResult.uri, accessor)} · {fileResult.matchCount} match{fileResult.matchCount !== 1 ? 'es' : ''}
								</div>
								<pre className='font-mono whitespace-pre text-[11px]'>
									{(fileResult.lines ?? []).map((line, j) => (
										<div key={j} className={line.isMatch ? 'text-void-fg-1 bg-void-warning/10' : 'text-void-fg-3 opacity-60'}>
											<span
												className='inline-block w-12 text-right pr-2 opacity-50 hover:opacity-100 hover:underline cursor-pointer'
												onClick={() => { voidOpenFileFn(fileResult.uri, accessor, [line.lineNumber, line.lineNumber]) }}
											>{line.lineNumber}</span>
											<span className='mr-1'>{line.isMatch ? ':' : '-'}</span>
											<span>{line.text || '\u00a0'}</span>
										</div>
									))}
								</pre>
							</CodeChildren>
						))}
						{result.truncated && (
							<>
								<div className='px-2 py-1 mt-1 text-[11px] text-void-warning/80 bg-void-bg-2-alt/40 rounded flex items-center gap-1'>
									<AlertTriangle size={11} />
									Showing {result.shownMatchCount} of {result.totalMatchCount}+ matches. Refine your search pattern or use offset/head_limit.
								</div>
								<ListableToolItem
									name={`Show next ${pageSize} matches`}
									className='w-full overflow-auto mt-1'
									onClick={() => { void chatThreadsService.loadMoreGrepResults(threadId, params) }}
								/>
							</>
						)}
					</ToolChildrenWrapper>
				} else if (result.outputMode === 'count') {
					componentParams.children = <ToolChildrenWrapper>
						{fileResults.map((fileResult, i) => (
							<ListableToolItem key={i}
								name={<>
									{getBasename(fileResult.uri.fsPath)}
									<span className='ml-1.5 text-[11px] text-void-fg-3 opacity-60'>{fileResult.matchCount}</span>
								</>}
								className='w-full overflow-auto'
								onClick={() => { voidOpenFileFn(fileResult.uri, accessor) }}
							/>
						))}
						{result.truncated && (
							<>
								<div className='px-2 py-1 mt-1 text-[11px] text-void-warning/80 bg-void-bg-2-alt/40 rounded flex items-center gap-1'>
									<AlertTriangle size={11} />
									Showing {result.shownFileCount} of {result.totalFileCount}+ files ({result.totalMatchCount}+ matches).
								</div>
								<ListableToolItem
									name={`Show next ${pageSize} files`}
									className='w-full overflow-auto mt-1'
									onClick={() => { void chatThreadsService.loadMoreGrepResults(threadId, params) }}
								/>
							</>
						)}
					</ToolChildrenWrapper>
				} else {
					componentParams.children = <ToolChildrenWrapper>
						{fileResults.map((fileResult, i) => (
							<ListableToolItem key={i}
								name={getBasename(fileResult.uri.fsPath)}
								className='w-full overflow-auto'
								onClick={() => { voidOpenFileFn(fileResult.uri, accessor) }}
							/>
						))}
						{result.truncated && (
							<>
								<div className='px-2 py-1 mt-1 text-[11px] text-void-warning/80 bg-void-bg-2-alt/40 rounded flex items-center gap-1'>
									<AlertTriangle size={11} />
									Showing {result.shownFileCount} of {result.totalFileCount}+ files.
								</div>
								<ListableToolItem
									name={`Show next ${pageSize} files`}
									className='w-full overflow-auto mt-1'
									onClick={() => { void chatThreadsService.loadMoreGrepResults(threadId, params) }}
								/>
							</>
						)}
					</ToolChildrenWrapper>
				}
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},

	'read_lint_errors': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)

			const { uri } = toolMessage.params ?? {}
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			componentParams.info = getRelative(uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
				if (result.lintErrors)
					componentParams.children = <LintErrorChildren lintErrors={result.lintErrors} />
				else
					componentParams.children = `No lint errors found.`

			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// Show loading state - no additional children needed, icon already shows spinner
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},

	// ---

	'StrReplace': {
		resultWrapper: (params) => {
			return <EditTool {...params} toolMessage={params.toolMessage as any} />
		}
	},
	'Write': {
		resultWrapper: (params) => {
			return <EditTool {...params} toolMessage={params.toolMessage as any} />
		}
	},

	// ---

	'Shell': {
		resultWrapper: (params) => {
			return <ShellToolCard threadId={params.threadId} toolMessage={params.toolMessage as Exclude<typeof params.toolMessage, { type: 'invalid_params' }>} />
		}
	},

	'AwaitShell': {
		resultWrapper: (params) => {
			return <ShellToolCard threadId={params.threadId} toolMessage={params.toolMessage as Exclude<typeof params.toolMessage, { type: 'invalid_params' }>} />
		}
	},

	// --- browser automation (redesigned with compact horizontal bar layout)
	'browser_navigate': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="navigation" />;
		}
	},
	'browser_get_url': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="navigation" />;
		}
	},
	'browser_snapshot': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="capture" />;
		}
	},
	'browser_click': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="interaction" />;
		}
	},
	'browser_type': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="interaction" />;
		}
	},
	'browser_fill': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="interaction" />;
		}
	},
	'browser_wait_for_selector': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="interaction" />;
		}
	},
	'browser_screenshot': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="capture" />;
		}
	},
	'browser_get_content': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="capture" />;
		}
	},
	'browser_extract_text': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="capture" />;
		}
	},
	'browser_evaluate': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null;
			return <BrowserToolBar toolMessage={toolMessage} variant="evaluation" />;
		}
	},

	// ========================================
	// ========================================

	'TodoWrite': {
		resultWrapper: ({ toolMessage, threadId, messageIdx }) => {
			if (toolMessage.type === 'tool_request') return null // do not show past requests

			// Handle error and rejected states
			if (toolMessage.type === 'tool_error' || toolMessage.type === 'rejected') {
				const accessor = useAccessor()
				const title = getTitle(toolMessage)
				const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
				const statusIconMeta = getToolStatusIconMeta(toolMessage)

				const componentParams: ToolHeaderParams = {
					title,
					desc1: toolMessage.type === 'tool_error' ? String(toolMessage.result) : desc1,
					desc1Info,
					isError: toolMessage.type === 'tool_error',
					isRejected: toolMessage.type === 'rejected',
					icon: statusIconMeta?.icon,
					iconTooltip: statusIconMeta?.tooltip,
				}

				return <ToolHeaderWrapper {...componentParams} />
			}

			// For running_now and success, render the TodoToolWithState
			const todos = toolMessage.params?.todos || []
			const merge = toolMessage.params?.merge ?? false
			const isStreaming = toolMessage.type === 'running_now'
			const accessor = useAccessor()
			const messages = accessor.get('IChatThreadService').getCurrentThread().messages
			const previousTodosAtMessage = computeTodoListBeforeMessage(messages, messageIdx)

			return (
				<TodoToolWithState
					todos={todos}
					threadId={threadId}
					toolCallId={toolMessage.id}
					isStreaming={isStreaming}
					previousTodosAtMessage={previousTodosAtMessage}
					merge={merge}
				/>
			)
		},
	},

	// --- Plan Mode Tools ---
	'create_plan': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const isRunning = toolMessage.type === 'running_now'
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const planName = toolMessage.params?.name || 'Implementation Plan'
			const overview = toolMessage.params?.overview || ''
			const planPath = toolMessage.type === 'success' && toolMessage.result?.planPath ? toolMessage.result.planPath : undefined

			// Extract todos from params (they might be in different formats)
			let todos: Array<{ id: string; content: string; status?: string }> = []
			if (toolMessage.params?.todos) {
				if (Array.isArray(toolMessage.params.todos)) {
					todos = toolMessage.params.todos
				}
			}

			// Extract sections - these are standard plan sections
			const sections = ['Overview', 'Files', 'Steps', 'Testing', 'Notes'].filter(s => {
				// Could check if section exists in plan, but for now show all
				return true
			})

			// Calculate metadata
			const todoCount = todos.length
			const completedTodos = todos.filter(t => t.status === 'completed').length
			const sectionCount = sections.length

			// Format metadata string
			const metadataItems = []
			if (todoCount > 0) {
				metadataItems.push(`${todoCount} task${todoCount !== 1 ? 's' : ''}`)
			}
			if (sectionCount > 0) {
				metadataItems.push(`${sectionCount} section${sectionCount !== 1 ? 's' : ''}`)
			}
			if (completedTodos > 0) {
				metadataItems.push(`${completedTodos}/${todoCount} done`)
			}
			const metadataText = metadataItems.join(' • ')

			const componentParams: ToolHeaderParams = {
				title,
				desc1: planName,
				desc1Info,
				isError,
				isRejected,
				isRunning,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
				info: metadataText || undefined,
			}

			// Handle different states
			if (isError) {
				componentParams.desc1 = 'Failed to create plan'
				componentParams.children = (
					<ToolChildrenWrapper>
						<div className="text-void-fg-3 text-[11px] p-2 bg-void-bg-1/50 rounded mx-3 my-2">
							{typeof toolMessage.result === 'string'
								? toolMessage.result
								: 'An error occurred while creating the plan'}
						</div>
					</ToolChildrenWrapper>
				)
			} else if (isRunning) {
				componentParams.children = (
					<ToolChildrenWrapper>
						<div className="flex items-center gap-2 text-void-fg-3 text-[11px] p-3">
							<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-void-fg-3"></div>
							<span>Creating plan file...</span>
						</div>
					</ToolChildrenWrapper>
				)
			} else if (toolMessage.type === 'success') {
				// Show expandable details for successful plan creation
				componentParams.children = (
					<PlanDetailsContent
						overview={overview}
						todos={todos}
						sections={sections}
						planPath={planPath}
						commandService={commandService}
					/>
				)
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'read_plan': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (toolMessage.type === 'success' && !toolMessage.result?.exists) {
				componentParams.desc1 = 'No active plan found'
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'update_plan_section': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'add_plan_todo': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'mark_plan_item_complete': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (toolMessage.type === 'success' && toolMessage.result?.completedItem) {
				componentParams.desc2 = toolMessage.result.completedItem
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},

	'task': {
		resultWrapper: ({ toolMessage }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

			const agentType = (toolMessage.rawParams?.subagent_type as string | undefined) || ''
			const description = (toolMessage.rawParams?.description as string | undefined) || agentType

			const componentParams: ToolHeaderParams = {
				title: getTitle(toolMessage),
				desc1: desc1 || description,
				desc1Info,
				isError: false,
				isRejected: toolMessage.type === 'rejected',
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (toolMessage.type === 'running_now') {
				componentParams.isRunning = true
				const activity = toolMessage.content
				if (activity && activity !== '(value not received yet...)' && activity !== 'interrupted...') {
					componentParams.desc2 = activity
				}
			}
			else if (toolMessage.type === 'tool_error') {
				const errText = typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? '')
				componentParams.isError = true
				componentParams.desc1 = errText
			}
			else if (toolMessage.type === 'success') {
				const result = toolMessage.result as any
				const status = result?.status as string | undefined
				const output = typeof result?.output === 'string' ? result.output as string : ''
				const durationMs = typeof result?.durationMs === 'number' ? result.durationMs as number : undefined
				const toolUseCount = typeof result?.toolUseCount === 'number' ? result.toolUseCount as number : undefined

				if (status === 'background_launched') {
					// Background agent is still running — show as running state
					componentParams.title = loadingTitleWrapper('Agent running in background')
					componentParams.isRunning = true
					componentParams.desc2 = 'background'
				} else {
					// Completed — show stats
					const parts: string[] = []
					if (status === 'failed' || status === 'cancelled') {
						componentParams.isError = true
						componentParams.title = status === 'failed' ? 'Agent failed' : 'Agent stopped'
						parts.push(status)
					}
					if (toolUseCount !== undefined) parts.push(`${toolUseCount} tool${toolUseCount !== 1 ? 's' : ''}`)
					if (durationMs !== undefined) parts.push(durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`)
					if (parts.length > 0) componentParams.desc2 = parts.join(' · ')

					if (output) {
						componentParams.children = (
							<ToolChildrenWrapper allowTextSelection>
								<SmallProseWrapper>
									<ChatMarkdownRender
										string={output}
										chatMessageLocation={undefined}
										isApplyEnabled={false}
										isLinkDetectionEnabled={true}
									/>
								</SmallProseWrapper>
							</ToolChildrenWrapper>
						)
					}
				}
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
} satisfies { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T> } };
