/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import { ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import { BrowserToolName, BrowserToolVariant, getVariantIconColor } from './BrowserToolHelpers.js';

interface BrowserToolStateIndicatorProps<T extends BrowserToolName> {
	toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>;
	variant: BrowserToolVariant;
}

// Main state indicator component
export function BrowserToolStateIndicator<T extends BrowserToolName>({
	toolMessage,
	variant,
}: BrowserToolStateIndicatorProps<T>) {
	const { type } = toolMessage;

	switch (type) {
		case 'tool_request':
			return null;

		case 'running_now':
			return <ShimmerSpinner variant={variant} />;

		case 'success':
			return <CheckmarkIcon variant={variant} />;

		case 'tool_error':
			return <ErrorIcon />;

		case 'rejected':
			return <RejectedIcon />;

		default:
			return null;
	}
}

// Animated spinner with pulse effect for running state
function ShimmerSpinner({ variant }: { variant: BrowserToolVariant }) {
	return (
		<motion.div
			className="flex-shrink-0"
			animate={{
				rotate: 360,
			}}
			transition={{
				duration: 1.2,
				repeat: Infinity,
				ease: 'linear',
			}}
		>
			<Loader2 size={13} className="text-blue-400" />
		</motion.div>
	);
}

// Animated checkmark with spring transition for success
function CheckmarkIcon({ variant }: { variant: BrowserToolVariant }) {
	return (
		<motion.div
			className="flex-shrink-0"
			initial={{ scale: 0, rotate: -180 }}
			animate={{ scale: 1, rotate: 0 }}
			transition={{
				type: 'spring',
				stiffness: 260,
				damping: 20,
			}}
		>
			<Check size={13} className="text-blue-500" />
		</motion.div>
	);
}

// Warning triangle for error state
function ErrorIcon() {
	return (
		<motion.div
			className="flex-shrink-0"
			initial={{ scale: 0 }}
			animate={{ scale: 1 }}
			transition={{
				type: 'spring',
				stiffness: 300,
				damping: 20,
			}}
		>
			<AlertTriangle size={14} className="text-red-500" />
		</motion.div>
	);
}

// X icon for rejected state
function RejectedIcon() {
	return (
		<motion.div
			className="flex-shrink-0"
			initial={{ scale: 0 }}
			animate={{ scale: 1 }}
			transition={{
				type: 'spring',
				stiffness: 300,
				damping: 20,
			}}
		>
			<X size={14} className="text-gray-500" />
		</motion.div>
	);
}
