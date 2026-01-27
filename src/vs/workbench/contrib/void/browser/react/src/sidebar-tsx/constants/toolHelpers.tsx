/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { CirclePlus, AlertTriangle, X } from 'lucide-react';
import { URI } from '../../../../../../../../base/common/uri.js';
import { ChatMessage } from '../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolName, BuiltinToolCallParams } from '../../../../../common/toolsServiceTypes.js';
import { builtinToolNames, resolveBuiltinToolNameLoose } from '../../../../../common/prompt/prompts.js';
import { RawToolParamsObj } from '../../../../../common/sendLLMMessageTypes.js';
import { rejectBorder } from '../../../../../common/helpers/colors.ts';
import { useAccessor } from '../../util/services.js';
import { getBasename, getRelative, getFolderName } from '../utils/fileUtils.js';
import { titleOfBuiltinToolName, loadingTitleWrapper, TOOL_STATUS_ICON_SIZE } from './toolTitles.js';
import { removeMCPToolNamePrefix } from '../../../../../common/mcpServiceTypes.js';

export type ToolStatusIconMeta = {
	icon: React.ReactNode;
	tooltip: string;
}

export const getToolStatusIconMeta = (toolMessage: Pick<ChatMessage & { role: 'tool' }, 'name' | 'type' | 'mcpServerName'>): ToolStatusIconMeta | null => {
	switch (toolMessage.type) {
		case 'running_now':
			// No icon needed - shimmer effect on title is sufficient
			return null
		case 'tool_request':
			return {
				icon: <CirclePlus size={TOOL_STATUS_ICON_SIZE} className='text-void-fg-3 flex-shrink-0' />,
				tooltip: 'Waiting for approval',
			}
		case 'success':
			return null
		case 'tool_error':
		case 'invalid_params':
			return {
				icon: <AlertTriangle size={TOOL_STATUS_ICON_SIZE} className='text-void-fg-3 flex-shrink-0' />,
				tooltip: 'Error running tool',
			}
		case 'rejected':
			return {
				icon: <X size={TOOL_STATUS_ICON_SIZE} style={{ color: rejectBorder }} className='flex-shrink-0' />,
				tooltip: 'Canceled',
			}
		default:
			return null
	}
}


export const getTitle = (toolMessage: Pick<ChatMessage & { role: 'tool' }, 'name' | 'type' | 'mcpServerName'>): React.ReactNode => {
	const t = toolMessage
	const resolvedBuiltinName = t.mcpServerName ? undefined : resolveBuiltinToolNameLoose(t.name)

	// Built-in tools - use predefined titles
	if (resolvedBuiltinName || builtinToolNames.includes(t.name as BuiltinToolName)) {
		const toolName = (resolvedBuiltinName ?? t.name) as BuiltinToolName
		const toolTitleInfo = (titleOfBuiltinToolName as any)[toolName] as typeof titleOfBuiltinToolName[BuiltinToolName] | undefined
		if (toolTitleInfo) {
			if (t.type === 'success') return toolTitleInfo.done
			if (t.type === 'running_now') return toolTitleInfo.running
			return toolTitleInfo.proposed
		}
		// Fallback for builtin tools without title info
		if (t.type === 'running_now') return loadingTitleWrapper(toolName)
		return toolName
	}

	// Non-built-in tools (MCP, etc.) - simple, clean titles
	const cleanToolName = removeMCPToolNamePrefix(t.name) || t.name
	
	// State-based action verb
	const verb =
		t.type === 'success' ? 'Called'
			: t.type === 'running_now' ? 'Calling'
				: t.type === 'tool_request' ? 'Call'
					: t.type === 'rejected' ? 'Cancelled'
						: t.type === 'invalid_params' ? 'Invalid'
							: t.type === 'tool_error' ? 'Error'
								: 'Call'

	const title = `${verb} ${cleanToolName}`
	if (t.type === 'running_now' || t.type === 'tool_request') {
		return loadingTitleWrapper(title)
	}
	return title
}


export const toolNameToDesc = (toolName: BuiltinToolName, _toolParams: BuiltinToolCallParams[BuiltinToolName] | undefined, accessor: ReturnType<typeof useAccessor>, rawParams?: RawToolParamsObj): {
	desc1: React.ReactNode,
	desc1Info?: string,
} => {

	if (!_toolParams || (typeof _toolParams === 'object' && _toolParams !== null && !(_toolParams instanceof URI) && Object.keys(_toolParams).length === 0)) {
		// If params is empty, try to extract basic info from rawParams for display
		if (rawParams) {
			const x = {
				'read_file': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							};
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'ls_dir': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getFolderName(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							};
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'get_dir_tree': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getFolderName(uri.fsPath) ?? '/',
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'search_pathnames_only': () => {
					const query = rawParams.query as string | undefined
					return { desc1: query ? `"${query}"` : '' }
				},
				'search_for_files': () => {
					const query = rawParams.query as string | undefined
					return { desc1: query ? `"${query}"` : '' }
				},
				'search_in_file': () => {
					const query = rawParams.query as string | undefined
					const uriStr = rawParams.uri as string | undefined
					let desc1Info: string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							desc1Info = getRelative(uri, accessor)
						} catch { }
					}
					return {
						desc1: query ? `"${query}"` : '',
						desc1Info,
					};
				},
				'create_file_or_folder': () => {
					const uriStr = rawParams.uri as string | undefined
					const isFolder = rawParams.is_folder as boolean | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: isFolder ? (getFolderName(uri.fsPath) ?? '/') : getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'delete_file_or_folder': () => {
					const uriStr = rawParams.uri as string | undefined
					const isFolder = rawParams.is_folder as boolean | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: isFolder ? (getFolderName(uri.fsPath) ?? '/') : getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'rewrite_file': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'edit_file': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'run_command': () => {
					const command = rawParams.command as string | undefined
					return { desc1: command ? `"${command}"` : '' }
				},
				'run_persistent_command': () => {
					const command = rawParams.command as string | undefined
					return { desc1: command ? `"${command}"` : '' }
				},
				'open_persistent_terminal': () => {
					return { desc1: '' }
				},
				'kill_persistent_terminal': () => {
					const id = rawParams.persistent_terminal_id as string | undefined
					return { desc1: id || '' }
				},
				'read_lint_errors': () => {
					const uriStr = rawParams.uri as string | undefined
					if (uriStr) {
						try {
							const uri = URI.parse(uriStr)
							return {
								desc1: getBasename(uri.fsPath),
								desc1Info: getRelative(uri, accessor),
							}
						} catch {
							return { desc1: uriStr }
						}
					}
					return { desc1: '' }
				},
				'update_todo_list': () => {
					const todosStr = rawParams.todos as string | undefined
					if (todosStr) {
						const numItems = todosStr.split('\n').filter(Boolean).length
						return { desc1: `${numItems} items` }
					}
					return { desc1: '' }
				},

				// Plan tools
				'create_plan': () => {
					const planName = rawParams.plan_name as string | undefined
					return { desc1: planName || 'New plan' }
				},
				'read_plan': () => {
					return { desc1: 'current plan' }
				},
				'update_plan_section': () => {
					const sectionName = rawParams.section_name as string | undefined
					return { desc1: sectionName || '' }
				},
				'add_plan_todo': () => {
					const todoText = rawParams.todo_text as string | undefined
					return { desc1: todoText ? (todoText.length > 40 ? todoText.slice(0, 40) + '...' : todoText) : '' }
				},
				'mark_plan_item_complete': () => {
					const itemIndex = rawParams.item_index as number | undefined
					return { desc1: itemIndex ? `item #${itemIndex}` : '' }
				},

				'browser_navigate': () => {
					const url = rawParams.url as string | undefined
					return { desc1: url || 'page' }
				},
				'browser_click': () => {
					return { desc1: 'element' }
				},
				'browser_type': () => {
					return { desc1: 'text' }
				},
				'browser_fill': () => {
					return { desc1: 'form' }
				},
				'browser_screenshot': () => {
					return { desc1: 'page' }
				},
				'browser_get_content': () => {
					return { desc1: 'current page' }
				},
				'browser_extract_text': () => {
					return { desc1: 'page text' }
				},
				'browser_evaluate': () => {
					return { desc1: 'script' }
				},
				'browser_wait_for_selector': () => {
					return { desc1: 'selector' }
				},
				'browser_get_url': () => {
					return { desc1: 'current page' }
				},
				'browser_snapshot': () => {
					return { desc1: 'DOM snapshot' }
				},
			}
			try {
				return x[toolName]?.() || { desc1: '' }
			} catch {
				return { desc1: '' }
			}
		}
		return { desc1: '', };
	}

	const x = {
		'read_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'ls_dir': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['ls_dir']
			return {
				desc1: getFolderName(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'search_pathnames_only': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_pathnames_only']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_for_files': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_for_files']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_in_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_in_file'];
			return {
				desc1: `"${toolParams.query}"`,
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'create_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['create_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'delete_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['delete_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'rewrite_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['rewrite_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'edit_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['edit_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'run_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'run_persistent_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_persistent_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'open_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['open_persistent_terminal']
			return { desc1: '' }
		},
		'kill_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['kill_persistent_terminal']
			return { desc1: toolParams.persistentTerminalId }
		},

		// --- browser automation
		'browser_navigate': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_navigate']
			return {
				desc1: toolParams.url,
				desc1Info: `waitUntil=${toolParams.waitUntil}; timeout=${toolParams.timeout}ms`,
			}
		},
		'browser_click': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_click']
			return {
				desc1: toolParams.selector,
				desc1Info: `timeout=${toolParams.timeout}ms`,
			}
		},
		'browser_type': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_type']
			return {
				desc1: toolParams.selector,
				desc1Info: `textLength=${toolParams.text.length}; timeout=${toolParams.timeout}ms; delay=${toolParams.delayMs}ms`,
			}
		},
		'browser_fill': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_fill']
			return {
				desc1: toolParams.selector,
				desc1Info: `valueLength=${toolParams.value.length}; timeout=${toolParams.timeout}ms`,
			}
		},
		'browser_screenshot': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_screenshot']
			return { desc1: toolParams.fullPage ? 'full page' : 'viewport' }
		},
		'browser_extract_text': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_extract_text']
			return {
				desc1: toolParams.selector,
				desc1Info: `timeout=${toolParams.timeout}ms`,
			}
		},
		'browser_evaluate': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_evaluate']
			const condensed = toolParams.script.replace(/\s+/g, ' ').trim()
			const preview = condensed.length > 80 ? condensed.slice(0, 80) + '...' : condensed
			return {
				desc1: preview,
				desc1Info: condensed,
			}
		},
		'browser_wait_for_selector': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_wait_for_selector']
			const condition = toolParams.hidden ? 'hidden' : toolParams.visible ? 'visible' : 'present'
			return {
				desc1: toolParams.selector,
				desc1Info: `timeout=${toolParams.timeout}ms; ${condition}`,
			}
		},
		'browser_get_content': () => {
			return { desc1: 'current page' }
		},
		'browser_get_url': () => {
			return { desc1: 'current URL' }
		},
		'browser_snapshot': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['browser_snapshot']
			return {
				desc1: toolParams.interestingOnly ? 'interactive elements' : 'full DOM',
			}
		},
		'get_dir_tree': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['get_dir_tree']
			return {
				desc1: getFolderName(toolParams.uri.fsPath) ?? '/',
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'read_lint_errors': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_lint_errors']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'update_todo_list': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['update_todo_list']
			return {
				desc1: `(${toolParams.todos.length} items)`,
			}
		},
		// Plan tools
		'create_plan': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['create_plan']
			return {
				desc1: toolParams.name || 'New plan',
			}
		},
		'read_plan': () => {
			return { desc1: 'current plan' }
		},
		'update_plan_section': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['update_plan_section']
			return {
				desc1: toolParams.sectionName,
			}
		},
		'add_plan_todo': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['add_plan_todo']
			const text = toolParams.todoText
			return {
				desc1: text.length > 40 ? text.slice(0, 40) + '...' : text,
			}
		},
		'mark_plan_item_complete': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['mark_plan_item_complete']
			return {
				desc1: `item #${toolParams.itemIndex}`,
			}
		},
	}

	try {
		return x[toolName]?.() || { desc1: '' }
	}
	catch {
		return { desc1: '' }
	}
}
