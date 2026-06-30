/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * Premium pulsing agent indicator — subtle ring + core dot.
 * Pure CSS (previously framer-motion): scale + opacity are GPU-composited, so these run off the
 * main thread. Keyframes `orbit-subagent-ring` / `orbit-subagent-core` live in styles.css.
 */
export const SubAgentRunningIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => {
	const ringSize = size;
	const coreSize = Math.max(4, Math.round(size * 0.36));

	return (
		<span
			className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
			style={{ width: ringSize, height: ringSize }}
			aria-hidden="true"
		>
			<span
				className="absolute inset-0 rounded-full border border-[var(--vscode-focusBorder)]/50"
				style={{ animation: 'orbit-subagent-ring 1.8s ease-in-out infinite' }}
			/>
			<span
				className="absolute rounded-full bg-[var(--vscode-focusBorder)]"
				style={{ width: coreSize, height: coreSize, animation: 'orbit-subagent-core 1.8s ease-in-out infinite' }}
			/>
		</span>
	);
};
