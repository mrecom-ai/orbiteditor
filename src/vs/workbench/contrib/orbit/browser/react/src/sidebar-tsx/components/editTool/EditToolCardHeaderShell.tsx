/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const EditToolCardHeaderShell = ({
	children,
	rightSlot,
	isAwaitingApproval = false,
}: {
	children: React.ReactNode;
	rightSlot?: React.ReactNode;
	isAwaitingApproval?: boolean;
}) => (
	<div
		className="edit-tool-card-header flex items-center justify-between gap-2 px-2.5 py-1 select-none transition-all duration-200 relative"
		style={{
			background: isAwaitingApproval
				? 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.15)'
				: 'transparent',
			borderBottom: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.12)',
			minHeight: '24px',
		}}
	>
		<div className="edit-tool-card-header-main flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
			{children}
		</div>
		{rightSlot ? (
			<div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
				{rightSlot}
			</div>
		) : null}
	</div>
);