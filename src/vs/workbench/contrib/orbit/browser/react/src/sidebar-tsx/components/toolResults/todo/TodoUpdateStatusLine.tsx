/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Check } from 'lucide-react';
import { TextShimmer } from '../../../../util/TextShimmer.js';
import { getStreamingTodoTitle, TodoUpdatePresentation } from './todoLabels.js';

type TodoUpdateStatusLineProps = {
	presentation: TodoUpdatePresentation;
	isStreaming?: boolean;
};

export const TodoUpdateStatusLine = ({ presentation, isStreaming = false }: TodoUpdateStatusLineProps) => {
	const titleText = isStreaming ? getStreamingTodoTitle(presentation) : presentation.title;
	const title = isStreaming
		? <TextShimmer duration={2.5} spread={2}>{titleText}</TextShimmer>
		: titleText;

	return (
		<div className="flex flex-row items-center gap-1 my-0.5 select-none text-[12px] text-void-fg-3">
			<span className="flex-shrink-0 opacity-70 whitespace-nowrap">{title}</span>
			{presentation.showCheck && presentation.subtitle && (
				<>
					<Check
						className="flex-shrink-0 opacity-70"
						size={12}
						style={{ color: 'var(--vscode-charts-green)' }}
						strokeWidth={2.5}
					/>
					<span className="truncate opacity-50 ml-0.5" style={{ color: 'var(--vscode-foreground)' }}>
						{presentation.subtitle}
					</span>
				</>
			)}
			{!presentation.showCheck && presentation.subtitle && (
				<span className="truncate opacity-50 ml-1">{presentation.subtitle}</span>
			)}
		</div>
	);
};
