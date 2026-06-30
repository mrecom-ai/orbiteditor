/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef } from 'react';
import { ChatScrollPolicy, getMessageOffsetTop, isNearBottom, scrollToBottom } from '../../utils/scrollUtils.js';
import {
	computeAdaptiveTurnAnchorSpacerHeight,
	computeTurnAnchorSpacerHeight,
} from '../../utils/turnAnchorSpacer.js';

type ChatScrollContainerProps = {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
	scrollGeneration?: number;
	policy: ChatScrollPolicy;
};

// How close to the bottom (px) still counts as "pinned to bottom" (bottom-follow only).
const PIN_THRESHOLD_PX = 32;

const getSpacer = (container: HTMLElement): HTMLElement | null =>
	container.querySelector('[data-turn-anchor-spacer]');

const setSpacerHeight = (container: HTMLElement, heightPx: number): void => {
	const spacer = getSpacer(container);
	if (spacer) {
		const next = `${Math.max(0, Math.round(heightPx))}px`;
		if (spacer.style.minHeight !== next) {
			spacer.style.minHeight = next;
		}
	}
};

/**
 * Scroll container implementing the assistant-ui `turnAnchor="top"` model.
 *
 * On a new turn the user message is pinned to the top exactly ONCE; its content offset is cached at
 * that moment, and thereafter only the invisible bottom spacer is resized (so the answer streams in
 * below the message and a short answer leaves no growing gap). Because scrollTop is set only on the
 * initial pin, the user can scroll freely and is never yanked back.
 *
 * IMPORTANT: message nodes are rendered as DIRECT children of this scroll container (no wrapper, no
 * `position` override) so the `position: sticky` user-message headers (`useStickyUserMessages`) keep
 * working exactly as before — their sticky containing block and scroll ancestor are this element.
 *
 * `bottom-follow` (opening an idle thread) sticks to the bottom while the user is already there.
 */
export const ChatScrollContainer = ({
	children,
	className,
	style,
	scrollContainerRef,
	scrollGeneration,
	policy,
}: ChatScrollContainerProps) => {
	const divRef = scrollContainerRef;
	const pinnedToBottomRef = useRef(true);
	// Cached natural offset of the anchored message (measured at pin time, before it becomes sticky).
	const anchorOffsetRef = useRef<number | null>(null);
	// Latest policy, read inside the rAF-coalesced sizing pass.
	const policyRef = useRef(policy);
	policyRef.current = policy;
	const sizingRafRef = useRef<number | null>(null);

	const turnAnchorIndex = policy.mode === 'turn-anchor' ? policy.anchorIndex : -1;
	const turnAnchorTopOffset = policy.mode === 'turn-anchor' ? policy.topOffset : 0;

	const onScroll = useCallback(() => {
		const div = divRef.current;
		if (div) {
			pinnedToBottomRef.current = isNearBottom(div, PIN_THRESHOLD_PX);
		}
	}, [divRef]);

	// Do one layout pass: size the turn-anchor spacer, or keep the bottom in view (bottom-follow).
	const runSizing = useCallback(() => {
		const div = divRef.current;
		if (!div) {
			return;
		}
		const p = policyRef.current;
		if (p.mode === 'turn-anchor') {
			const anchorOffsetTop = anchorOffsetRef.current ?? getMessageOffsetTop(div, p.anchorIndex);
			if (anchorOffsetTop === null) {
				return;
			}
			const currentSpacer = getSpacer(div)?.offsetHeight ?? 0;
			const contentBelowAnchor = div.scrollHeight - currentSpacer - anchorOffsetTop;
			setSpacerHeight(div, computeAdaptiveTurnAnchorSpacerHeight(div.clientHeight, contentBelowAnchor, p.topOffset));
		} else if (p.mode === 'bottom-follow' && pinnedToBottomRef.current && isNearBottom(div, PIN_THRESHOLD_PX)) {
			scrollToBottom(divRef);
		}
	}, [divRef]);

	// Coalesce many content-growth ticks (streaming fires ~20x/sec) into at most one layout pass per
	// frame, so streaming does not force a synchronous reflow on every token.
	const scheduleSizing = useCallback(() => {
		if (sizingRafRef.current !== null) {
			return;
		}
		sizingRafRef.current = requestAnimationFrame(() => {
			sizingRafRef.current = null;
			runSizing();
		});
	}, [runSizing]);

	// Entering bottom-follow (open / switch thread) = intent to stick to the bottom.
	useEffect(() => {
		if (policy.mode === 'bottom-follow') {
			pinnedToBottomRef.current = true;
		}
	}, [policy]);

	// Pin-once: when a turn-anchor appears (or its anchor changes), reserve a full spacer, cache the
	// anchor's natural offset, then pin the user message to the top. Keyed on the anchor identity —
	// NOT scrollGeneration — so it never re-fires (and re-yanks the user) while the answer streams.
	useEffect(() => {
		if (policy.mode !== 'turn-anchor') {
			anchorOffsetRef.current = null;
			return;
		}
		const div = divRef.current;
		if (!div) {
			return;
		}
		anchorOffsetRef.current = null;
		// Reserve room so the anchor can reach the top even when the response is still empty.
		setSpacerHeight(div, computeTurnAnchorSpacerHeight(div.clientHeight, turnAnchorTopOffset));

		const pin = (): boolean => {
			const offsetTop = getMessageOffsetTop(div, turnAnchorIndex);
			if (offsetTop === null) {
				return false;
			}
			anchorOffsetRef.current = offsetTop;
			div.scrollTop = Math.max(0, offsetTop - turnAnchorTopOffset);
			return true;
		};

		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			if (!pin()) {
				raf2 = requestAnimationFrame(() => { pin(); });
			}
		});
		return () => {
			cancelAnimationFrame(raf1);
			if (raf2) {
				cancelAnimationFrame(raf2);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [policy.mode, turnAnchorIndex, turnAnchorTopOffset, divRef]);

	// On content change (streaming growth, which also coincides with reasoning/tool collapse):
	// adaptively size the spacer / keep the bottom in view — coalesced to one pass per frame.
	useEffect(() => {
		scheduleSizing();
	}, [scrollGeneration, policy, scheduleSizing]);

	// Also re-size when the viewport itself changes (e.g. the sidebar panel is resized), which does
	// not bump scrollGeneration.
	useEffect(() => {
		const div = divRef.current;
		if (!div || typeof ResizeObserver === 'undefined') {
			return;
		}
		const ro = new ResizeObserver(() => scheduleSizing());
		ro.observe(div);
		return () => ro.disconnect();
	}, [divRef, scheduleSizing]);

	// Cancel any pending sizing pass on unmount.
	useEffect(() => () => {
		if (sizingRafRef.current !== null) {
			cancelAnimationFrame(sizingRafRef.current);
		}
	}, []);

	return (
		<div ref={divRef} className={className} style={style} onScroll={onScroll}>
			{children}
		</div>
	);
};
