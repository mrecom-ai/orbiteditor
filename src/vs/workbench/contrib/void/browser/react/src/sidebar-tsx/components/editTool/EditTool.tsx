/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ToolMessage } from '../../../../../../common/chatThreadServiceTypes.js';
import { ToolName } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { EditToolCardWrapper } from './EditToolCardWrapper.js';
import { EditToolCardHeader } from './EditToolCardHeader.js';
import { EditToolCardContent } from './EditToolCardContent.js';
import { EditToolErrorMessage } from './EditToolErrorMessage.js';

type WrapperProps<T extends ToolName> = {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>,
	messageIdx: number,
	threadId: string
}

export const EditTool = React.memo(({
	toolMessage,
	threadId,
	messageIdx,
	content,
	hasValidContent: hasValidContentProp
}: WrapperProps<'edit_file' | 'rewrite_file'> & {
	content: string,
	hasValidContent?: boolean
}) => {
	const accessor = useAccessor()

	// More granular state tracking for better UI control
	const isAwaiting = toolMessage.type === 'tool_request'
	const isExecuting = toolMessage.type === 'running_now'
	const isRunning = isAwaiting || isExecuting
	const isRejected = toolMessage.type === 'rejected'
	const isError = toolMessage.type === 'tool_error'
	const isSuccess = toolMessage.type === 'success'

	const editToolType = toolMessage.name === 'edit_file' ? 'diff' : 'rewrite'
	const params = toolMessage.params
	// Use prop if provided, otherwise compute from content
	const hasContent = hasValidContentProp ?? !!(content && content.trim().length > 0)

	// Collapse/expand state - start expanded, keep expanded during streaming
	const [isExpanded, setIsExpanded] = useState(true);

	// Auto-expand when content appears
	useEffect(() => {
		if (hasContent) {
			setIsExpanded(true);
		}
	}, [hasContent]);

	// Always render the card wrapper to ensure consistent appearance
	// even when params or content are not yet available
	return (
		<EditToolCardWrapper
			isRunning={isRunning}
			className={isRejected ? 'opacity-70' : ''}
		>
			<EditToolCardHeader
				toolMessage={toolMessage}
				isRunning={isRunning}
				threadId={threadId}
				messageIdx={messageIdx}
				content={content || ''}
				isExpanded={isExpanded}
				onToggleExpand={() => setIsExpanded(!isExpanded)}
				hasContent={hasContent}
			/>

			{/* Only show content when it exists */}
			{hasContent && (
				<EditToolCardContent
					uri={params?.uri}
					code={content || ''}
					type={editToolType}
					isExpanded={isExpanded}
				/>
			)}

		{/* Error handling - always show errors, even when collapsed */}
		{toolMessage.type === 'tool_error' && (
			<EditToolErrorMessage
				error={toolMessage.result && typeof toolMessage.result === 'string' ? toolMessage.result : 'An error occurred'}
			/>
		)}

			{/* Lint errors - show when content is expanded */}
			{hasContent && isExpanded && (toolMessage.type === 'success' || toolMessage.type === 'rejected') &&
				toolMessage.result?.lintErrors && toolMessage.result.lintErrors.length > 0 && (
				<div className="px-3 py-2.5" style={{
					borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.25)',
					background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.5)'
				}}>
					<div className="flex items-start gap-2 mb-2">
						<AlertTriangle size={11} className="text-yellow-500/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
						<div className="text-void-fg-2 text-[10.5px] font-medium opacity-60">
							Lint Issues ({toolMessage.result.lintErrors.length})
						</div>
					</div>
					<div className="space-y-2 ml-4">
						{toolMessage.result.lintErrors.map((error, i) => (
							<div key={i} className="text-[10px] leading-relaxed">
								<div className="text-void-fg-3/45 mb-0.5">
									Lines {error.startLineNumber}-{error.endLineNumber}
								</div>
								<div className="text-void-warning/75">
									{error.message}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</EditToolCardWrapper>
	)
});
