/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const EditToolErrorMessage = ({ error }: { error: string }) => {
	// Clean up error message for concise display
	const cleanError = error
		.replace(/^Error:\s*Error:\s*/i, '') // Remove duplicate "Error: Error:" prefix
		.replace(/^Error:\s*/i, '') // Remove "Error: " prefix
		.split('\n')[0] // Take only the first line
		.replace(/,?\s*but there was no match for:.*$/i, '') // Remove verbose match details
		.replace(/\.\s*Ensure[^]*$/i, '.') // Remove suggestions
		.trim();

	// Truncate if still too long (keep it to ~100 chars max)
	const displayError = cleanError.length > 100
		? cleanError.substring(0, 100) + '...'
		: cleanError;

	return (
		<div
			className="px-2.5 py-1.5"
			style={{
				borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)',
				background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.25)'
			}}
		>
			<div className="flex items-center gap-2">
				<AlertTriangle
					size={11}
					className="text-void-fg-3 flex-shrink-0 opacity-50"
					strokeWidth={2}
				/>
				<div className="text-void-fg-3 text-[10px] opacity-80 truncate">
					{displayError}
				</div>
			</div>
		</div>
	)
}
