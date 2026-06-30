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

export const EditToolContentPanel = ({
	dependencyKey,
	isStreaming = false,
	hideControls = false,
	hasDisplayableContent,
	isRunning = false,
	innerContent,
	nonInteractive = false,
}: {
	dependencyKey: string;
	isStreaming?: boolean;
	hideControls?: boolean;
	hasDisplayableContent: boolean;
	isRunning?: boolean;
	innerContent: Omit<EditToolInnerContentProps, 'maxHeight'>;
	nonInteractive?: boolean;
}) => {
	// LLM-generation streaming and executing/running_now use a fixed-height viewport
	// instead of shrink-to-fit expandable layout. Shrink-to-fit let the body
	// collapse to ~0px at the bottom of the chat (header-only bug).
	const useFixedViewport = isStreaming || (isRunning && hideControls);

	if (!hasDisplayableContent) {
		return (
			<EditToolCardBody isStreaming={isStreaming}>
				<div
					className="px-2.5 py-2 text-void-fg-4/60 text-[10px] animate-pulse flex items-center"
					style={{ minHeight: `${EDIT_TOOL_MIN_VIEWPORT_PX}px` }}
				>
					{isRunning ? editToolStrings.applyingChanges : editToolStrings.preparingPreview}
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
						<EditToolInnerContent
							{...innerContent}
							maxHeight={maxHeight}
							onOverflowChange={reportOverflow}
						/>
					)}
				</EditToolExpandableContent>
			</div>
		</EditToolCardBody>
	);
};
