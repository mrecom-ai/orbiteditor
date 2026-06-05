/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { VoidDiffEditor, StrReplaceDiffEditor } from '../../../util/inputs.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { SmallProseWrapper } from '../wrappers/SmallProseWrapper.js';

export type EditToolContentType = 'strReplace' | 'legacy-diff' | 'rewrite'

export const EditToolCardContent = ({ uri, code, type, isExpanded, oldString, newString }: {
	uri: URI | undefined,
	code: string,
	type: EditToolContentType,
	isExpanded: boolean,
	oldString?: string,
	newString?: string,
}) => {
	const [showFullContent, setShowFullContent] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const [needsShowMore, setNeedsShowMore] = useState(false);

	useEffect(() => {
		if (!isExpanded) {
			setNeedsShowMore(false)
			return
		}

		let rafId: number | undefined
		let timeoutId: NodeJS.Timeout | undefined

		const checkHeight = () => {
			if (contentRef.current) {
				const scrollHeight = contentRef.current.scrollHeight
				const clientHeight = contentRef.current.clientHeight
				const needsMore = scrollHeight > clientHeight + 10
				setNeedsShowMore(prev => prev !== needsMore ? needsMore : prev)
			}
		}

		rafId = requestAnimationFrame(() => {
			checkHeight()
			timeoutId = setTimeout(checkHeight, 150)
		})

		return () => {
			if (rafId !== undefined) cancelAnimationFrame(rafId)
			if (timeoutId !== undefined) clearTimeout(timeoutId)
		}
	}, [code, oldString, newString, isExpanded]);

	if (!isExpanded) {
		return null;
	}

	if (!code || code.trim().length === 0) {
		if (type !== 'strReplace' || !oldString) {
			return null;
		}
	}

	return (
		<>
			<div
				ref={contentRef}
				className={`
					cursor-default select-none overflow-hidden
					${showFullContent ? 'max-h-[600px] overflow-y-auto' : 'max-h-[200px]'}
				`}
				style={{
					transition: 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
					scrollbarWidth: 'thin',
					scrollbarColor: 'rgba(var(--vscode-void-fg-3-rgb, 128, 128, 128), 0.3) transparent'
				}}
			>
				<div className='px-2.5 min-w-full py-1.5'>
					<div className='!select-text cursor-auto'>
						<div style={{
							overflow: 'hidden',
							maxWidth: '100%',
							contain: 'layout style paint'
						}}>
							<SmallProseWrapper>
								{type === 'strReplace' && uri && oldString !== undefined && newString !== undefined ? (
									<div style={{
										maxWidth: '100%',
										overflowX: 'auto',
										scrollBehavior: 'smooth'
									}}>
										<StrReplaceDiffEditor uri={uri} oldString={oldString} newString={newString} />
									</div>
								) : type === 'legacy-diff' && uri ? (
									<div style={{
										maxWidth: '100%',
										overflowX: 'auto',
										scrollBehavior: 'smooth'
									}}>
										<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
									</div>
								) : (
									<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
								)}
							</SmallProseWrapper>
						</div>
					</div>
				</div>
			</div>

			{needsShowMore && (
				<div
					className="flex items-center justify-center py-1 px-3"
					style={{
						borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)',
						animation: 'fadeIn 200ms ease-out',
						background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.2)'
					}}
				>
					<button
						onClick={() => setShowFullContent(!showFullContent)}
						className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-void-fg-3/50 hover:text-void-fg-3/75 transition-all duration-150 rounded active:scale-[0.96]"
					>
						<ChevronRight
							size={9}
							strokeWidth={2.5}
							className={`transition-transform duration-250 ease-out ${showFullContent ? 'rotate-[-90deg]' : 'rotate-90'}`}
						/>
						<span className="font-medium">{showFullContent ? 'Show less' : 'Show more'}</span>
					</button>
				</div>
			)}
		</>
	)
}
