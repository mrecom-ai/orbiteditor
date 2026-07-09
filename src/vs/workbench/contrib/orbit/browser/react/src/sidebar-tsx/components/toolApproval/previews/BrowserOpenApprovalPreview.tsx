/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { toolApprovalTheme } from '../toolApprovalTheme.js';

/**
 * Clean approval preview when the agent needs to open the integrated browser
 * (no tabs open yet, or explicitly opening a new tab). Shows the destination
 * URL instead of raw MCP JSON so the card reads as a product action.
 *
 * When `toolName` is provided, the request is a non-navigate browser tool
 * (snapshot/click/type/...) that needs the browser opened first because no
 * tabs are open. The headline reflects that the browser will open and then
 * the tool will run, instead of showing a destination URL.
 */
export const BrowserOpenApprovalPreview = ({
	url,
	position,
	isNewTab,
	toolName,
}: {
	url: string | undefined;
	position: 'active' | 'side' | undefined;
	isNewTab: boolean;
	toolName?: string;
}) => {
	const destination = useMemo(() => {
		const raw = (url ?? '').trim();
		if (!raw || raw === 'about:blank') {
			return 'a new browser tab';
		}
		return raw;
	}, [url]);

	const placement = position === 'side'
		? ' beside your current editor'
		: position === 'active'
			? ' in the editor'
			: ' in the background';

	const headline = toolName
		? 'Open browser to continue'
		: isNewTab
			? 'Open a new browser tab'
			: 'Open the Orbit browser';

	// For non-navigate auto-open: describe that the browser will open first,
	// then the tool will run. Friendly tool names map to readable descriptions.
	const toolDesc = useMemo(() => {
		if (!toolName) {
			return undefined;
		}
		const friendly: Record<string, string> = {
			browser_snapshot: 'capture an accessibility snapshot',
			browser_take_screenshot: 'take a screenshot',
			browser_click: 'click an element',
			browser_mouse_click_xy: 'click a point',
			browser_type: 'type text',
			browser_fill: 'fill a field',
			browser_select_option: 'select an option',
			browser_press_key: 'press a key',
			browser_scroll: 'scroll the page',
			browser_drag: 'drag an element',
			browser_hover: 'hover an element',
			browser_highlight: 'highlight an element',
			browser_get_bounding_box: 'get a bounding box',
			browser_cdp: 'run a CDP command',
		};
		return friendly[toolName] ?? `run ${toolName}`;
	}, [toolName]);

	const subline = toolDesc
		? `Open the Orbit browser, then ${toolDesc}.`
		: <>
			Navigate to{' '}
			<span
				className="font-medium break-all"
				style={{ color: toolApprovalTheme.fg }}
			>
				{destination}
			</span>
			{placement}.
		</>;

	return (
		<div className="px-3 py-2.5 flex flex-col gap-2">
			<div className="flex items-start gap-2.5">
				<span
					className="flex-shrink-0 mt-0.5 flex items-center justify-center rounded-md"
					style={{
						width: 28,
						height: 28,
						background: 'color-mix(in srgb, var(--vscode-button-background, #3794ff) 18%, transparent)',
						color: 'var(--vscode-button-background, var(--vscode-textLink-foreground, #3794ff))',
					}}
				>
					<Globe size={14} strokeWidth={2} />
				</span>
				<div className="flex flex-col gap-0.5 min-w-0">
				<span
					className="text-[12.5px] font-medium leading-snug"
					style={{ color: toolApprovalTheme.fg }}
				>
					{headline}
				</span>
				<span
					className="text-[11.5px] leading-snug"
					style={{ color: toolApprovalTheme.descFg }}
				>
					{subline}
				</span>
			</div>
		</div>
	</div>
);
};
