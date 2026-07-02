/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Square, X } from 'lucide-react';
import { ChatMessage, ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { BuiltinToolResultType } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { SubAgentRunningIcon } from './SubAgentRunningIcon.js';
import { formatSubAgentLiveStatus } from './subAgentConversationHelpers.js';
import { getTaskToolRejectedStatusLine } from './taskToolRuntime.js';

export type SubAgentCardProps = {
	toolMessage: Exclude<ToolMessage<'task'>, { type: 'invalid_params' }>;
	threadId: string;
	isRunning: boolean;
	liveActivity?: string;
	conversation?: readonly ChatMessage[];
	onOpen: (e: React.MouseEvent) => void;
	onStop: (e: React.MouseEvent) => void;
};

type SubAgentCardStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'rejected';

const getCardStatus = (
	toolMessage: SubAgentCardProps['toolMessage'],
	isRunning: boolean,
): SubAgentCardStatus => {
	if (toolMessage.type === 'rejected') return 'rejected';
	if (toolMessage.type === 'running_now' || isRunning) return 'running';
	if (toolMessage.type === 'tool_error') return 'failed';
	if (toolMessage.type === 'success') {
		const status = (toolMessage.result as BuiltinToolResultType['task'] | undefined)?.status;
		if (status === 'failed') return 'failed';
		if (status === 'cancelled') return 'cancelled';
	}
	return 'completed';
};

const StatusIcon = ({ status }: { status: SubAgentCardStatus }) => {
	switch (status) {
		case 'running':
			return <SubAgentRunningIcon size={13} />;
		case 'completed':
			return <Check size={13} className="text-[#98C379] flex-shrink-0" strokeWidth={2.5} />;
		case 'failed':
		case 'cancelled':
		case 'rejected':
			return <X size={13} className="text-[#E06C75] flex-shrink-0" strokeWidth={2.5} />;
	}
};

const buildCompletedStatusLine = (toolMessage: SubAgentCardProps['toolMessage']): string | undefined => {
	if (toolMessage.type !== 'success') return undefined;
	const result = toolMessage.result as BuiltinToolResultType['task'] | undefined;
	if (!result || result.status === 'background_launched') return undefined;

	const parts: string[] = [];
	if (result.status === 'failed') parts.push('Failed');
	else if (result.status === 'cancelled') parts.push('Stopped');
	else parts.push('Done');

	if (typeof result.toolUseCount === 'number') {
		parts.push(`${result.toolUseCount} tool${result.toolUseCount !== 1 ? 's' : ''}`);
	}
	if (typeof result.durationMs === 'number' && result.durationMs > 0) {
		parts.push(result.durationMs < 1000 ? `${result.durationMs}ms` : `${(result.durationMs / 1000).toFixed(1)}s`);
	}
	return parts.join(' · ');
};

export const SubAgentCard = ({
	toolMessage,
	isRunning,
	liveActivity,
	conversation,
	onOpen,
	onStop,
}: SubAgentCardProps) => {
	const accessor = useAccessor();
	const [isHovered, setIsHovered] = useState(false);

	const agentType = (toolMessage.rawParams?.subagent_type as string | undefined) || '';
	const description = (toolMessage.rawParams?.description as string | undefined) || agentType || 'Sub-agent';

	const status = getCardStatus(toolMessage, isRunning);
	const showStop = isHovered && status === 'running';

	const statusLine = useMemo(() => {
		if (status === 'running') {
			return formatSubAgentLiveStatus({
				liveActivity,
				conversation,
				accessor,
				isRunning: true,
			});
		}
		if (toolMessage.type === 'tool_error') {
			return typeof toolMessage.result === 'string' ? toolMessage.result : String(toolMessage.result ?? 'Agent failed');
		}
		if (status === 'rejected') {
			return getTaskToolRejectedStatusLine(toolMessage) ?? 'Stopped by user';
		}
		return buildCompletedStatusLine(toolMessage)
			?? formatSubAgentLiveStatus({ conversation, accessor, isRunning: false });
	}, [status, liveActivity, conversation, accessor, isRunning, toolMessage]);

	return (
		<EditToolCardWrapper isRunning={isRunning} className="relative overflow-hidden">
			{isRunning && (
				<div
					className="absolute inset-0 z-0 pointer-events-none"
					style={{
						background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.07), transparent)',
						animation: 'orbit-subagent-sweep 2.2s linear infinite',
					}}
				/>
			)}
			<div
				className="group relative z-10 flex items-center"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<button
					type="button"
					className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]"
					style={{ minHeight: '30px' }}
					onClick={onOpen}
				>
					<span className="flex-shrink-0 w-[14px] flex items-center justify-center">
						<StatusIcon status={status} />
					</span>
					<div className="flex-1 min-w-0">
						<div className="text-[12px] font-medium text-void-fg-2/90 truncate leading-[1.35]">
							{status === 'running' ? (
								<TextShimmer duration={2.5} spread={2}>{description}</TextShimmer>
							) : description}
						</div>
						{statusLine && (
							<div className="text-[10.5px] truncate leading-[1.3] mt-[1px]">
								{status === 'running' ? (
									<TextShimmer duration={2.2} spread={2} className="text-void-fg-4">
										{statusLine}
									</TextShimmer>
								) : (
									<span className={status === 'failed' || status === 'cancelled' || status === 'rejected' ? 'text-[#E06C75]/80' : 'text-void-fg-4'}>
										{statusLine}
									</span>
								)}
							</div>
						)}
					</div>
					<span className="flex-shrink-0 w-[14px] flex items-center justify-center">
						{!showStop && (
							<ChevronRight size={12} className="text-void-fg-4/40 opacity-0 group-hover:opacity-70 transition-opacity" />
						)}
					</span>
				</button>
				{showStop && (
					<button
						type="button"
						className="flex-shrink-0 w-[20px] h-[20px] mr-2.5 rounded-full border border-white/20 flex items-center justify-center hover:border-white/35 hover:bg-white/[0.06] transition-all"
						onClick={onStop}
						title="Stop sub-agent"
						aria-label="Stop sub-agent"
					>
						<Square size={8} className="text-void-fg-2 fill-void-fg-2" strokeWidth={0} />
					</button>
				)}
			</div>
		</EditToolCardWrapper>
	);
};
