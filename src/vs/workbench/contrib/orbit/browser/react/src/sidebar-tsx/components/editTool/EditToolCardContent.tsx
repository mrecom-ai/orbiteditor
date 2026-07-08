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
import { EditToolContentPanel } from './EditToolContentPanel.js';
import { editToolStrings } from './editToolStrings.js';

/**
 * Renders the inner body for a committed edit-tool card.
 *
 * Delegates the viewport/expand/empty-state concerns to the shared
 * `EditToolContentPanel`, and only specializes the `renderInner` switch for
 * the committed (post-stream) content shapes. Keeping the committed and
 * streaming paths on the same panel is what prevents the two from drifting
 * (different dependency keys, different empty labels, different min heights).
 */
export const EditToolCardContent = ({ uri, code, type, oldString, newString, isRunning }: {
	uri: URI | undefined,
	code: string,
	type: EditToolContentType,
	oldString?: string,
	newString?: string,
	isRunning?: boolean,
}) => {
	const dependencyKey = `${type}:${code.length}:${oldString?.length ?? 0}:${newString?.length ?? 0}:${isRunning}`;

	const hasDisplayableContent = type === 'rewrite'
		? newString !== undefined
		: !!(code && code.trim().length > 0) || (type === 'strReplace' && oldString !== undefined && oldString.length > 0);

	const renderInner = (maxHeight: number | undefined, reportOverflow: ((overflow: boolean) => void) | undefined) => {
		if (type === 'strReplace' && oldString !== undefined && newString !== undefined) {
			return (
				<UnifiedDiffView
					uri={uri}
					oldString={oldString}
					newString={newString}
					maxHeight={maxHeight}
					isComplete={!isRunning}
					onOverflowChange={reportOverflow}
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
					isComplete={!isRunning}
					onOverflowChange={reportOverflow}
				/>
			);
		}

		if (type === 'legacy-diff' && uri) {
			return (
				<div style={{
					maxWidth: '100%',
					overflowX: 'auto',
					scrollBehavior: 'smooth'
				}}>
					<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
				</div>
			);
		}

		return (
			<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
		);
	};

	return (
		<EditToolContentPanel
			dependencyKey={dependencyKey}
			isStreaming={false}
			hideControls={false}
			hasDisplayableContent={hasDisplayableContent}
			isRunning={isRunning}
			innerContent={{
				uri,
				type,
				code,
				oldString,
				newString,
				phase: 'content',
				loadingMessage: editToolStrings.applyingChanges,
				showDiff: false,
				useStreamingCode: false,
				streamingText: '',
				isStreamingCode: false,
			}}
		>
			{renderInner}
		</EditToolContentPanel>
	);
}
