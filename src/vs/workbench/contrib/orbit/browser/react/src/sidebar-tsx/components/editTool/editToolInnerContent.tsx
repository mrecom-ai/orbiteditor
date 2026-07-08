/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { VoidDiffEditor } from '../../../util/inputs.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { UnifiedDiffView } from './UnifiedDiffView.js';
import { StreamingCodeView } from './StreamingCodeView.js';
import { EditToolContentType } from './editToolDisplayData.js';
import { editToolStrings } from './editToolStrings.js';
import { EDIT_TOOL_MIN_VIEWPORT_PX } from './editToolSizing.js';
import { TextShimmer } from '../../../util/TextShimmer.js';

export type EditToolInnerPhase = 'content' | 'empty-write' | 'loading';

export type EditToolInnerContentProps = {
	uri?: URI;
	maxHeight?: number;
	type: EditToolContentType;
	code: string;
	oldString?: string;
	newString?: string;
	phase?: EditToolInnerPhase;
	loadingMessage?: string;
	/** Show unified diff (post-stream or committed) */
	showDiff?: boolean;
	/** Show plain streaming code instead of diff */
	useStreamingCode?: boolean;
	streamingText?: string;
	isStreamingCode?: boolean;
	/** Reported by internally-scrolling children (Monaco diff) when content exceeds maxHeight */
	onOverflowChange?: (overflow: boolean) => void;
};

export const EditToolInnerContent = ({
	uri,
	maxHeight,
	type,
	code,
	oldString,
	newString,
	phase = 'content',
	loadingMessage,
	showDiff = false,
	useStreamingCode = false,
	streamingText = '',
	isStreamingCode = false,
	onOverflowChange,
}: EditToolInnerContentProps) => {
	if (phase === 'loading') {
		return (
			<div
				className="edit-tool-streaming-view text-void-fg-4/55 text-[11px] py-2.5 px-2.5 flex items-center gap-1.5"
				style={{
					minHeight: `${EDIT_TOOL_MIN_VIEWPORT_PX}px`,
					background: 'var(--vscode-editor-background)',
				}}
			>
				<span className="edit-tool-loading-dot" aria-hidden="true" />
				<TextShimmer className="font-medium" duration={1.5}>
					{loadingMessage ?? editToolStrings.generatingCode}
				</TextShimmer>
			</div>
		);
	}

	if (phase === 'empty-write') {
		return <StreamingCodeView content="" isStreaming={isStreamingCode} emptyLabel={editToolStrings.emptyFile} />;
	}

	if (useStreamingCode) {
		return <StreamingCodeView content={streamingText} isStreaming={isStreamingCode} />;
	}

	const hasStrReplaceDiffContent = type === 'strReplace'
		&& (oldString !== undefined || newString !== undefined)
		&& ((oldString?.length ?? 0) > 0 || (newString?.length ?? 0) > 0);

	if (showDiff || hasStrReplaceDiffContent) {
		return (
			<UnifiedDiffView
				uri={uri}
				oldString={oldString ?? ''}
				newString={newString ?? ''}
				maxHeight={maxHeight}
				onOverflowChange={onOverflowChange}
				isComplete={!isStreamingCode}
			/>
		);
	}

	if (type === 'rewrite' && newString !== undefined) {
		if (newString.length === 0) {
			return <StreamingCodeView content="" isStreaming={false} emptyLabel={editToolStrings.emptyFile} />;
		}
		return (
			<UnifiedDiffView
				uri={uri}
				oldString=""
				newString={newString}
				maxHeight={maxHeight}
				onOverflowChange={onOverflowChange}
				isComplete={!isStreamingCode}
			/>
		);
	}

	if (type === 'strReplace' && oldString !== undefined && newString === undefined) {
		return <StreamingCodeView content={oldString} isStreaming={isStreamingCode} />;
	}

	if (type === 'legacy-diff') {
		if (useStreamingCode || isStreamingCode) {
			return <StreamingCodeView content={streamingText || code} isStreaming={isStreamingCode} />;
		}
		if (uri && code.trim().length > 0) {
			return (
				<div style={{
					maxWidth: '100%',
					overflowX: 'auto',
					scrollBehavior: 'smooth',
				}}>
					<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
				</div>
			);
		}
		return <StreamingCodeView content={code} isStreaming={false} />;
	}

	return (
		<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
	);
};

export const hasEditToolDisplayableContent = (
	type: EditToolContentType,
	code: string,
	oldString?: string,
	newString?: string,
): boolean => {
	if (type === 'rewrite') {
		return newString !== undefined;
	}
	if (type === 'strReplace') {
		return (oldString !== undefined && oldString.length > 0)
			|| (newString !== undefined && newString.length > 0);
	}
	if (type === 'legacy-diff') {
		return !!(code && code.length > 0);
	}
	return !!(code && code.trim().length > 0);
};