/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import { BrowserToolName } from './BrowserToolHelpers.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';

interface BrowserToolPreviewProps<T extends BrowserToolName> {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>;
	isExpanded: boolean;
}

// Main preview component that routes to specific preview types
export function BrowserToolPreview<T extends BrowserToolName>({
	toolMessage,
	isExpanded,
}: BrowserToolPreviewProps<T>) {
	const { name, type } = toolMessage;

	if (type !== 'success') return null;

	const result = toolMessage.result as any;

	switch (name) {
		case 'browser_screenshot':
			return (
				<AnimatePresence>
					{isExpanded && <ScreenshotPreview base64={result.base64} />}
				</AnimatePresence>
			);

		case 'browser_get_content':
			return (
				<AnimatePresence>
					{isExpanded && <ContentPreview title={result.title} html={result.html} />}
				</AnimatePresence>
			);

		case 'browser_extract_text':
			return (
				<AnimatePresence>
					{isExpanded && <TextPreview text={result.text} />}
				</AnimatePresence>
			);

		case 'browser_evaluate':
			return (
				<AnimatePresence>
					{isExpanded && <EvaluatePreview result={result.result} />}
				</AnimatePresence>
			);

		default:
			return null;
	}
}

// Screenshot preview with lazy load and fade-in
function ScreenshotPreview({ base64 }: { base64: string }) {
	const [isLoaded, setIsLoaded] = useState(false);

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className="overflow-hidden mt-2"
		>
			<div className="border border-void-border-2 rounded-xl bg-void-bg-2 p-2 shadow-inner">
				<img
					src={`data:image/png;base64,${base64}`}
					alt="Screenshot"
					className={`max-h-[200px] w-auto rounded-lg transition-all duration-500 ease-out ${
						isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
					}`}
					onLoad={() => setIsLoaded(true)}
					loading="lazy"
				/>
				{!isLoaded && (
					<div className="flex items-center justify-center h-[200px]">
						<div className="flex flex-col items-center gap-2">
							<div className="w-5 h-5 border-2 border-void-border-1 border-t-void-fg-1 rounded-full animate-spin opacity-40" />
							<span className="text-[11px] text-void-fg-4 font-medium">Loading preview...</span>
						</div>
					</div>
				)}
			</div>
		</motion.div>
	);
}

// Text preview with truncation and scroll
function TextPreview({ text }: { text: string }) {
	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className="overflow-hidden mt-2"
		>
			<div className="border border-void-border-2 rounded-xl bg-void-bg-2 p-3 max-h-[250px] overflow-y-auto shadow-inner custom-scrollbar">
				<pre className="text-[11px] text-void-fg-3 whitespace-pre-wrap break-words font-mono leading-relaxed opacity-90">
					{text}
				</pre>
			</div>
		</motion.div>
	);
}

// HTML content preview with markdown rendering
function ContentPreview({ title, html }: { title: string; html: string }) {
	const [showRaw, setShowRaw] = useState(false);

	// Create a simplified text representation of the HTML
	const textContent = html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className="overflow-hidden mt-2"
		>
			<div className="border border-void-border-2 rounded-xl bg-void-bg-2 overflow-hidden shadow-inner">
				<div className="flex items-center justify-between px-3 py-1.5 border-b border-void-border-2 bg-void-bg-1/50">
					<span className="text-[11px] text-void-fg-3 font-semibold opacity-80 uppercase tracking-wider">{title}</span>
					<button
						onClick={() => setShowRaw(!showRaw)}
						className="text-[10px] text-void-fg-4 hover:text-void-fg-2 transition-all px-2 py-0.5 rounded-md hover:bg-void-bg-3 border border-transparent hover:border-void-border-2"
					>
						{showRaw ? 'View Reader' : 'View HTML'}
					</button>
				</div>
				<div className="p-3 max-h-[250px] overflow-y-auto custom-scrollbar">
					{showRaw ? (
						<pre className="text-[11px] text-void-fg-3 whitespace-pre-wrap break-words font-mono leading-relaxed opacity-90">
							{html.substring(0, 5000)}
							{html.length > 5000 && '... (truncated)'}
						</pre>
					) : (
						<div className="text-[12px] text-void-fg-3 prose prose-invert prose-sm max-w-none opacity-90">
							{textContent.substring(0, 2000)}
							{textContent.length > 2000 && '... (truncated)'}
						</div>
					)}
				</div>
			</div>
		</motion.div>
	);
}

// Evaluation result preview with JSON formatting
function EvaluatePreview({ result }: { result: unknown }) {
	const formattedResult = React.useMemo(() => {
		try {
			if (result === null) return 'null';
			if (result === undefined) return 'undefined';
			if (typeof result === 'string') return result;
			if (typeof result === 'number' || typeof result === 'boolean') return String(result);
			return JSON.stringify(result, null, 2);
		} catch (error) {
			return String(result);
		}
	}, [result]);

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className="overflow-hidden mt-2"
		>
			<div className="border border-void-border-2 rounded-xl bg-void-bg-2 p-3 max-h-[250px] overflow-y-auto shadow-inner custom-scrollbar">
				<pre className="text-[11px] text-void-fg-3 whitespace-pre-wrap break-words font-mono leading-relaxed opacity-90">
					{formattedResult}
				</pre>
			</div>
		</motion.div>
	);
}
