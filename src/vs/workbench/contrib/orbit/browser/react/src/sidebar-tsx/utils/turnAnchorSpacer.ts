/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gap between the pinned user message and the top of the viewport. Kept at 0 to match
 * `STICKY_OFFSET` (useStickyUserMessages) so the message does not shift when the sticky header
 * engages over the scroll-pinned position.
 */
export const TURN_ANCHOR_TOP_PADDING_PX = 0;

/**
 * Initial spacer height: reserve a full viewport below the active turn so the anchored user message
 * can be pinned to the top even when the answer is still empty.
 */
export const computeTurnAnchorSpacerHeight = (
	containerClientHeight: number,
	topPadding = TURN_ANCHOR_TOP_PADDING_PX,
): number => Math.max(0, containerClientHeight - topPadding);

/**
 * Adaptive spacer height: the minimum needed to keep the anchored user message pinned to the top.
 * Shrinks to 0 as the answer grows past one viewport, so a long answer leaves no trailing blank
 * while a short one still holds the message at the top.
 *
 * `contentBelowAnchor` = height from the anchored message to the bottom, EXCLUDING the spacer, i.e.
 * `(scrollHeight - currentSpacerHeight) - anchorOffsetTop`.
 */
export const computeAdaptiveTurnAnchorSpacerHeight = (
	containerClientHeight: number,
	contentBelowAnchor: number,
	topPadding = TURN_ANCHOR_TOP_PADDING_PX,
): number => Math.max(0, containerClientHeight - topPadding - contentBelowAnchor);
