/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { Check, CheckCircle2, CircleDashed, MessageCircleQuestion } from 'lucide-react';
import { IsRunningType } from '../../../chatThreadService.js';
import { OrbitProgressIndicator, OrbitProgressSize } from './OrbitProgressIndicator.js';

export interface ThreadStatusIconProps {
	isRunning: IsRunningType | undefined;
	size?: OrbitProgressSize;
	/** When true, show draft indicator instead of completed check (chat history panel). */
	isDraft?: boolean;
	/** How to render a non-running, non-draft thread. */
	idleDisplay?: 'completed' | 'simple-check' | 'none';
}

const ICON_CLASS = 'text-void-fg-0 opacity-70 flex-shrink-0';
const COMPLETED_CLASS = 'text-void-fg-0 opacity-80 flex-shrink-0';

/** Status glyph for a thread row in chat history / thread selectors. */
const ThreadStatusIconInner: React.FC<ThreadStatusIconProps> = ({
	isRunning,
	size = 'xs',
	isDraft = false,
	idleDisplay = 'completed',
}) => {
	if (isRunning === 'LLM' || isRunning === 'tool' || isRunning === 'idle') {
		return (
			<OrbitProgressIndicator
				size={size}
				variant="foreground"
				className="opacity-70 flex-shrink-0"
				label="Agent running"
			/>
		);
	}
	if (isRunning === 'awaiting_user') {
		return (
			<MessageCircleQuestion className={ICON_CLASS} size={12} />
		);
	}
	if (isDraft) {
		return (
			<CircleDashed className={ICON_CLASS} size={12} />
		);
	}
	if (idleDisplay === 'none') {
		return null;
	}
	if (idleDisplay === 'simple-check') {
		return (
			<Check className="flex-shrink-0 opacity-60" size={12} />
		);
	}
	return (
		<CheckCircle2 className={COMPLETED_CLASS} size={12} />
	);
};

export const ThreadStatusIcon = React.memo(ThreadStatusIconInner);