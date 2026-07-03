/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { Server } from 'lucide-react';
import { toolApprovalTheme } from '../toolApprovalTheme.js';

/**
 * MCP tool preview for the approval card.
 *
 * Shows the MCP server name as a badge and the tool's params as formatted
 * JSON in a monospace block — the same param-formatting logic as
 * `GenericToolWrapper`, but presented in the approval card's preview zone.
 */
export const McpApprovalPreview = ({
	toolName,
	mcpServerName,
	params,
	rawParams,
}: {
	toolName: string,
	mcpServerName: string | undefined,
	params: Record<string, unknown> | undefined,
	rawParams: Record<string, unknown> | undefined,
}) => {
	const paramsDisplay = useMemo(() => {
		try {
			if (params && Object.keys(params).length > 0) {
				return JSON.stringify(params, null, 2);
			}
			if (rawParams && Object.keys(rawParams).length > 0) {
				return JSON.stringify(rawParams, null, 2);
			}
		} catch {
			return undefined;
		}
		return undefined;
	}, [params, rawParams]);

	return (
		<div className="px-3 py-2.5 flex flex-col gap-2">
			{mcpServerName && (
				<div className="flex items-center gap-1.5">
					<Server
						size={12}
						className="flex-shrink-0"
						style={{ color: toolApprovalTheme.descFg }}
						strokeWidth={2}
					/>
					<span
						className="text-[11px] font-medium px-1.5 py-0.5 rounded"
						style={{
							color: toolApprovalTheme.fg,
							background: 'rgba(128, 128, 128, 0.1)',
							border: `1px solid ${toolApprovalTheme.terminalBorder}`,
						}}
					>
						{mcpServerName}
					</span>
					<span
						className="text-[11px] truncate"
						style={{ color: toolApprovalTheme.descFg }}
					>
						{toolName}
					</span>
				</div>
			)}

			{paramsDisplay && (
				<div
					className="rounded-md px-2.5 py-2 overflow-x-auto void-custom-scrollable"
					style={{
						background: toolApprovalTheme.terminalBg,
						border: `1px solid ${toolApprovalTheme.terminalBorder}`,
					}}
				>
					<pre
						className="font-mono text-[11px] leading-relaxed whitespace-pre m-0"
						style={{ color: toolApprovalTheme.fg }}
					>
						{paramsDisplay}
					</pre>
				</div>
			)}
		</div>
	);
};