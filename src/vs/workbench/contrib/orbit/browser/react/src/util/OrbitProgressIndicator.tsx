/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import '../styles.css';

export type OrbitProgressSize = 'xs' | 'sm' | 'md';

const SIZE_PX: Record<OrbitProgressSize, number> = {
	xs: 12,
	sm: 14,
	md: 18,
};

export interface OrbitProgressIndicatorProps {
	size?: OrbitProgressSize;
	variant?: 'accent' | 'muted' | 'foreground';
	className?: string;
	label?: string;
}

const SpinnerSvg = () => (
	<svg
		className="@@orbit-progress-svg"
		viewBox="0 0 16 16"
		fill="none"
		aria-hidden
	>
		<circle className="@@orbit-progress-track" cx="8" cy="8" r="6" fill="none" />
		<circle className="@@orbit-progress-arc" cx="8" cy="8" r="6" fill="none" />
	</svg>
);

/** Unified in-progress spinner — SVG arc for visibility at small sizes. */
const OrbitProgressIndicatorInner: React.FC<OrbitProgressIndicatorProps> = ({
	size = 'sm',
	variant = 'accent',
	className = '',
	label = 'In progress',
}) => {
	const px = SIZE_PX[size];
	const wrap = (indicator: React.ReactNode) =>
		className ? <span className={className}>{indicator}</span> : indicator;

	if (variant === 'muted') {
		return wrap(
			<span
				className="@@orbit-progress-wrap @@orbit-progress-muted is-active"
				style={{ width: px, height: px }}
				role="status"
				aria-label={label}
				aria-live="polite"
			>
				<SpinnerSvg />
			</span>,
		);
	}
	if (variant === 'foreground') {
		return wrap(
			<span
				className="@@orbit-progress-wrap @@orbit-progress-foreground is-active"
				style={{ width: px, height: px }}
				role="status"
				aria-label={label}
				aria-live="polite"
			>
				<SpinnerSvg />
			</span>,
		);
	}
	return wrap(
		<span
			className="@@orbit-progress-wrap @@orbit-progress-accent is-active"
			style={{ width: px, height: px }}
			role="status"
			aria-label={label}
			aria-live="polite"
		>
			<SpinnerSvg />
		</span>,
	);
};

export const OrbitProgressIndicator = React.memo(OrbitProgressIndicatorInner);