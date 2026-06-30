/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Chat scroll policy (assistant-ui `turnAnchor="top"` model).
 *
 * - `turn-anchor`: an active (or just-finished) turn is pinned near the TOP. The pin is applied
 *   ONCE; a bottom spacer (sized adaptively by `ChatScrollContainer`) reserves room so the answer
 *   streams in BELOW the user message without the message scrolling off. Manual scroll is never
 *   fought (the spacer is resized, scrollTop is not).
 * - `bottom-follow`: keep the bottom (newest content) in view while the user is at the bottom — used
 *   when opening / switching to an idle thread.
 * - `preserve`: never auto-scroll (turn finished and frozen, or the user took over).
 */
export type ChatScrollPolicy =
	| { mode: 'bottom-follow' }
	| { mode: 'turn-anchor'; anchorIndex: number; topOffset: number }
	| { mode: 'preserve'; anchorIndex: number | null };

export type ChatScrollActions = {
	scrollToBottom: () => void;
	scrollToTurnAnchor: () => void;
};

export const scrollToBottom = (divRef: { current: HTMLElement | null }) => {
	if (divRef.current) {
		divRef.current.scrollTop = divRef.current.scrollHeight;
	}
};

export const isNearBottom = (container: HTMLElement, threshold = 4): boolean =>
	Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < threshold;

/**
 * Offset of a message's top from the top of the scroll *content* (scroll-position independent).
 * Returns null if the message element is not mounted yet.
 *
 * Only meaningful when the message is NOT currently sticky-stuck (a stuck element's rect reports the
 * stuck position). It is measured once at pin time — before the just-sent message becomes the sticky
 * header — and cached, so this limitation never bites.
 */
export const getMessageOffsetTop = (
	container: HTMLElement,
	messageIndex: number,
): number | null => {
	const el = container.querySelector(
		`[data-message-index="${messageIndex}"]`,
	) as HTMLElement | null;
	if (!el) {
		return null;
	}
	const containerRect = container.getBoundingClientRect();
	const messageRect = el.getBoundingClientRect();
	return Math.max(0, messageRect.top - containerRect.top + container.scrollTop);
};
