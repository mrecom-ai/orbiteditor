/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useState } from 'react';
import { PlanBuildState } from '../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from './services.js';

/** Visual phase for the plan Build button. */
export type PlanBuildButtonPhase = 'idle' | 'building' | 'built' | 'failed';

export function resolvePlanBuildButtonPhase(
	planBuildState: PlanBuildState,
	opts?: { isSaving?: boolean; isStarting?: boolean },
): PlanBuildButtonPhase {
	if (opts?.isSaving || opts?.isStarting) {
		return 'building';
	}
	if (planBuildState === 'building') {
		return 'building';
	}
	if (planBuildState === 'built') {
		return 'built';
	}
	if (planBuildState === 'failed') {
		return 'failed';
	}
	return 'idle';
}

export function usePlanBuildButtonPhase(
	threadId: string | undefined,
	opts?: { isSaving?: boolean; isStarting?: boolean },
): PlanBuildButtonPhase {
	const accessor = useAccessor();
	const chatThreadService = accessor.get('IChatThreadService');

	const [planBuildState, setPlanBuildState] = useState<PlanBuildState>(() =>
		threadId ? chatThreadService.getPlanBuildState(threadId) : 'idle',
	);

	useEffect(() => {
		if (!threadId) {
			setPlanBuildState('idle');
			return;
		}
		setPlanBuildState(chatThreadService.getPlanBuildState(threadId));
		const disposable = chatThreadService.onDidChangePlanBuildState(({ threadId: changedId }) => {
			if (changedId === threadId) {
				setPlanBuildState(chatThreadService.getPlanBuildState(threadId));
			}
		});
		return () => disposable.dispose();
	}, [threadId, chatThreadService]);

	return resolvePlanBuildButtonPhase(planBuildState, opts);
}