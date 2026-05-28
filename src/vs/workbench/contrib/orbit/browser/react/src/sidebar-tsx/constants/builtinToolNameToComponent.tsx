/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../../base/common/uri.js';
import { BuiltinToolName } from '../../../../../common/toolsServiceTypes.js';
import { MAX_FILE_CHARS_PAGE } from '../../../../../common/prompt/prompts.js';
import { persistentTerminalNameOfId } from '../../../../terminalToolService.js';
import { useAccessor, useChatThreadsStreamState } from '../../util/services.js';
import { getTitle, toolNameToDesc, getToolStatusIconMeta } from './toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../components/toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../components/toolWrappers/ToolChildrenWrapper.js';
import { CodeChildren } from '../components/toolWrappers/CodeChildren.js';
import { ListableToolItem } from '../components/toolWrappers/ListableToolItem.js';
import { SmallProseWrapper } from '../components/wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../markdown/ChatMarkdownRender.js';
import { voidOpenFileFn, getRelative, getBasename } from '../utils/fileUtils.js';
import { EditTool } from '../components/editTool/EditTool.js';
import { CommandTool } from '../components/toolResults/CommandTool.js';
import { BrowserToolBar } from '../../browser-tools-tsx/index.js';
import { PlanDetailsContent } from '../components/toolResults/PlanDetailsContent.js';
import { LintErrorChildren } from '../components/toolResults/LintErrorChildren.js';
import { ResultWrapper } from '../types/toolWrapperTypes.js';
import { TodoToolWithState } from '../components/toolResults/TodoTool.js';
import { SubAgentCard } from '../components/chatComponents/SubAgentCard.js';
import { SubAgentCardList } from '../components/chatComponents/SubAgentCardList.js';
import type { SubAgentChildReport, SubAgentChildViewModel, SubAgentStageViewModel } from '../../../../../common/subAgentTypes.js';

const stageForTaskTool = (
	threadStreamState: ReturnType<typeof useChatThreadsStreamState>,
	toolCallId: string,
): SubAgentStageViewModel | undefined => {
	const perToolStage = threadStreamState?.subAgentStagesByToolId?.[toolCallId]
	if (perToolStage) return perToolStage

	const combinedStage = threadStreamState?.subAgentStage
	if (!combinedStage) return undefined

	// Legacy fallback: before per-tool stage snapshots existed, only one combined stage was available.
	return combinedStage.children.length <= 1 ? combinedStage : undefined
}

const arrayWithFallback = <T,>(preferred: T[] | undefined, fallback: T[] | undefined): T[] => {
	if (preferred && preferred.length > 0) return preferred
	if (fallback && fallback.length > 0) return fallback
	return []
}

const stringWithFallback = (...values: Array<string | undefined>): string => {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value
	}
	return ''
}

const mergeSubAgentChild = (
	stageChild: SubAgentChildViewModel | undefined,
	report: SubAgentChildReport | undefined,
): SubAgentChildViewModel | undefined => {
	if (!stageChild && !report) return undefined
	if (!report) return stageChild
	if (!stageChild) {
		return {
			childId: report.childId,
			title: report.title,
			taskTemplate: report.taskTemplate,
			state: report.status,
			activityText: report.status === 'completed' ? 'Completed' : report.status === 'timed_out' ? 'Timed out' : report.status === 'killed' ? 'Killed' : report.status === 'canceled' ? 'Canceled' : 'Failed',
			activityLog: [],
			summaryBullets: report.summaryBullets,
			error: report.error,
		}
	}

	return {
		...stageChild,
		childId: stageChild.childId || report.childId,
		title: stringWithFallback(stageChild.title, report.title),
		taskTemplate: stringWithFallback(stageChild.taskTemplate, report.taskTemplate),
		state: report.status ?? stageChild.state,
		activityText: stringWithFallback(
			stageChild.activityText,
			report.status === 'completed' ? 'Completed' : report.status === 'timed_out' ? 'Timed out' : report.status === 'killed' ? 'Killed' : report.status === 'canceled' ? 'Canceled' : report.status === 'failed' ? 'Failed' : undefined,
		),
		activityLog: arrayWithFallback(stageChild.activityLog, undefined),
		summaryBullets: arrayWithFallback(report.summaryBullets, stageChild.summaryBullets),
		error: stringWithFallback(report.error, stageChild.error),
	}
}

const inlineSubAgentChildren = (children: SubAgentChildViewModel[] | undefined): React.ReactNode => {
	if (!children || children.length === 0) return undefined

	return (
		<ToolChildrenWrapper className='tool-children-subagent'>
			<div className='pt-1 flex flex-col gap-2'>
				{children.map(child => (
					<SubAgentCard key={child.childId} child={child} />
				))}
			</div>
		</ToolChildrenWrapper>
	)
}

const inlineSubAgentStage = (stage: SubAgentStageViewModel | undefined): React.ReactNode => {
	if (!stage) return undefined
	return (
		<ToolChildrenWrapper className='tool-children-subagent'>
			<SubAgentCardList stage={stage} />
		</ToolChildrenWrapper>
	)
}

export const builtinToolNameToComponent: { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T>, } } = {
	'read_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

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
			const startLine = typeof toolMessage.params.startLine === 'number' ? toolMessage.params.startLine : null
			const endLine = typeof toolMessage.params.endLine === 'number' ? toolMessage.params.endLine : null
			if (startLine !== null || endLine !== null) {
				const startStr = startLine === null ? '1' : `${startLine}`
				const endStr = endLine === null ? '' : `${endLine}`
				const addStr = `(${startStr}-${endStr})`
				componentParams.desc1 += ` ${addStr}`
				range = [startLine ?? 1, endLine ?? (startLine ?? 1)]
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor, range) }
				if (result.hasNextPage && params.pageNumber === 1)  // first page
					componentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1000}k)`
				else if (params.pageNumber > 1) // subsequent pages
					componentParams.desc2 = `(part ${params.pageNumber})`
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
	'search_pathnames_only': {
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
	'search_for_files': {
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

			if (params.searchInFolder || params.isRegex) {
				let info: string[] = []
				if (params.searchInFolder) {
					const rel = getRelative(params.searchInFolder, accessor)
					if (rel) info.push(`Only search in ${rel}`)
				}
				if (params.isRegex) { info.push(`Uses regex search`) }
				componentParams.info = info.join('; ')
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
							<ListableToolItem name={`Results truncated.`} isSmall={true} className='w-full overflow-auto' />
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

	'search_in_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get('IToolsService');
			const title = getTitle(toolMessage);
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams);
			const statusIconMeta = getToolStatusIconMeta(toolMessage);

			if (toolMessage.type === 'tool_request') return null // do not show past requests

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			};

			const infoarr: string[] = []
			const uriStr = getRelative(params.uri, accessor)
			if (uriStr) infoarr.push(uriStr)
			if (params.isRegex) infoarr.push('Uses regex search')
			componentParams.info = infoarr.join('; ')

			if (toolMessage.type === 'success') {
				const { result } = toolMessage; // result is array of snippets
				componentParams.numResults = result.lines.length;
				componentParams.children = result.lines.length === 0 ? undefined :
					<ToolChildrenWrapper>
						<CodeChildren className='bg-void-bg-3'>
							<pre className='font-mono whitespace-pre'>
								{toolsService.stringOfResult['search_in_file'](params, result)}
							</pre>
						</CodeChildren>
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage;
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// Show loading state - no additional children needed, icon already shows spinner
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />;
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

	'create_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			// Do not show tool_request type - approval buttons are shown separately
			if (toolMessage.type === 'tool_request') return null

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

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

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) } }
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				// nothing more is needed
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'delete_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			// Do not show tool_request type - approval buttons are shown separately
			if (toolMessage.type === 'tool_request') return null

			const isFolder = toolMessage.params?.isFolder ?? false
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)

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

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) } }
				componentParams.desc1 = typeof result === 'string' ? result : String(result)
				componentParams.isError = true
			}
			else if (toolMessage.type === 'running_now') {
				const { result } = toolMessage
				componentParams.onClick = () => { voidOpenFileFn(params.uri, accessor) }
				componentParams.isRunning = true
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'rewrite_file': {
		resultWrapper: (params) => {
			// More robust content extraction
			const content = params.toolMessage.params?.newContent ?? ''
			const hasValidContent = typeof content === 'string' && content.trim().length > 0
			return <EditTool {...params} content={content} hasValidContent={hasValidContent} />
		}
	},
	'edit_file': {
		resultWrapper: (params) => {
			// More robust content extraction
			const content = params.toolMessage.params?.searchReplaceBlocks ?? ''
			const hasValidContent = typeof content === 'string' && content.trim().length > 0
			return <EditTool {...params} content={content} hasValidContent={hasValidContent} />
		}
	},

	// ---

	'run_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_command' />
		}
	},

	'run_persistent_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_persistent_command' />
		}
	},
	'open_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const title = getTitle(toolMessage)
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

			const relativePath = params.cwd ? getRelative(URI.file(params.cwd), accessor) : ''
			componentParams.info = relativePath ? `Running in ${relativePath}` : undefined

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				const { persistentTerminalId } = result
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
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
	'kill_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const title = getTitle(toolMessage)
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

			if (toolMessage.type === 'success') {
				const { persistentTerminalId } = params
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
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

	'update_todo_list': {
		resultWrapper: ({ toolMessage, threadId }) => {
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
			const isStreaming = toolMessage.type === 'running_now'

			return (
				<TodoToolWithState
					todos={todos}
					threadId={threadId}
					toolCallId={toolMessage.id}
					isStreaming={isStreaming}
				/>
			)
		},
	},

	'task': {
		resultWrapper: ({ toolMessage, threadId }) => {
			if (toolMessage.type === 'tool_request') return null

			const accessor = useAccessor()
			const threadStreamState = useChatThreadsStreamState(threadId)
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor, toolMessage.rawParams)
			const statusIconMeta = getToolStatusIconMeta(toolMessage)
			const isError = toolMessage.type === 'tool_error'
			const isRejected = toolMessage.type === 'rejected'
			const isRunning = toolMessage.type === 'running_now'
			const liveStage = stageForTaskTool(threadStreamState, toolMessage.id)

			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				isRejected,
				isRunning,
				icon: statusIconMeta?.icon,
				iconTooltip: statusIconMeta?.tooltip,
			}

			if (toolMessage.type === 'success') {
				const metadata = (toolMessage.result as any)?.metadata as { agent?: string; status?: string } | undefined
				const resultStage = (toolMessage.result as any)?.stage as SubAgentStageViewModel | undefined
				const report = (toolMessage.result as any)?.report
				const output = typeof (toolMessage.result as any)?.output === 'string'
					? (toolMessage.result as any).output
					: (typeof (toolMessage.result as any)?.fullText === 'string' ? (toolMessage.result as any).fullText : '')
				const preview = output.length > 4000 ? `${output.slice(0, 4000)}\n\n... (truncated)` : output
				const stage = resultStage ?? liveStage

				componentParams.desc1 = (toolMessage.result as any)?.title || desc1 || 'Subagent task'
				componentParams.info = [
					metadata?.agent ? `@${metadata.agent}` : null,
					metadata?.status ?? null,
				].filter(Boolean).join(' • ') || undefined

				const stageChildren = stage?.children ?? []
				const stageChild = report?.childId
					? stageChildren.find(child => child.childId === report.childId) ?? stageChildren[0]
					: stageChildren[0]
				const mergedChild = mergeSubAgentChild(stageChild, report)

				if (stage) {
					const children = mergedChild
						? stage.children.map(child => child.childId === mergedChild.childId ? mergedChild : child)
						: stage.children
					componentParams.children = inlineSubAgentStage({ ...stage, children })
				} else if (mergedChild) {
					componentParams.children = inlineSubAgentChildren([mergedChild])
				} else if (preview) {
					componentParams.children = (
						<ToolChildrenWrapper className='tool-children-subagent'>
							<SmallProseWrapper>
								<ChatMarkdownRender
									string={`\`\`\`\n${preview}\n\`\`\``}
									chatMessageLocation={undefined}
									isApplyEnabled={false}
									isLinkDetectionEnabled={true}
								/>
							</SmallProseWrapper>
						</ToolChildrenWrapper>
					)
				}
			}
			else if (toolMessage.type === 'running_now') {
				componentParams.desc1 = toolMessage.params?.description || desc1 || 'Subagent task'
				const liveChildren = liveStage?.children
				if (liveStage) {
					componentParams.children = inlineSubAgentStage(liveStage)
				} else if (liveChildren && liveChildren.length > 0) {
					componentParams.children = inlineSubAgentChildren(liveChildren)
				}
			}
			else if (toolMessage.type === 'tool_error') {
				componentParams.desc1 = typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result)
				const liveChildren = liveStage?.children
				if (liveStage) {
					componentParams.children = inlineSubAgentStage(liveStage)
				} else if (liveChildren && liveChildren.length > 0) {
					componentParams.children = inlineSubAgentChildren(liveChildren)
				}
			}

			if (componentParams.children) {
				return <>{componentParams.children}</>
			}

			return <ToolHeaderWrapper {...componentParams} />
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
} satisfies { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T> } };
