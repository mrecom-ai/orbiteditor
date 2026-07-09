/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import type { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { getTitle, getToolStatusIconMeta } from '../../constants/toolHelpers.js';
import { ToolHeaderWrapper, ToolHeaderParams } from '../toolHeaders/ToolHeaderWrapper.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { CopyButton } from '../../../markdown/ApplyBlockHoverButtons.js';
import type { ResultWrapper } from '../../types/toolWrapperTypes.js';
import { removeMCPToolNamePrefix } from '../../../../../../common/mcpServiceTypes.js';

type WrapperProps<T extends ToolName> = {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>,
	messageIdx: number,
	threadId: string,
	compact?: boolean,
}

const ORBIT_IDE_BROWSER_SERVER = 'orbit-ide-browser'

/**
 * First-class renderer for tools exposed by the built-in `orbit-ide-browser`
 * MCP server. Falls back to the generic text/code rendering for textual
 * results, but renders screenshot image results inline instead of the
 * `[Image: image/png]` placeholder the generic wrapper produces.
 */
export const BrowserMcpToolWrapper: ResultWrapper<string> = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')

	if (toolMessage.type === 'tool_request') return null

	const title = getTitle(toolMessage)
	const statusIconMeta = getToolStatusIconMeta(toolMessage)
	const isRejected = toolMessage.type === 'rejected'
	const isRunning = toolMessage.type === 'running_now'
	const isError = toolMessage.type === 'tool_error'
	const { rawParams, params, name } = toolMessage

	const unprefixedName = removeMCPToolNamePrefix(name)

	// Strip the internal auto-open sentinel from any params display so users never see it.
	const stripInternal = (obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
		if (!obj || typeof obj !== 'object') { return obj }
		if (!('__orbitAutoOpenBrowser' in obj)) { return obj }
		const { __orbitAutoOpenBrowser: _stripped, ...rest } = obj
		return rest
	}
	const paramsClean = stripInternal(params as Record<string, unknown> | undefined)
	const rawParamsClean = stripInternal(rawParams as Record<string, unknown> | undefined)

	let paramsDisplay: string | undefined
	try {
		if (paramsClean && Object.keys(paramsClean).length > 0) {
			paramsDisplay = JSON.stringify(paramsClean, null, 2)
		} else if (rawParamsClean && Object.keys(rawParamsClean).length > 0) {
			paramsDisplay = JSON.stringify(rawParamsClean, null, 2)
		}
	} catch {
		paramsDisplay = undefined
	}

	// desc1: a short hint derived from common params (url, ref, selector, ...).
	let desc1: React.ReactNode = unprefixedName
	if (isError && typeof toolMessage.result === 'string') {
		desc1 = toolMessage.result.substring(0, 100) + (toolMessage.result.length > 100 ? '...' : '')
	} else {
		const p = (paramsClean ?? rawParamsClean) as Record<string, unknown> | undefined
		if (p) {
			if (typeof p.url === 'string') desc1 = p.url
			else if (typeof p.ref === 'string') desc1 = p.ref
			else if (typeof p.selector === 'string') desc1 = p.selector
			else if (typeof p.text === 'string') desc1 = `"${p.text.length > 60 ? p.text.slice(0, 60) + '…' : p.text}"`
			else if (typeof p.tabId === 'string') desc1 = `tab ${p.tabId}`
		}
	}

	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isError,
		isRejected,
		icon: statusIconMeta?.icon,
		iconTooltip: statusIconMeta?.tooltip,
		isRunning,
		info: 'Browser automation',
	}
	if (paramsDisplay) {
		componentParams.desc2 = <CopyButton codeStr={paramsDisplay} toolTipName="Copy inputs" />
	}

	if (toolMessage.type === 'success') {
		const { result } = toolMessage
		try {
			// Image result: render inline instead of `[Image: image/png]`.
			// Match any tool that returned an image event — not only
			// browser_take_screenshot. `take_screenshot_afterwards` on type/
			// click/fill also returns `{ event: 'image', ... }`.
			if (result && typeof result === 'object') {
				const r = result as { event?: string; image?: { data?: string; mimeType?: string }; text?: string }
				if (r.event === 'image' && r.image?.data) {
					const src = `data:${r.image.mimeType ?? 'image/png'};base64,${r.image.data}`
					const caption = typeof r.text === 'string' && r.text.trim() ? r.text : undefined
					const MAX_CAPTION = 12_000
					const captionDisplay = caption && caption.length > MAX_CAPTION
						? `${caption.slice(0, MAX_CAPTION)}\n\n… (${caption.length - MAX_CAPTION} more chars truncated in UI)`
						: caption
					componentParams.children = (
						<ToolChildrenWrapper>
							{captionDisplay ? (
								captionDisplay.length < 200 && !captionDisplay.includes('\n') ? (
									<pre className="text-void-fg-3 text-xs whitespace-pre-wrap m-0 mb-2">{captionDisplay}</pre>
								) : (
									<div className="mb-2">
										<SmallProseWrapper>
											<ChatMarkdownRender
												string={`\`\`\`\n${captionDisplay}\n\`\`\``}
												chatMessageLocation={undefined}
												isApplyEnabled={false}
												isLinkDetectionEnabled={true}
											/>
										</SmallProseWrapper>
									</div>
								)
							) : null}
							<img
								src={src}
								alt={`Screenshot from ${unprefixedName}`}
								className="w-full max-w-full h-auto object-contain rounded-md border border-void-border-1 bg-void-bg-1"
								style={{ display: 'block' }}
							/>
						</ToolChildrenWrapper>
					)
					return <ToolHeaderWrapper {...componentParams} />
				}
			}

			// Default: text/code rendering (matches GenericToolWrapper).
			// Snapshots can be large — cap display so the chat stays responsive.
			let resultStr: string
			if (typeof result === 'string') {
				resultStr = result
			} else if (result && typeof result === 'object') {
				resultStr = mcpService.stringifyResult(result)
			} else {
				resultStr = String(result) || 'No result'
			}
			const MAX_DISPLAY = 12_000
			const truncated = resultStr.length > MAX_DISPLAY
			const displayStr = truncated
				? `${resultStr.slice(0, MAX_DISPLAY)}\n\n… (${resultStr.length - MAX_DISPLAY} more chars truncated in UI)`
				: resultStr

			// Prefer a compact one-liner for short success messages (Typed…, Clicked…).
			const isShortPlain = !truncated && displayStr.length < 200 && !displayStr.includes('\n')
			componentParams.children = (
				<ToolChildrenWrapper>
					{isShortPlain ? (
						<pre className="text-void-fg-3 text-xs whitespace-pre-wrap m-0">{displayStr}</pre>
					) : (
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={`\`\`\`\n${displayStr}\n\`\`\``}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					)}
				</ToolChildrenWrapper>
			)
		} catch {
			componentParams.children = (
				<ToolChildrenWrapper>
					<pre className="text-void-fg-4 text-xs whitespace-pre-wrap">{String(result)}</pre>
				</ToolChildrenWrapper>
			)
		}
	}

	return <ToolHeaderWrapper {...componentParams} />
}

export const isOrbitIdeBrowserTool = (toolMessage: { mcpServerName?: string }): boolean =>
	toolMessage.mcpServerName === ORBIT_IDE_BROWSER_SERVER
