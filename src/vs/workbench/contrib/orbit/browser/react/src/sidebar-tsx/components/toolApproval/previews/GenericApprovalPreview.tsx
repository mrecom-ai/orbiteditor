/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ToolMessage } from '../../../../../../../common/chatThreadServiceTypes.js';
import { ToolName, BuiltinToolName } from '../../../../../../../common/toolsServiceTypes.js';
import { isABuiltinToolName } from '../../../../../../../common/prompt/prompts.js';
import { useAccessor } from '../../../../util/services.js';
import { toolNameToDesc } from '../../../constants/toolHelpers.js';
import { toolApprovalTheme } from '../toolApprovalTheme.js';

/**
 * Fallback preview for builtin tools without a dedicated preview component
 * (Read, Glob, Grep, TodoWrite, plan tools, etc).
 *
 * Shows the friendly `toolNameToDesc` summary as the primary line, with the
 * raw params available in a collapsible monospace block for users who want
 * the full detail before approving.
 */
export const GenericApprovalPreview = ({
	toolMessage,
}: {
	toolMessage: ToolMessage<ToolName>,
}) => {
	const accessor = useAccessor();
	const [isOpen, setIsOpen] = useState(false);

	const hasParams = 'params' in toolMessage && !!(toolMessage as any).params;
	const { desc1, desc1Info } = isABuiltinToolName(toolMessage.name) && hasParams
		? toolNameToDesc(toolMessage.name as BuiltinToolName, (toolMessage as any).params, accessor, toolMessage.rawParams)
		: { desc1: '', desc1Info: undefined };

	const paramsDisplay = useMemo(() => {
		try {
			const params = (toolMessage as any).params;
			if (params && Object.keys(params).length > 0) {
				return JSON.stringify(params, null, 2);
			}
			if (toolMessage.rawParams && Object.keys(toolMessage.rawParams).length > 0) {
				return JSON.stringify(toolMessage.rawParams, null, 2);
			}
		} catch {
			return undefined;
		}
		return undefined;
	}, [toolMessage]);

	return (
		<div className="px-3 py-2.5 flex flex-col gap-1.5">
			{(desc1 || desc1Info) && (
				<div className="flex items-center gap-1.5 min-w-0">
					{desc1 && (
						<span
							className="text-[12px] font-medium truncate"
							style={{ color: toolApprovalTheme.fg }}
						>
							{desc1}
						</span>
					)}
					{desc1Info && (
						<span
							className="text-[11px] truncate"
							style={{ color: toolApprovalTheme.descFg }}
							data-tooltip-id="void-tooltip"
							data-tooltip-content={desc1Info}
							data-tooltip-place="top"
							data-tooltip-delay-show={1000}
						>
							{desc1Info}
						</span>
					)}
				</div>
			)}

			{paramsDisplay && (
				<div>
					<button
						type="button"
						onClick={() => setIsOpen(v => !v)}
						className="flex items-center gap-1 text-[11px] transition-colors duration-150"
						style={{ color: toolApprovalTheme.descFg }}
						onMouseEnter={(e) => { e.currentTarget.style.color = toolApprovalTheme.fg; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = toolApprovalTheme.descFg; }}
					>
						<ChevronRight
							size={11}
							strokeWidth={2.5}
							className="flex-shrink-0 transition-transform duration-200"
							style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
						/>
						{isOpen ? 'Hide details' : 'Show details'}
					</button>
					{isOpen && (
						<div
							className="mt-1.5 rounded-md px-2.5 py-2 overflow-x-auto void-custom-scrollable"
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
			)}
		</div>
	);
};