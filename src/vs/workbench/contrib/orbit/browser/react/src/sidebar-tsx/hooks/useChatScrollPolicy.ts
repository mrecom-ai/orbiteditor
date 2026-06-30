/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState, RefObject } from 'react';
import { ChatScrollActions, ChatScrollPolicy, scrollToBottom } from '../utils/scrollUtils.js';
import { TURN_ANCHOR_TOP_PADDING_PX } from '../utils/turnAnchorSpacer.js';

type UseChatScrollPolicyArgs = {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	userMessageIndices: number[];
	/** Truthy while a run is active ('LLM' | 'tool' | 'awaiting_user' | 'idle'); pass `!!isRunning`. */
	isRunning: boolean;
	threadId: string;
	previousMessagesLength: number;
};

/**
 * Drives the chat scroll policy (assistant-ui `turnAnchor="top"` model):
 * - sending a message pins that turn near the top; the answer streams in below it (no jump to bottom);
 * - when the run finishes the turn stays pinned at the top (position preserved);
 * - opening / switching to an idle thread lands at the bottom (latest content).
 *
 * The "pin older user messages to the top while scrolling up" visual is provided by the
 * sticky-header system (`useStickyUserMessages`), not by this hook.
 */
export const useChatScrollPolicy = ({
	scrollContainerRef,
	userMessageIndices,
	isRunning,
	threadId,
	previousMessagesLength,
}: UseChatScrollPolicyArgs): {
	policy: ChatScrollPolicy;
	scrollActions: ChatScrollActions;
} => {
	const [policy, setPolicy] = useState<ChatScrollPolicy>({ mode: 'bottom-follow' });

	// Baseline for detecting a *new* user message within the current thread (reset on thread switch
	// so switching into a thread with fewer messages still anchors its next send).
	const lastTurnRef = useRef<{ threadId: string; userCount: number }>({
		threadId,
		userCount: userMessageIndices.length,
	});
	const prevIsRunningRef = useRef(isRunning);

	const anchorToTurn = useCallback((anchorIndex: number) => {
		setPolicy({ mode: 'turn-anchor', anchorIndex, topOffset: TURN_ANCHOR_TOP_PADDING_PX });
	}, []);

	const scrollActions = useMemo<ChatScrollActions>(() => ({
		scrollToBottom: () => {
			setPolicy({ mode: 'bottom-follow' });
			requestAnimationFrame(() => scrollToBottom(scrollContainerRef));
		},
		scrollToTurnAnchor: () => {
			const lastIdx = userMessageIndices[userMessageIndices.length - 1];
			if (lastIdx !== undefined) {
				anchorToTurn(lastIdx);
			}
		},
	}), [scrollContainerRef, userMessageIndices, anchorToTurn]);

	// New user message in the current thread → anchor that turn at the top.
	useEffect(() => {
		const count = userMessageIndices.length;
		const last = lastTurnRef.current;
		if (last.threadId === threadId && count > last.userCount) {
			const lastIdx = userMessageIndices[count - 1];
			if (lastIdx !== undefined) {
				anchorToTurn(lastIdx);
			}
		}
		lastTurnRef.current = { threadId, userCount: count };
	}, [userMessageIndices, threadId, anchorToTurn]);

	// Thread switch: anchor in-progress turns; otherwise land at the bottom of the opened thread.
	useEffect(() => {
		lastTurnRef.current = { threadId, userCount: userMessageIndices.length };
		prevIsRunningRef.current = isRunning;
		if (isRunning) {
			const lastIdx = userMessageIndices[userMessageIndices.length - 1];
			if (lastIdx !== undefined) {
				anchorToTurn(lastIdx);
				return;
			}
		}
		setPolicy({ mode: 'bottom-follow' });
		if (previousMessagesLength > 0) {
			requestAnimationFrame(() => {
				scrollToBottom(scrollContainerRef);
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadId]);

	// Run finished → freeze in place (keep the turn pinned at the top with its current spacer; no jump).
	useEffect(() => {
		const wasRunning = prevIsRunningRef.current;
		prevIsRunningRef.current = isRunning;
		if (wasRunning && !isRunning) {
			setPolicy(prev => {
				if (prev.mode === 'turn-anchor') {
					return { mode: 'preserve', anchorIndex: prev.anchorIndex };
				}
				if (prev.mode === 'preserve') {
					return prev;
				}
				return { mode: 'preserve', anchorIndex: null };
			});
		}
	}, [isRunning]);

	return { policy, scrollActions };
};
