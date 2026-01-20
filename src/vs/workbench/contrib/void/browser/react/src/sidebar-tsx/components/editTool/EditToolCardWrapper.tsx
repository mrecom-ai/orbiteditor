/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const EditToolCardWrapper = ({ children, isRunning, isAwaitingApproval, className = '' }: { children: React.ReactNode, isRunning?: boolean, isAwaitingApproval?: boolean, className?: string }) => (
	<div className={`
		relative
		my-1.5
		min-h-[32px]
		overflow-hidden
		transition-all duration-200 ease-out
		${className}
	`}
	style={{
		borderRadius: '6px',
		border: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.45)',
		background: 'var(--vscode-sidebar-background, var(--vscode-editor-background))',
		transition: 'border-color 200ms ease-out, background 200ms ease-out, box-shadow 200ms ease-out',
		boxShadow: '0 0.5px 1px rgba(0, 0, 0, 0.08)',
		// Enhanced border when awaiting
		borderColor: isAwaitingApproval
			? 'rgba(var(--vscode-void-border-2-rgb, 96, 96, 96), 0.6)'
			: 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.45)'
	}}
	>
		{/* Animation keyframes */}
		<style>{`
			@keyframes fadeIn {
				from {
					opacity: 0;
				}
				to {
					opacity: 1;
				}
			}
		`}</style>
		{children}
	</div>
);
