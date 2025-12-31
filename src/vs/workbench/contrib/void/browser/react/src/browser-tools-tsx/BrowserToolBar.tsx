/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ChevronsUpDown } from 'lucide-react';
import { ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import {
	BrowserToolName,
	BrowserToolVariant,
	getPrimaryContent,
	hasExpandablePreview,
	getMetaInfo,
	getToolTitle,
	getVariantBorderColor,
} from './BrowserToolHelpers.js';
import { BrowserToolStateIndicator } from './BrowserToolStates.js';
import { BrowserToolPreview } from './BrowserToolPreview.js';
import { CopyButton } from '../markdown/ApplyBlockHoverButtons.js';
import { useAccessor } from '../util/services.js';

interface BrowserToolBarProps<T extends BrowserToolName> {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>;
	variant: BrowserToolVariant;
}

export function BrowserToolBar<T extends BrowserToolName>({
	toolMessage,
	variant,
}: BrowserToolBarProps<T>) {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService');

	const [isExpanded, setIsExpanded] = useState(false);

	const { name, type } = toolMessage;

	// Auto-collapse when state changes from success
	useEffect(() => {
		if (type !== 'success') {
			setIsExpanded(false);
		}
	}, [type]);

	// Memoized content extraction
	const primaryContent = useMemo(() => getPrimaryContent(toolMessage), [toolMessage]);
	const metaInfo = useMemo(() => getMetaInfo(toolMessage), [toolMessage]);
	const canExpand = useMemo(() => hasExpandablePreview(toolMessage), [toolMessage]);
	const title = useMemo(() => getToolTitle(name), [name]);

	// Don't render for tool_request
	if (type === 'tool_request') return null;

	// Get border color based on variant
	const variantBorderClass = getVariantBorderColor(variant);

	// Determine if we should show the shimmer animation
	const isRunning = type === 'running_now';
	const isError = type === 'tool_error';
	const isSuccess = type === 'success';
	const isRejected = type === 'rejected';

	// Get URL for navigation tools
	const url = useMemo(() => {
		if (type === 'success') {
			const result = toolMessage.result as any;
			if (name === 'browser_navigate' || name === 'browser_get_url') {
				return result.url;
			}
		}
		if (name === 'browser_navigate') {
			return (toolMessage.params as any).url;
		}
		return null;
	}, [toolMessage, name, type]);

	// Get copyable content
	const copyableContent = useMemo(() => {
		if (type === 'success') {
			const result = toolMessage.result as any;
			switch (name) {
				case 'browser_navigate':
				case 'browser_get_url':
					return result.url;
				case 'browser_screenshot':
					return result.base64;
				case 'browser_get_content':
					return result.html;
				case 'browser_extract_text':
					return result.text;
				case 'browser_evaluate':
					return typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2);
				default:
					return primaryContent;
			}
		}
		if (type === 'rejected' && name === 'browser_navigate') {
			return (toolMessage.params as any).url;
		}
		return primaryContent;
	}, [toolMessage, name, type, primaryContent]);

	return (
		<div className="w-full relative group">
			{/* Main horizontal bar */}
			<motion.div
				className={`
					relative overflow-hidden
					flex flex-row items-center gap-2.5 px-3 py-1.5 rounded-lg
					border border-white/5 bg-white/[0.03]
					hover:border-white/10 hover:bg-white/[0.05] transition-all duration-200 ease-out
					${isSuccess ? 'border-blue-500/20 bg-blue-500/[0.04]' : ''}
					${isRunning ? 'border-blue-400/30 bg-blue-400/[0.06]' : ''}
					${isError ? 'border-red-500/20 bg-red-500/[0.04]' : ''}
				`}
				initial={{ opacity: 0, y: 5 }}
				animate={{
					opacity: 1,
					y: 0,
					borderColor: isRunning ? 'rgba(59, 130, 246, 0.5)' : isSuccess ? 'rgba(59, 130, 246, 0.3)' : isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)',
				}}
				transition={{
					duration: 0.2,
					borderColor: isRunning ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.2 }
				}}
			>
				{/* Shimmer Effect for Running State */}
				{isRunning && (
					<>
						<motion.div
							className="absolute inset-0 z-0"
							initial={{ x: '-100%' }}
							animate={{ x: '100%' }}
							transition={{
								repeat: Infinity,
								duration: 2,
								ease: 'linear',
							}}
							style={{
								background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
							}}
						/>
						<motion.div
							className="absolute inset-0 z-0"
							initial={{ opacity: 0 }}
							animate={{ opacity: [0.03, 0.08, 0.03] }}
							transition={{
								repeat: Infinity,
								duration: 2,
								ease: 'easeInOut',
							}}
							style={{
								backgroundColor: 'rgba(59, 130, 246, 1)',
							}}
						/>
					</>
				)}

				{/* Tool Icon */}
				<div className="flex-shrink-0 opacity-70 relative z-10 flex items-center justify-center w-5">
					{name === 'browser_navigate' ? (
						<ExternalLink size={14} className="text-blue-400" />
					) : (
						<BrowserToolStateIndicator toolMessage={toolMessage} variant={variant} />
					)}
				</div>

				{/* Title and Content Container */}
				<div className="flex flex-row items-baseline gap-2 flex-1 min-w-0 relative z-10 overflow-hidden">
					<span className="text-[12px] text-void-fg-2 font-semibold whitespace-nowrap opacity-90 flex-shrink-0">
						{title}
					</span>

					{primaryContent && (
						<span
							className="text-[12px] text-void-fg-3 truncate hover:text-blue-400 hover:underline cursor-pointer opacity-80 flex-1 min-w-0"
							title={primaryContent}
							onClick={() => {
								if (url) {
									commandService.executeCommand('simpleBrowser.show', url);
								}
							}}
						>
							{primaryContent}
						</span>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2 flex-shrink-0 relative z-10 ml-auto">
					{/* Meta info */}
					{metaInfo && (
						<span className="text-[10px] text-void-fg-4 font-mono opacity-40 whitespace-nowrap hidden sm:inline">
							{metaInfo}
						</span>
					)}

					{/* Copy button */}
					{copyableContent && (
						<div className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity">
							<CopyButton
								codeStr={copyableContent}
								toolTipName={
									name === 'browser_screenshot'
										? 'Copy base64'
										: name === 'browser_get_content'
										? 'Copy HTML'
										: 'Copy content'
								}
							/>
						</div>
					)}

					{/* Expand button (only if tool has preview) */}
					{canExpand && (
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className={`p-1 rounded-md transition-all opacity-40 hover:opacity-100 ${isExpanded ? 'bg-white/10 opacity-100' : 'hover:bg-white/5'}`}
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
						>
							<ChevronsUpDown size={12} className="text-void-fg-3" />
						</button>
					)}
				</div>
			</motion.div>

			{/* Expandable preview section */}
			{canExpand && isExpanded && (
				<BrowserToolPreview toolMessage={toolMessage} isExpanded={isExpanded} />
			)}
		</div>
	);
}
