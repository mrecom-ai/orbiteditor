/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { motion } from 'framer-motion';

export const CircleSpinner = ({ size = 14, className = '' }: { size?: number, className?: string }) => {
	return (
		<motion.svg
			className={`inline-block align-middle ${className}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			animate={{ rotate: 360 }}
			transition={{
				duration: 1.2,
				repeat: Infinity,
				ease: 'linear',
			}}
		>
			<motion.circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray="60 40"
				initial={{ strokeDashoffset: 0 }}
				animate={{ strokeDashoffset: 100 }}
				transition={{
					duration: 1.5,
					repeat: Infinity,
					ease: 'linear',
				}}
				style={{ opacity: 0.7 }}
			/>
		</motion.svg>
	);
};
