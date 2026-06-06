/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type CollapsibleSectionProps = {
	isOpen: boolean;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	duration?: number;
};

export const CollapsibleSection = ({
	isOpen,
	children,
	className = '',
	contentClassName = '',
	duration = 0.2,
}: CollapsibleSectionProps) => {
	return (
		<AnimatePresence initial={false}>
			{isOpen && (
				<motion.div
					key="collapsible-section"
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: 'auto', opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{ duration, ease: 'easeOut' }}
					className={`overflow-hidden ${className}`}
				>
					<div className={contentClassName}>
						{children}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};