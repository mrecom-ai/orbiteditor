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
    duration = 1.5,
    spread = 2,
}: TextShimmerProps) {
	const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

    const dynamicSpread = useMemo(() => {
        // Dynamically adjust shimmer width based on text length
        return children.length * spread * 1.5;
    }, [children, spread]);

	return (
		<span style={{ position: 'relative', display: 'inline-block' }} className={className}>
			{/* Base text - always visible, inherits parent color from className */}
			<Component
				style={{
					position: 'relative',
					display: 'inline-block',
				}}
			>
				{children}
			</Component>

			{/* Shimmer overlay - adds subtle brightness wave as it passes */}
			<MotionComponent
				initial={{ backgroundPosition: '-200% center' }}
				animate={{ backgroundPosition: '200% center' }}
				transition={{
					repeat: Infinity,
					duration,
					ease: 'linear',
				}}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: 'inline-block',
					backgroundImage: `linear-gradient(
						90deg,
						rgba(255, 255, 255, 0) 0%,
						rgba(255, 255, 255, 0) calc(50% - ${dynamicSpread}px),
						rgba(255, 255, 255, 0.3) 50%,
						rgba(255, 255, 255, 0) calc(50% + ${dynamicSpread}px),
						rgba(255, 255, 255, 0) 100%
					)`,
					backgroundSize: '200% 100%',
					backgroundRepeat: 'no-repeat',
					backgroundClip: 'text',
					WebkitBackgroundClip: 'text',
					color: 'transparent',
					pointerEvents: 'none',
					willChange: 'background-position',
				} as React.CSSProperties}
			>
				{children}
			</MotionComponent>
		</span>
	);
}
