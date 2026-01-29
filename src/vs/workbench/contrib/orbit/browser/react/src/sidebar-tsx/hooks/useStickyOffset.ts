/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from 'react';

/**
 * Hook to measure and set CSS variable for sticky todo positioning
 * Measures the height of user message area and sets --todo-sticky-offset
 */
export const useStickyOffset = (scrollContainerRef: React.RefObject<HTMLDivElement>) => {
	const measurementTimerRef = useRef<number | null>(null);

	useEffect(() => {
		const measureAndSetOffset = () => {
			if (!scrollContainerRef.current) return;

			// Find the first user message element in the scroll container
			const userMessages = scrollContainerRef.current.querySelectorAll('[data-role="user"]');
			if (userMessages.length === 0) {
				// No user messages, set offset to a small value
				scrollContainerRef.current.style.setProperty('--todo-sticky-offset', '8px');
				return;
			}

			// Get the first user message
			const firstUserMessage = userMessages[0] as HTMLElement;
			const rect = firstUserMessage.getBoundingClientRect();
			const containerRect = scrollContainerRef.current.getBoundingClientRect();

			// Calculate offset: distance from container top to bottom of user message
			// Add small padding (8px)
			const offset = rect.bottom - containerRect.top + 8;

			// Set CSS variable on scroll container
			scrollContainerRef.current.style.setProperty('--todo-sticky-offset', `${Math.max(0, offset)}px`);
		};

		// Initial measurement
		measureAndSetOffset();

		// Re-measure on scroll (debounced)
		const handleScroll = () => {
			if (measurementTimerRef.current !== null) {
				window.cancelAnimationFrame(measurementTimerRef.current);
			}
			measurementTimerRef.current = window.requestAnimationFrame(measureAndSetOffset);
		};

		// Re-measure on resize
		const resizeObserver = new ResizeObserver(() => {
			measureAndSetOffset();
		});

		if (scrollContainerRef.current) {
			scrollContainerRef.current.addEventListener('scroll', handleScroll);
			resizeObserver.observe(scrollContainerRef.current);
		}

		return () => {
			if (measurementTimerRef.current !== null) {
				window.cancelAnimationFrame(measurementTimerRef.current);
			}
			if (scrollContainerRef.current) {
				scrollContainerRef.current.removeEventListener('scroll', handleScroll);
				resizeObserver.disconnect();
			}
		};
	}, [scrollContainerRef]);
};
