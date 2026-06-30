/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

// Pure-CSS spinner (previously framer-motion). The rotation uses Tailwind's `animate-spin`
// (a GPU-composited transform), and the stroke-dash sweep uses the `orbit-spinner-dash` keyframe
// in styles.css. Identical look, but the browser drives both natively instead of a per-frame JS loop.
export const CircleSpinner = ({ size = 14, className = '' }: { size?: number, className?: string }) => {
	return (
		<svg
			className={`inline-block align-middle animate-spin ${className}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			style={{ flexShrink: 0 }}
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeDasharray="50 30"
				style={{
					opacity: 0.85,
					strokeDashoffset: 0,
					animation: 'orbit-spinner-dash 1.2s linear infinite',
				}}
			/>
		</svg>
	);
};
