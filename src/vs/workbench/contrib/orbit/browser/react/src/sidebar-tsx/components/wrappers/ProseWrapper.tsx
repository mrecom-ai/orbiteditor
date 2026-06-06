/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const ProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div
		className='
			text-void-fg-1
			prose prose-sm
			text-[13px]
			leading-[1.55]
			break-words
			min-w-0
			max-w-none

			[&>:first-child]:!mt-0
			[&>:last-child]:!mb-0

			prose-p:block
			prose-p:leading-[1.55]
			prose-p:my-2

			prose-h1:text-[15px]
			prose-h1:font-semibold
			prose-h1:my-3.5
			prose-h1:leading-snug
			prose-h1:text-void-fg-1

			prose-h2:text-[15px]
			prose-h2:font-semibold
			prose-h2:my-3
			prose-h2:leading-snug
			prose-h2:text-void-fg-1

			prose-h3:text-[14px]
			prose-h3:font-semibold
			prose-h3:my-2.5
			prose-h3:leading-snug
			prose-h3:text-void-fg-1

			prose-h4:text-[13px]
			prose-h4:font-medium
			prose-h4:my-2
			prose-h4:leading-snug
			prose-h4:text-void-fg-2

			prose-hr:my-3.5
			prose-hr:border-void-border-3/30

			prose-pre:my-2.5
			prose-pre:bg-transparent
			prose-pre:p-0
			prose-pre:border-0

			marker:text-void-fg-4

			prose-ol:list-outside
			prose-ol:list-decimal
			prose-ol:leading-[1.55]
			prose-ol:my-2.5
			prose-ol:pl-[1.35rem]
			prose-ol:space-y-2

			prose-ul:list-outside
			prose-ul:list-disc
			prose-ul:leading-[1.55]
			prose-ul:my-2.5
			prose-ul:pl-[1.35rem]
			prose-ul:space-y-2

			prose-li:my-0
			prose-li:pl-0.5
			prose-li:leading-[1.55]

			prose-code:before:content-none
			prose-code:after:content-none

			[&_.orbit-file-link]:!cursor-pointer
			[&_strong_.orbit-file-link]:!font-semibold

			prose-a:text-[var(--vscode-textLink-foreground,var(--void-link-color))]
			prose-a:underline
			prose-a:decoration-[color-mix(in_srgb,var(--vscode-textLink-foreground,#3794ff)_35%,transparent)]
			prose-a:underline-offset-2
			prose-a:font-normal
			prose-a:cursor-pointer
			hover:prose-a:decoration-[var(--vscode-textLink-foreground,var(--void-link-color))]

			prose-blockquote:border-l-[3px]
			prose-blockquote:border-l-void-border-1/50
			prose-blockquote:pl-4
			prose-blockquote:my-2.5
			prose-blockquote:py-0.5
			prose-blockquote:italic
			prose-blockquote:text-void-fg-2

			prose-table:my-2.5
			prose-table:text-[13px]
			prose-table:border-collapse

			prose-strong:font-semibold
			prose-strong:text-void-fg-1

			prose-em:italic
		'
		style={{
			fontFamily: 'var(--vscode-font-family)',
			fontSize: 'var(--vscode-font-size, 13px)',
		}}
	>
		{children}
	</div>
}