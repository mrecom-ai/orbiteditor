/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { LintErrorItem } from '../../../../../../common/toolsServiceTypes.js';

export const LintErrorChildren = ({ lintErrors }: { lintErrors: LintErrorItem[] }) => {
	return (
		<div 
			className="text-[10px] text-void-fg-4 opacity-75 px-1.5 py-1 flex flex-col gap-1.5 overflow-x-auto whitespace-nowrap"
			style={{
				borderLeft: '2px solid rgba(var(--vscode-void-fg-4-rgb, 128, 128, 128), 0.3)',
			}}
		>
			{lintErrors.map((error, i) => (
				<div key={i} className="leading-relaxed">
					<span className="text-void-fg-4/40 font-medium">
						Lines {error.startLineNumber}-{error.endLineNumber}:
					</span>{' '}
					<span className="text-void-fg-4/75">
						{error.message}
					</span>
				</div>
			))}
		</div>
	)
}
