/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const EditToolCardWrapper = ({ children, isRunning, className = '' }: { children: React.ReactNode, isRunning?: boolean, className?: string }) => (
	<div className={`
		relative
		my-2
		min-h-[44px]
		overflow-hidden
		transition-all duration-300 ease-out
		${className}
	`}
	style={{
		borderRadius: '6px',
		border: '1px solid rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.4)',
		background: 'var(--vscode-editor-background)',
		boxShadow: isRunning
			? '0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(var(--vscode-void-fg-3-rgb, 255, 255, 255), 0.05)'
			: '0 1px 2px rgba(0, 0, 0, 0.1)',
		// Smooth shadow transition
		transition: 'box-shadow 300ms ease-out, border-color 300ms ease-out',
		// Slightly enhance border when running
		borderColor: isRunning
			? 'rgba(var(--vscode-void-border-2-rgb, 96, 96, 96), 0.5)'
			: 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.4)'
	}}
	>
		{/* Minimal left accent - only visible when running */}
		{isRunning && (
			<div
				className="absolute left-0 top-0 bottom-0 w-[2px]"
				style={{
					background: 'linear-gradient(to bottom, transparent 5%, var(--vscode-void-fg-3), transparent 95%)',
					opacity: 0.6,
					transition: 'opacity 300ms ease-out'
				}}
			/>
		)}

		{/* Animation keyframes - only inject once */}
		{isRunning && (
			<style>{`
				@keyframes fadeInDropdown {
					from {
						opacity: 0;
						transform: scale(0.98);
					}
					to {
						opacity: 1;
						transform: scale(1);
					}
				}
				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}
			`}</style>
		)}
		{children}
	</div>
);
