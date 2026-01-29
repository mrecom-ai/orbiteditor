/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { useState, useEffect, useCallback, RefObject } from 'react';

/**
 * Hook for sticky user messages.
 *
 * Tracks scroll position and determines which user message should be sticky.
 * Only ONE user message should be sticky at any time - the most recently
 * scrolled-past message.
 *
 * Z-index hierarchy for sticky elements:
 * - User messages: z-index 20 (highest, always visible on top)
 * - TodoTool card: z-index 15 (below user messages, above regular content)
 *
 * Styling includes:
 * - Consistent 8px offset from top
 * - 4px padding for visual breathing room
 * - Subtle box-shadow for depth
 * - Background color to prevent content bleeding through
 */

export const STICKY_OFFSET = 0;

export const useStickyUserMessages = (
	scrollContainerRef: RefObject<HTMLDivElement | null>,
	userMessageIndices: number[]
): {
	stickyOffset: number;
	stickyMessageIndex: number | null;
} => {
	const [stickyMessageIndex, setStickyMessageIndex] = useState<number | null>(null);

	const updateStickyMessage = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container || userMessageIndices.length === 0) {
			setStickyMessageIndex(null);
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const stickyThreshold = STICKY_OFFSET + 20; // A bit past the sticky offset

		// Find all user message elements and determine which one should be sticky
		let lastStickyCandidate: number | null = null;

		for (const messageIndex of userMessageIndices) {
			const messageElement = container.querySelector(`[data-message-index="${messageIndex}"]`) as HTMLElement | null;
			if (!messageElement) continue;

			// Get the element's position relative to the container's scroll area
			const messageRect = messageElement.getBoundingClientRect();
			const relativeTop = messageRect.top - containerRect.top;

			// If this message has scrolled past the sticky threshold, it's a candidate
			// The message should become sticky when its top goes above the threshold
			if (relativeTop <= stickyThreshold) {
				lastStickyCandidate = messageIndex;
			}
		}

		setStickyMessageIndex(lastStickyCandidate);
	}, [scrollContainerRef, userMessageIndices.join(',')]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		// Initial update
		updateStickyMessage();

		// Listen to scroll events
		container.addEventListener('scroll', updateStickyMessage, { passive: true });

		// Also update on resize
		window.addEventListener('resize', updateStickyMessage, { passive: true });

		return () => {
			container.removeEventListener('scroll', updateStickyMessage);
			window.removeEventListener('resize', updateStickyMessage);
		};
	}, [scrollContainerRef, updateStickyMessage]);

	// Also update when message indices change
	useEffect(() => {
		updateStickyMessage();
	}, [updateStickyMessage]);

	return {
		stickyOffset: STICKY_OFFSET,
		stickyMessageIndex,
	};
};
