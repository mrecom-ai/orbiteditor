/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';

const splitStreamingLines = (content: string): string[] => {
	if (!content) {
		return [];
	}
	return content.split('\n');
};

export const StreamingCodeView = ({ content, isStreaming = true, emptyLabel }: { content: string; isStreaming?: boolean; emptyLabel?: string }) => {
	const lines = useMemo(() => splitStreamingLines(content), [content]);
	const resolvedEmptyLabel = isStreaming ? (emptyLabel ?? 'Generating code...') : emptyLabel;

	return (
		<div
			className="edit-tool-streaming-view font-mono text-[11px] leading-[1.55]"
			style={{
				color: 'var(--vscode-editor-foreground)',
				fontFamily: 'var(--vscode-editor-font-family, var(--monaco-monospace-font, monospace))',
				background: 'var(--vscode-editor-background)',
			}}
		>
			{lines.map((line, index) => (
				<div
					key={index}
					className="px-2.5 py-px whitespace-pre"
					style={{
						animation: isStreaming && index === lines.length - 1 ? 'edit-tool-line-fade-in 180ms ease-out' : undefined,
					}}
				>
					{line}
					{isStreaming && index === lines.length - 1 && (
						<span className="unified-diff-streaming-cursor" aria-hidden="true" />
					)}
				</div>
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
