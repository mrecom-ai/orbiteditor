/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { EditToolExpandableContent } from './EditToolExpandableContent.js';
import { EditToolCardBody } from './EditToolCardBody.js';
import { EditToolInnerContent, EditToolInnerContentProps } from './editToolInnerContent.js';
import { editToolStrings } from './editToolStrings.js';
import { EDIT_TOOL_MIN_VIEWPORT_PX } from './editToolSizing.js';
import { TextShimmer } from '../../../util/TextShimmer.js';

export const EditToolContentPanel = ({
	dependencyKey,
	isStreaming = false,
	hideControls = false,
	hasDisplayableContent,
	isRunning = false,
	innerContent,
	nonInteractive = false,
	children,
}: {
	dependencyKey: string;
	isStreaming?: boolean;
	hideControls?: boolean;
	hasDisplayableContent: boolean;
	isRunning?: boolean;
	innerContent?: Omit<EditToolInnerContentProps, 'maxHeight'>;
	nonInteractive?: boolean;
	/** Custom body renderer (committed path). When provided, overrides innerContent. */
	children?: (maxHeight: number | undefined, reportOverflow: (overflow: boolean) => void) => React.ReactNode;
}) => {
	// LLM-generation streaming and executing/running_now use a fixed-height viewport
	// instead of shrink-to-fit expandable layout. Shrink-to-fit let the body
	// collapse to ~0px at the bottom of the chat (header-only bug).
	const useFixedViewport = isStreaming || (isRunning && hideControls);

	if (!hasDisplayableContent) {
		// Committed cards with params present but no renderable body (e.g. empty
		// strReplace strings) should not show a perpetual loading label.
		if (!isRunning && !isStreaming) {
			return null;
		}

		// Compact, content-aware placeholder. Uses the loadingMessage computed by
		// the streaming state (e.g. "Determining file..." vs "Generating code...")
		// so the empty body reflects the actual phase instead of a generic label.
		const message = innerContent?.loadingMessage
			?? (isRunning ? editToolStrings.applyingChanges : editToolStrings.preparingPreview);
		return (
			<EditToolCardBody isStreaming={isStreaming}>
				<div
					className="edit-tool-streaming-view px-2.5 py-2.5 text-void-fg-4/55 text-[10px] flex items-center gap-1.5"
					style={{
						minHeight: `${EDIT_TOOL_MIN_VIEWPORT_PX}px`,
						background: 'var(--vscode-editor-background)',
					}}
				>
					<span className="edit-tool-loading-dot" aria-hidden="true" />
					<TextShimmer className="text-[11px] font-medium" duration={1.5}>
						{message}
					</TextShimmer>
				</div>
			</EditToolCardBody>
		);
	}

	return (
		<EditToolCardBody isStreaming={isStreaming}>
			<div className={`${nonInteractive ? 'pointer-events-none select-none' : ''} !select-text cursor-auto`}>
				<EditToolExpandableContent
					dependencyKey={dependencyKey}
					defaultExpandState="expanded"
					isStreaming={isStreaming}
					fixedViewport={useFixedViewport}
					hideControls={hideControls || useFixedViewport}
				>
					{(maxHeight, reportOverflow) => (
						children
							? children(maxHeight, reportOverflow)
							: innerContent
								? (
									<EditToolInnerContent
										{...innerContent}
										maxHeight={maxHeight}
										onOverflowChange={reportOverflow}
									/>
								)
								: null
					)}
				</EditToolExpandableContent>
			</div>
		</EditToolCardBody>
	);
};
