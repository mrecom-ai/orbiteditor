/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const ProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div className='
text-void-fg-1
prose
prose-sm
text-[14px]
break-words

[&>:first-child]:!mt-0
[&>:last-child]:!mb-0

prose-p:block
prose-p:leading-[1.6]
prose-p:my-2.5

prose-h1:text-[18px]
prose-h1:font-semibold
prose-h1:my-4
prose-h1:leading-tight
prose-h1:text-void-fg-1

prose-h2:text-[16px]
prose-h2:font-semibold
prose-h2:my-3.5
prose-h2:leading-tight
prose-h2:text-void-fg-1

prose-h3:text-[14px]
prose-h3:font-semibold
prose-h3:my-3
prose-h3:leading-tight
prose-h3:text-void-fg-1

prose-h4:text-[13px]
prose-h4:font-medium
prose-h4:my-2.5
prose-h4:leading-tight
prose-h4:text-void-fg-2

prose-hr:my-4
prose-hr:border-void-border-3/30

prose-pre:my-3
prose-pre:bg-void-bg-2-alt/40
prose-pre:border
prose-pre:border-void-border-3/25
prose-pre:rounded-md
prose-pre:text-[12px]
prose-pre:overflow-x-auto

marker:text-inherit

prose-ol:list-outside
prose-ol:list-decimal
prose-ol:leading-[1.6]
prose-ol:my-2.5
prose-ol:pl-5

prose-ul:list-outside
prose-ul:list-disc
prose-ul:leading-[1.6]
prose-ul:my-2.5
prose-ul:pl-5

prose-li:my-1
prose-li:pl-1

prose-code:before:content-none
prose-code:after:content-none
prose-code:text-void-fg-1
prose-code:bg-void-bg-2-alt/35
prose-code:px-1.5
prose-code:py-0.5
prose-code:rounded
prose-code:text-[12px]
prose-code:font-medium

prose-blockquote:border-l-[3px]
prose-blockquote:border-l-void-border-1/50
prose-blockquote:pl-4
prose-blockquote:my-3
prose-blockquote:py-0.5
prose-blockquote:italic
prose-blockquote:text-void-fg-2

prose-table:my-3
prose-table:text-[13px]
prose-table:border-collapse

prose-strong:font-semibold
prose-strong:text-void-fg-1

prose-em:italic

max-w-none
overflow-hidden
'
	>
		{children}
	</div>
}
