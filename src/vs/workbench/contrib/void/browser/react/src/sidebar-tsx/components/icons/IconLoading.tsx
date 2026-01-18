/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { TextShimmer } from '../../../util/TextShimmer.js';

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

	// Styles for the container to preserve original look and ensure visibility
	const containerStyle: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontWeight: 500,
		fontSize: '0.675rem',
		letterSpacing: '0.05em',
		color: 'var(--vscode-descriptionForeground)', // MATCHING toolTitles.tsx DESIGN
	};

	return (
		<span className={className} style={containerStyle}>
			<TextShimmer
				duration={duration}
			>
				{`${text}${'.'.repeat(dotCount)}`}
			</TextShimmer>
		</span>
	);
};
