/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
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
    duration = 2.5,
    spread = 2,
}: TextShimmerProps) {
	const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

    const shimmerWidth = useMemo(() => {
        // Fixed shimmer beam width for smooth, consistent animation
        return 60;
    }, []);

	return (
		<span 
			style={{ 
				position: 'relative', 
				display: 'inline', 
				color: 'inherit',
				verticalAlign: 'baseline'
			}} 
			className={className}
		>
			{/* Base text - always visible, inherits parent color */}
			<Component
				style={{
					position: 'relative',
					display: 'inline',
					color: 'inherit',
					verticalAlign: 'baseline'
				}}
			>
				{children}
			</Component>

			{/* Shimmer overlay - high-contrast gradient for premium effect */}
			<MotionComponent
				initial={false}
				animate={{ backgroundPosition: ['150% center', '-150% center'] }}
				transition={{
					repeat: Infinity,
					duration,
					ease: 'linear',
					repeatDelay: 0,
				}}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: 'inline',
					backgroundImage: `linear-gradient(
						90deg,
						transparent 0%,
						transparent calc(50% - ${shimmerWidth}px),
						rgba(255, 255, 255, 0.05) calc(50% - ${shimmerWidth * 0.75}px),
						rgba(255, 255, 255, 0.2) calc(50% - ${shimmerWidth * 0.5}px),
						rgba(255, 255, 255, 0.4) calc(50% - ${shimmerWidth * 0.3}px),
						rgba(255, 255, 255, 0.7) calc(50% - ${shimmerWidth * 0.15}px),
						rgba(255, 255, 255, 0.9) 50%,
						rgba(255, 255, 255, 0.7) calc(50% + ${shimmerWidth * 0.15}px),
						rgba(255, 255, 255, 0.4) calc(50% + ${shimmerWidth * 0.3}px),
						rgba(255, 255, 255, 0.2) calc(50% + ${shimmerWidth * 0.5}px),
						rgba(255, 255, 255, 0.05) calc(50% + ${shimmerWidth * 0.75}px),
						transparent calc(50% + ${shimmerWidth}px),
						transparent 100%
					)`,
					backgroundSize: '300% 100%',
					backgroundRepeat: 'no-repeat',
					backgroundClip: 'text',
					WebkitBackgroundClip: 'text',
					color: 'transparent',
					pointerEvents: 'none',
					WebkitTransform: 'translateZ(0)',
					transform: 'translateZ(0)',
					verticalAlign: 'baseline'
				} as React.CSSProperties}
			>
				{children}
			</MotionComponent>
		</span>
	);
}
