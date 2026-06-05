/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ArrowRight, Check, CircleDashed } from 'lucide-react';
import { TodoStatus } from '../../../../../../../common/chatThreadServiceTypes.js';

const iconSize = 16;

/** Cursor-style status icons: dashed pending, arrow-in-circle in progress, green check done. */
export const TodoStatusIcon = ({ status }: { status: TodoStatus }) => {
	switch (status) {
		case 'completed':
			return (
				<div
					className="flex items-center justify-center flex-shrink-0 rounded-full"
					style={{
						width: iconSize,
						height: iconSize,
						backgroundColor: 'var(--vscode-charts-green)',
					}}
					aria-hidden
				>
					<Check
						className="w-2.5 h-2.5"
						style={{ color: 'var(--vscode-editor-background)' }}
						strokeWidth={3}
					/>
				</div>
			);
		case 'in_progress':
			return (
				<div
					className="flex items-center justify-center flex-shrink-0 rounded-full"
					style={{
						width: iconSize,
						height: iconSize,
						border: '1.5px solid var(--vscode-foreground)',
						backgroundColor: 'var(--vscode-editor-background)',
					}}
					aria-hidden
				>
					<ArrowRight
						className="w-2.5 h-2.5"
						style={{ color: 'var(--vscode-foreground)' }}
						strokeWidth={2.25}
					/>
				</div>
			);
		case 'cancelled':
			return (
				<div
					className="flex items-center justify-center flex-shrink-0 rounded-full"
					style={{
						width: iconSize,
						height: iconSize,
						border: '1px dashed var(--vscode-descriptionForeground)',
						opacity: 0.45,
					}}
					aria-hidden
				>
					<span
						className="text-[10px] leading-none font-medium"
						style={{ color: 'var(--vscode-descriptionForeground)' }}
					>
						×
					</span>
				</div>
			);
		default:
			return (
				<CircleDashed
					className="flex-shrink-0"
					width={iconSize}
					height={iconSize}
					style={{ color: 'var(--vscode-descriptionForeground)', opacity: 0.55 }}
					strokeWidth={1.5}
				/>
			);
	}
};
