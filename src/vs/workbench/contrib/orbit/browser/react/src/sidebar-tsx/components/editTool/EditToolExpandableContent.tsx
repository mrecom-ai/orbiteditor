/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type EditToolExpandState = 'collapsed' | 'expanded' | 'full';

/** Compact preview — ~6 lines of code, matches streaming size exactly */
const COLLAPSED_MAX_HEIGHT = 148;
/** Expanded view (only used when user explicitly clicks expand) */
const EXPANDED_MAX_HEIGHT = 380;
/** Streaming preview — expanded by default, scrolls internally */
const STREAMING_MAX_HEIGHT = EXPANDED_MAX_HEIGHT;
/** Full view for large diffs */
const FULL_MAX_HEIGHT = 720;

export const EditToolExpandableContent = ({
	children,
	dependencyKey,
	defaultExpandState = 'collapsed',
	isStreaming = false,
	hideControls = false,
}: {
	children: (maxHeight: number | undefined) => React.ReactNode;
	dependencyKey: string;
	defaultExpandState?: EditToolExpandState;
	isStreaming?: boolean;
	hideControls?: boolean;
}) => {
	const [expandState, setExpandState] = useState<EditToolExpandState>(defaultExpandState);
	const contentRef = useRef<HTMLDivElement>(null);
	const [needsShowMore, setNeedsShowMore] = useState(false);

	const maxHeight = isStreaming
		? STREAMING_MAX_HEIGHT
		: expandState === 'full'
			? FULL_MAX_HEIGHT
			: expandState === 'expanded'
				? EXPANDED_MAX_HEIGHT
				: COLLAPSED_MAX_HEIGHT;

	useEffect(() => {
		let rafId: number | undefined;
		let timeoutId: NodeJS.Timeout | undefined;

		const checkHeight = () => {
			if (!contentRef.current) {
				return;
			}
			const scrollHeight = contentRef.current.scrollHeight;
			const clientHeight = contentRef.current.clientHeight;
			setNeedsShowMore(scrollHeight > clientHeight + 8);
		};

		rafId = requestAnimationFrame(() => {
			checkHeight();
			timeoutId = setTimeout(checkHeight, 150);
		});

		return () => {
			if (rafId !== undefined) {
				cancelAnimationFrame(rafId);
			}
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		};
	}, [dependencyKey, expandState, isStreaming]);

	useEffect(() => {
		if (!isStreaming || !contentRef.current) {
			return;
		}
		contentRef.current.scrollTop = contentRef.current.scrollHeight;
	}, [dependencyKey, isStreaming]);

	const showControls = needsShowMore && !isStreaming;
	const showStreamingFade = isStreaming && needsShowMore;
	const showCompactFade = showControls && expandState === 'collapsed';

	return (
		<>
			<div
				ref={contentRef}
				className={`
					edit-tool-expandable-content relative overflow-y-auto overflow-x-hidden
					${isStreaming ? 'edit-tool-expandable-streaming pointer-events-none select-none' : ''}
				`}
				style={{
					maxHeight: `${maxHeight}px`,
					height: isStreaming || expandState === 'collapsed' ? `${maxHeight}px` : undefined,
					minHeight: `${COLLAPSED_MAX_HEIGHT}px`,
					transition: isStreaming ? undefined : 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
					scrollbarWidth: 'thin',
					scrollbarColor: 'rgba(var(--vscode-void-fg-4-rgb, 128, 128, 128), 0.25) transparent',
				}}
			>
				{children(maxHeight)}
				{(showCompactFade || showStreamingFade) && (
					<div
						className="edit-tool-expandable-fade pointer-events-none absolute inset-x-0 bottom-0 h-8"
						aria-hidden="true"
					/>
				)}
			</div>

			{!hideControls && showControls && (
				<div
					className="flex items-center justify-center gap-2 py-1 px-3"
					style={{
						borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.12)',
						background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.15)',
					}}
				>
					{expandState !== 'full' && (
						<button
							type="button"
							onClick={() => setExpandState(expandState === 'collapsed' ? 'expanded' : 'full')}
							aria-expanded={expandState !== 'collapsed'}
							className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-void-fg-4/55 hover:text-void-fg-4/80 transition-all duration-150 rounded active:scale-[0.97]"
						>
							<ChevronDown
								size={10}
								strokeWidth={2.5}
								className={`transition-transform duration-200 ${expandState === 'expanded' ? 'rotate-180' : ''}`}
							/>
							<span className="font-medium">
								{expandState === 'collapsed' ? 'Show more' : 'Show all'}
							</span>
						</button>
					)}
					{expandState !== 'collapsed' && (
						<button
							type="button"
							onClick={() => setExpandState(expandState === 'full' ? 'expanded' : 'collapsed')}
							aria-expanded={expandState !== 'collapsed'}
							className="px-2 py-0.5 text-[10px] text-void-fg-4/45 hover:text-void-fg-4/70 transition-all duration-150 rounded active:scale-[0.97] font-medium"
						>
							{expandState === 'full' ? 'Show less' : 'Collapse'}
						</button>
					)}
				</div>
			)}
		</>
	);
};
