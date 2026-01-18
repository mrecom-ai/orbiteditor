/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';

interface IconLoadingProps {
	className?: string;
	duration?: number;
	spread?: number;
}

export const IconLoading = ({
	className = '',
	duration = 2.5,
	spread = 2
}: IconLoadingProps) => {
	const [dotCount, setDotCount] = useState(1);
	const text = 'Working';

	useEffect(() => {
		const intervalId = setInterval(() => {
			setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
		}, 400);
		return () => clearInterval(intervalId);
	}, []);

	// Fixed shimmer width to prevent glitchy recalculation when dots change
	const shimmerWidth = 50;

	// High-contrast shimmer with smooth, continuous animation
	const shimmerStyle: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontWeight: 500,
		fontSize: '0.675rem',
		letterSpacing: '0.05em',
		position: 'relative',
		backgroundImage: `
			linear-gradient(
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
			),
			linear-gradient(
				to right,
				var(--vscode-descriptionForeground, #71717a),
				var(--vscode-descriptionForeground, #71717a)
			)
		`,
		backgroundSize: '300% 100%, auto',
		backgroundRepeat: 'no-repeat, padding-box',
		backgroundClip: 'text',
		WebkitBackgroundClip: 'text',
		color: 'transparent',
		animation: `iconLoadingShimmer ${duration}s linear infinite`,
		willChange: 'background-position',
		WebkitTransform: 'translateZ(0)',
		transform: 'translateZ(0)',
	};

	return (
		<>
			<style>{`
				@keyframes iconLoadingShimmer {
					0% {
						background-position: 150% center, 0 0;
					}
					100% {
						background-position: -150% center, 0 0;
					}
				}
			`}</style>
			<span
				className={className}
				style={shimmerStyle}
			>
				{text}{'.'.repeat(dotCount)}
			</span>
		</>
	);
};
