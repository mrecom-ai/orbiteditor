/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, type JSX } from 'react';
import { motion } from 'framer-motion';

interface TextShimmerProps {
	children: string;
	as?: React.ElementType;
	className?: string;
	duration?: number;
	spread?: number;
}

export function TextShimmer({
	children,
	as: Component = 'span',
	className = '',
	duration = 1.20, // Fast but visible (0.2 is too fast)
	spread = 2,
}: TextShimmerProps) {
	const MotionComponent = useMemo(() => motion(Component as keyof JSX.IntrinsicElements), [Component]);

	// Fixed beam width for consistent "searchlight" effect
	const shimmerWidth = 40;

	return (
		<MotionComponent
			initial={{ backgroundPosition: '-200px 0, 0 0' }}
			animate={{ backgroundPosition: ['-200px 0, 0 0', '0px 0, 0 0'] }}
			transition={{
				repeat: Infinity,
				duration,
				ease: 'linear',
				repeatDelay: 0,
			}}
			style={{
				display: 'inline-block',
				color: 'inherit',
				// Composite background: Shimmer gradient on top, Solid currentColor on bottom
				backgroundImage: `linear-gradient(
					100deg,
					transparent 0%,
					transparent calc(50% - ${shimmerWidth}px),
					rgba(255, 255, 255, 0.2) calc(50% - ${shimmerWidth * 0.8}px),
					rgba(255, 255, 255, 0.5) calc(50% - ${shimmerWidth * 0.5}px),
					rgba(255, 255, 255, 1) calc(50% - ${shimmerWidth * 0.2}px),
					rgba(255, 255, 255, 1) calc(50% + ${shimmerWidth * 0.2}px),
					rgba(255, 255, 255, 0.5) calc(50% + ${shimmerWidth * 0.5}px),
					rgba(255, 255, 255, 0.2) calc(50% + ${shimmerWidth * 0.8}px),
					transparent calc(50% + ${shimmerWidth}px),
					transparent 100%
				), linear-gradient(currentColor, currentColor)`,
				backgroundSize: '200px 100%, 100% 100%',
				backgroundRepeat: 'repeat-x, no-repeat',
				backgroundClip: 'text',
				WebkitBackgroundClip: 'text',

				// Make the text itself transparent so the background shows through
				WebkitTextFillColor: 'transparent',

				// Ensure layout properties are safe
				position: 'relative',
				whiteSpace: 'nowrap',
				verticalAlign: 'middle',
				maxWidth: '100%',
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				transform: 'translateZ(0)',
			} as React.CSSProperties}
			className={className}
		>
			{children}
		</MotionComponent>
	);
}
