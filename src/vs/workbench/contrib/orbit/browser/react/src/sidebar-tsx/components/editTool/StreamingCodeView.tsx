/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { editToolStrings } from './editToolStrings.js';
import { EDIT_TOOL_STREAMING_VIEWPORT_MIN_PX } from './editToolSizing.js';

const splitStreamingLines = (content: string): string[] => {
	if (!content) {
		return [];
	}
	return content.split('\n');
};

// Memoized per line so a streaming chunk only re-renders the tail line whose text
// changed — head lines have stable props and skip reconciliation, turning the
// per-chunk cost from O(total lines) into O(1).
const StreamingCodeLine = React.memo(({ line, animate, wrap }: { line: string; animate: boolean; wrap: boolean }) => (
	<div
		className={`px-2 py-px ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
		style={{ animation: animate ? 'edit-tool-line-fade-in 180ms ease-out' : undefined }}
	>
		{line}
		{animate && <span className="unified-diff-streaming-cursor" aria-hidden="true" />}
	</div>
));

export const StreamingCodeView = ({ content, isStreaming = true, emptyLabel }: { content: string; isStreaming?: boolean; emptyLabel?: string }) => {
	const lines = useMemo(() => splitStreamingLines(content), [content]);
	const resolvedEmptyLabel = isStreaming ? (emptyLabel ?? editToolStrings.generatingCode) : emptyLabel;
	const lastIndex = lines.length - 1;

	return (
		<div
			className="edit-tool-streaming-view font-mono text-[10px] leading-[1.5]"
			style={{
				color: 'var(--vscode-editor-foreground)',
				fontFamily: 'var(--vscode-editor-font-family, var(--monaco-monospace-font, monospace))',
				background: 'var(--vscode-editor-background)',
				minHeight: isStreaming ? `${EDIT_TOOL_STREAMING_VIEWPORT_MIN_PX}px` : undefined,
			}}
		>
			{lines.map((line, index) => (
				<StreamingCodeLine
					key={`line-${index}`}
					line={line}
					animate={isStreaming && index === lastIndex}
					wrap={isStreaming}
				/>
			))}
			{lines.length === 0 && resolvedEmptyLabel && (
				<div className="px-2.5 py-2 text-void-fg-4/50 text-[10px] flex items-center gap-2">
					{isStreaming && <span className="unified-diff-streaming-cursor" aria-hidden="true" />}
					<span>{resolvedEmptyLabel}</span>
				</div>
			)}
		</div>
	);
};
