/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const EditToolErrorMessage = ({ error }: { error: string }) => {
	// Parse error message to extract and format code snippets
	const [mainError, setMainError] = useState<string>('')
	const [codeSnippet, setCodeSnippet] = useState<string | null>(null)
	const [suggestion, setSuggestion] = useState<string | null>(null)

	useEffect(() => {
		// Remove duplicate "Error: Error:" prefix
		let cleanError = error.replace(/^Error:\s*Error:\s*/i, 'Error: ')

		// Remove "Error: " prefix for cleaner display
		cleanError = cleanError.replace(/^Error:\s*/i, '')

		// Extract code snippet if pattern matches "no match for: "..."
		const codeMatch = cleanError.match(/no match for:\s*"([^"]+)"/)
		if (codeMatch) {
			const rawCode = codeMatch[1]
			// Convert \n to actual newlines and handle other escape sequences
			const formattedCode = rawCode
				.replace(/\\n/g, '\n')
				.replace(/\\t/g, '\t')
				.replace(/\\"/g, '"')
			setCodeSnippet(formattedCode)

			// Remove the code snippet from main error
			cleanError = cleanError.replace(/,?\s*but there was no match for:\s*"[^"]+"/i, '')
		}

		// Extract suggestion text (everything after "Ensure" or similar patterns)
		const suggestionMatch = cleanError.match(/\.\s*(Ensure[^]*$)/)
		if (suggestionMatch) {
			setSuggestion(suggestionMatch[1].trim())
			cleanError = cleanError.replace(/\.\s*Ensure[^]*$/i, '.')
		}

		setMainError(cleanError.trim())
	}, [error])

	return (
		<div className="px-3 py-2.5" style={{
			borderTop: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.25)',
			background: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.5)'
		}}>
			{/* Error icon and main message */}
			<div className="flex items-start gap-2">
				<AlertTriangle size={12} className="text-void-warning flex-shrink-0 mt-0.5 opacity-60" strokeWidth={2} />
				<div className="flex-1 min-w-0">
					<div className="text-void-warning text-[10.5px] leading-relaxed opacity-85">
						{mainError}
					</div>
				</div>
			</div>

			{/* Code snippet that failed to match */}
			{codeSnippet && (
				<div className="mt-2.5 ml-4">
					<div className="text-void-fg-3/50 text-[9px] mb-1 uppercase tracking-wider font-medium">
						Code that failed to match:
					</div>
					<div className="bg-void-bg-1/25 rounded px-2 py-1.5 overflow-x-auto" style={{ border: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.15)' }}>
						<pre className="text-void-fg-2/80 text-[10px] leading-[1.5] whitespace-pre font-mono">
{codeSnippet}
						</pre>
					</div>
				</div>
			)}

			{/* Suggestion */}
			{suggestion && (
				<div className="mt-2.5 ml-4 flex items-start gap-1.5">
					<Info size={10} className="text-void-fg-3 flex-shrink-0 mt-0.5 opacity-40" strokeWidth={2} />
					<div className="text-void-fg-3 text-[10px] leading-relaxed opacity-60">
						{suggestion}
					</div>
				</div>
			)}
		</div>
	)
}
