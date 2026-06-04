/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Terminal, Check, AlertTriangle, Clock, Zap, MoreHorizontal, Square } from 'lucide-react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor, useChatThreadsStreamState } from '../../../util/services.js';
import { EditToolCardWrapper } from '../editTool/EditToolCardWrapper.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { CopyButton } from '../../../markdown/ApplyBlockHoverButtons.js';
import {
	getShellCardCommandLine,
	getShellCardMetaTags,
	getShellCardOutput,
	getShellCardStatus,
	getShellCardTitle,
	ShellCommandHighlight,
	ShellOutputLine,
} from './shellToolCardHelpers.js';

type ShellToolCardProps = {
	toolMessage: Exclude<ToolMessage<'Shell' | 'AwaitShell'>, { type: 'invalid_params' }>;
	threadId: string;
};

const StatusIcon = ({ icon }: { icon: NonNullable<ReturnType<typeof getShellCardStatus>>['icon'] }) => {
	const size = 13;
	switch (icon) {
		case 'success':
			return <Check size={size} className="text-[#98C379] flex-shrink-0" strokeWidth={2.5} />;
		case 'error':
			return <AlertTriangle size={size} className="text-[#E06C75] flex-shrink-0" strokeWidth={2.5} />;
		case 'background':
			return <Zap size={size} className="text-[#E5C07B] flex-shrink-0" strokeWidth={2.5} />;
		case 'timeout':
		case 'sleep':
			return <Clock size={size} className="text-[#E5C07B] flex-shrink-0" strokeWidth={2.5} />;
		case 'pattern':
			return <Check size={size} className="text-[#61AFEF] flex-shrink-0" strokeWidth={2.5} />;
		case 'running':
		default:
			return null;
	}
};

const ShellStopButton = ({ onClick }: { onClick: () => void }) => (
	<button
		type="button"
		className="flex-shrink-0 w-[22px] h-[22px] rounded-full border border-white/20 flex items-center justify-center opacity-60 hover:opacity-100 hover:border-white/35 hover:bg-white/[0.06] transition-all"
		onClick={(e) => { e.stopPropagation(); onClick(); }}
		title="Stop"
		aria-label="Stop command"
	>
		<Square size={9} className="text-void-fg-2 fill-void-fg-2" strokeWidth={0} />
	</button>
);

const ShellWaitingFooter = ({
	waitingCount,
	onRunInBackground,
}: {
	waitingCount: number;
	onRunInBackground: () => void;
}) => (
	<div className="flex items-center gap-1.5 mt-1.5 px-0.5 text-[11px] text-void-fg-4/70">
		<span>
			Waiting for {waitingCount} command{waitingCount === 1 ? '' : 's'} to finish
		</span>
		<button
			type="button"
			className="text-void-fg-3/80 hover:text-void-fg-2 transition-colors"
			onClick={onRunInBackground}
		>
			Run in background
		</button>
	</div>
);

export const ShellToolCard = ({ toolMessage, threadId }: ShellToolCardProps) => {
	const accessor = useAccessor();
	const terminalToolsService = accessor.get('ITerminalToolService');
	const toolsService = accessor.get('IToolsService');
	const chatThreadsService = accessor.get('IChatThreadService');

	const streamState = useChatThreadsStreamState(threadId);
	const outputRef = useRef<HTMLDivElement>(null);

	const toolName = toolMessage.name as 'Shell' | 'AwaitShell';
	const params = toolMessage.params;

	const isRunning = toolMessage.type === 'running_now';
	const isError = toolMessage.type === 'tool_error';
	const isRejected = toolMessage.type === 'rejected';
	const isSuccess = toolMessage.type === 'success';

	const shellId = useMemo(() => {
		if (toolName === 'Shell') {
			const shellParams = params as ToolMessage<'Shell'>['params'];
			if (toolMessage.type === 'success') {
				const result = toolMessage.result;
				return result.shellId ?? shellParams.shellId;
			}
			return shellParams.shellId;
		}
		return (params as ToolMessage<'AwaitShell'>['params']).shellId;
	}, [toolMessage, params, toolName]);

	const [liveOutput, setLiveOutput] = useState('');
	const [isExpanded, setIsExpanded] = useState(() => !isRunning && (isSuccess || isError));

	const title = useMemo(() => getShellCardTitle(toolName, params), [toolName, params]);
	const metaTags = useMemo(() => getShellCardMetaTags(toolName, params), [toolName, params]);
	const commandLine = useMemo(() => getShellCardCommandLine(toolName, params), [toolName, params]);

	const resultString = useMemo(() => {
		if (toolMessage.type !== 'success') return '';
		return toolsService.stringOfResult[toolName](params as any, toolMessage.result as any);
	}, [toolMessage, params, toolName, toolsService]);

	const outputText = useMemo(() => {
		if (toolMessage.type === 'tool_request') return '';
		return getShellCardOutput(toolMessage, liveOutput, resultString);
	}, [toolMessage, liveOutput, resultString]);

	const statusLine = useMemo(() => {
		if (toolMessage.type === 'tool_request') return null;
		return getShellCardStatus(toolName, toolMessage);
	}, [toolMessage, toolName]);

	const isBlockingAgent = useMemo(() => {
		if (!isRunning || streamState?.isRunning !== 'tool') return false;
		return streamState.toolInfo?.id === toolMessage.id
			&& (streamState.toolInfo?.toolName === 'Shell' || streamState.toolInfo?.toolName === 'AwaitShell');
	}, [isRunning, streamState, toolMessage.id]);

	const showWaitingFooter = isBlockingAgent;
	const showCollapsedRunningBar = isRunning && !isExpanded;
	const hasExpandableContent = !!(commandLine || outputText.trim() || isRunning);

	useEffect(() => {
		if (isSuccess && outputText.trim()) setIsExpanded(true);
	}, [isSuccess, outputText]);

	// Live output polling only while expanded and running
	useEffect(() => {
		if (!isRunning || !isExpanded || !shellId) return;
		if (streamState?.isRunning !== 'tool') return;

		let cancelled = false;
		const poll = async () => {
			try {
				const text = await terminalToolsService.readShell(shellId);
				if (!cancelled) setLiveOutput(text);
			} catch {
				// shell may not be ready yet
			}
		};

		void poll();
		const interval = setInterval(() => { void poll(); }, 450);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [isRunning, isExpanded, shellId, streamState?.isRunning, terminalToolsService]);

	useEffect(() => {
		if (!isRunning || !isExpanded || !outputRef.current) return;
		outputRef.current.scrollTop = outputRef.current.scrollHeight;
	}, [outputText, isRunning, isExpanded]);

	const focusShell = useCallback(() => {
		if (shellId) void terminalToolsService.focusShell(shellId);
	}, [shellId, terminalToolsService]);

	const stopCommand = useCallback(async () => {
		await chatThreadsService.abortRunning(threadId);
	}, [chatThreadsService, threadId]);

	const runInBackground = useCallback(() => {
		chatThreadsService.releaseRunningShellToBackground(threadId);
	}, [chatThreadsService, threadId]);

	if (toolMessage.type === 'tool_request') return null;

	const metaLabel = metaTags.length > 0 ? metaTags.join(', ') : undefined;
	const copyText = [commandLine ? `$ ${commandLine}` : '', outputText].filter(Boolean).join('\n\n');

	const headerTitle = isRunning ? (
		<TextShimmer duration={2.2} spread={2} className="text-[12px] font-medium truncate">
			{title}
		</TextShimmer>
	) : (
		<span className={`text-[12px] font-medium text-void-fg-2/90 truncate ${isRejected ? 'line-through opacity-70' : ''}`}>
			{title}
		</span>
	);

	return (
		<motion.div
			className="w-full"
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.22, ease: 'easeOut' }}
		>
			{/* Collapsed running pill — Cursor default while command is in flight */}
			{showCollapsedRunningBar ? (
				<motion.button
					type="button"
					className="relative w-full overflow-hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-200 text-left"
					onClick={() => setIsExpanded(true)}
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<motion.div
						className="absolute inset-0 z-0 pointer-events-none"
						initial={{ x: '-100%' }}
						animate={{ x: '100%' }}
						transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
						style={{ background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.09), transparent)' }}
					/>
					<div className="relative z-10 flex items-center gap-2 min-w-0 flex-1">
						<Terminal size={13} className="text-void-fg-3/70 flex-shrink-0" strokeWidth={2} />
						<div className="flex items-baseline gap-1.5 min-w-0 flex-1 overflow-hidden">
							{headerTitle}
							{metaLabel && (
								<span className="text-[11px] text-void-fg-4/50 font-mono truncate flex-shrink-0">
									{metaLabel}
								</span>
							)}
						</div>
					</div>
				</motion.button>
			) : (
				<EditToolCardWrapper
					isRunning={isRunning}
					className={`${isRejected ? 'opacity-70' : ''} relative overflow-hidden`}
				>
					{isRunning && (
						<motion.div
							className="absolute inset-0 z-0 pointer-events-none"
							initial={{ x: '-100%' }}
							animate={{ x: '100%' }}
							transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
							style={{ background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.07), transparent)' }}
						/>
					)}

					{/* Header */}
					<div
						className={`relative z-10 flex items-center gap-1.5 px-2.5 py-2 select-none group ${hasExpandableContent ? 'cursor-pointer' : ''}`}
						onClick={hasExpandableContent ? () => setIsExpanded(v => !v) : undefined}
						style={{
							borderBottom: isExpanded && hasExpandableContent
								? '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)'
								: 'none',
							minHeight: '32px',
						}}
					>
						<div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
							{hasExpandableContent && (
								<ChevronRight
									size={10}
									strokeWidth={2.5}
									className={`text-void-fg-4/40 flex-shrink-0 transition-all duration-200 ease-out ${isExpanded ? 'rotate-90 text-void-fg-3/60' : 'opacity-0 group-hover:opacity-100'}`}
								/>
							)}
							{!isExpanded && (
								<Terminal size={13} className="text-void-fg-3/60 flex-shrink-0" strokeWidth={2} />
							)}

							{headerTitle}

							{metaLabel && (
								<span className="text-[11px] text-void-fg-4/50 font-mono truncate flex-shrink-0">
									{metaLabel}
								</span>
							)}
						</div>

						<div className="flex items-center gap-1 flex-shrink-0 ml-auto">
							{copyText && !isRunning && (
								<div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
									<CopyButton codeStr={copyText} toolTipName="Copy output" />
								</div>
							)}
							{shellId && (
								<button
									type="button"
									className="p-0.5 rounded opacity-40 hover:opacity-100 hover:bg-white/5 transition-all"
									onClick={(e) => { e.stopPropagation(); focusShell(); }}
									title="Focus terminal"
								>
									<MoreHorizontal size={14} className="text-void-fg-3" />
								</button>
							)}
							{isRunning && isBlockingAgent && (
								<ShellStopButton onClick={stopCommand} />
							)}
						</div>
					</div>

					{/* Body */}
					<AnimatePresence initial={false}>
						{isExpanded && hasExpandableContent && (
							<motion.div
								key="shell-body"
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: 'auto', opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.2, ease: 'easeOut' }}
								className="relative z-10 overflow-hidden"
							>
								<div
									className="px-0 pb-0"
									style={{ background: 'color-mix(in srgb, var(--vscode-editor-background) 55%, transparent)' }}
								>
									{commandLine && (
										<div className="font-mono text-[12px] leading-[1.55] px-3 pt-2.5 pb-2 border-b border-white/[0.04]">
											<span className="text-void-fg-4 opacity-80 select-none">$ </span>
											<ShellCommandHighlight command={commandLine} />
										</div>
									)}

									{((outputText.trim() && !isRunning) || (isRunning && isExpanded && outputText.trim())) && (
										<div
											ref={outputRef}
											className="font-mono text-[11px] leading-[1.5] px-3 py-2.5 max-h-[280px] overflow-y-auto overflow-x-auto void-custom-scrollable"
										>
											{outputText.split('\n').map((line, idx) => (
												<ShellOutputLine key={idx} line={line} />
											))}
										</div>
									)}

									{statusLine && !isRunning && (
										<div
											className="flex items-center gap-1.5 px-3 py-2 border-t border-white/[0.04] text-[11px] text-void-fg-3/80"
											style={{ background: 'color-mix(in srgb, var(--vscode-sideBar-background) 40%, transparent)' }}
										>
											<StatusIcon icon={statusLine.icon} />
											<span>{statusLine.text}</span>
										</div>
									)}

									{isError && typeof toolMessage.result === 'string' && (
										<div className="px-3 py-2 text-[11px] text-[#E06C75]/90 border-t border-white/[0.04]">
											{toolMessage.result}
										</div>
									)}
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</EditToolCardWrapper>
			)}

			{showWaitingFooter && (
				<ShellWaitingFooter waitingCount={1} onRunInBackground={runInBackground} />
			)}
		</motion.div>
	);
};
