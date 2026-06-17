/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { motion } from 'framer-motion';

/** Premium pulsing agent indicator — subtle ring + core dot */
export const SubAgentRunningIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => {
	const ringSize = size;
	const coreSize = Math.max(4, Math.round(size * 0.36));

	return (
		<span
			className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
			style={{ width: ringSize, height: ringSize }}
			aria-hidden="true"
		>
			<motion.span
				className="absolute inset-0 rounded-full border border-[var(--vscode-focusBorder)]/50"
				animate={{
					scale: [1, 1.45, 1],
					opacity: [0.55, 0.12, 0.55],
				}}
				transition={{
					duration: 1.8,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
			/>
			<motion.span
				className="absolute rounded-full bg-[var(--vscode-focusBorder)]"
				style={{ width: coreSize, height: coreSize }}
				animate={{
					scale: [1, 0.88, 1],
					opacity: [0.95, 0.65, 0.95],
				}}
				transition={{
					duration: 1.8,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
			/>
		</span>
	);
};
