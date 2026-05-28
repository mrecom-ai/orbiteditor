/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

type ToolChildrenWrapperProps = {
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	allowTextSelection?: boolean;
	disableOverflowY?: boolean;
	disableMaxHeight?: boolean;
}

export const ToolChildrenWrapper = ({
	children,
	className,
	contentClassName,
	allowTextSelection = false,
	disableOverflowY = false,
	disableMaxHeight = false,
}: ToolChildrenWrapperProps) => {
	return <div className={`${className ?? ''} cursor-default ${allowTextSelection ? 'select-text' : 'select-none'} ${disableOverflowY ? '' : 'overflow-y-auto'} ${disableMaxHeight ? '' : 'max-h-[300px]'}`}>
		<div className={`${contentClassName ?? 'px-2'} min-w-full`}>
			{children}
		</div>
	</div>
}
