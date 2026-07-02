/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * Three-dot pulsing agent indicator (Cursor-style inline loading dots).
 * Pure CSS: opacity is GPU-composited, so this runs off the main thread.
 * Keyframes `orbit-subagent-dot` live in styles.css.
 */
export const SubAgentRunningIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => {
	const dotSize = Math.max(3, Math.round(size * 0.22));
	const gap = Math.max(1, Math.round(size * 0.12));

	return (
		<span
			className={`inline-flex items-center flex-shrink-0 ${className}`}
			style={{ gap, height: size }}
			aria-hidden="true"
		>
			{[0, 1, 2].map(i => (
				<span
					key={i}
					className="rounded-full bg-[var(--vscode-focusBorder)]"
					style={{ width: dotSize, height: dotSize, animation: `orbit-subagent-dot 1.4s ease-in-out ${i * 0.16}s infinite` }}
				/>
			))}
		</span>
	);
};
