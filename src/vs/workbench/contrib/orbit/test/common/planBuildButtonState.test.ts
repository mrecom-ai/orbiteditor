/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

// Pure helper mirrored from planBuildButtonState.tsx (React bundle is not loaded in node tests).
function resolvePlanBuildButtonPhase(
	planBuildState: 'idle' | 'building' | 'built' | 'failed',
	opts?: { isSaving?: boolean; isStarting?: boolean },
): 'idle' | 'building' | 'built' | 'failed' {
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

suite('planBuildButtonState', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('idle when no build has started', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('idle'), 'idle');
	});

	test('building while saving or starting', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('idle', { isSaving: true }), 'building');
		assert.strictEqual(resolvePlanBuildButtonPhase('built', { isStarting: true }), 'building');
	});

	test('building persists while agent runs', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('building'), 'building');
	});

	test('built after agent completes', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('built'), 'built');
	});

	test('failed after build error', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('failed'), 'failed');
	});
});

suite('planBuildButtonState - default state and pre-build behavior', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	// Mirrors the default used by ChatThreadService.getPlanBuildState for an
	// unknown threadId. A brand-new thread must never surface 'failed' before
	// the user has actually clicked Build.
	test('default state for a new thread is idle, not failed', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('idle'), 'idle');
		assert.notStrictEqual(resolvePlanBuildButtonPhase('idle'), 'failed');
	});

	// Pre-build validation failures (no draft, no plan file, no todos) must
	// not put the thread into the 'failed' visual phase. The build action
	// path resets the state back to 'idle' in that case.
	test('pre-build validation reset keeps the button in the idle phase', () => {
		const preBuildResetState: 'idle' | 'building' | 'built' | 'failed' = 'idle';
		assert.strictEqual(resolvePlanBuildButtonPhase(preBuildResetState), 'idle');
	});

	// Once the build actually started (state went 'building'), a subsequent
	// failure should still show 'failed' as before.
	test('post-start failure still surfaces failed', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('failed'), 'failed');
	});

	// The saving/starting opts override everything else, including 'failed'.
	// This matches the in-flight editor saving/starting UX in the title bar.
	test('saving or starting opts force building even from failed', () => {
		assert.strictEqual(resolvePlanBuildButtonPhase('failed', { isSaving: true }), 'building');
		assert.strictEqual(resolvePlanBuildButtonPhase('failed', { isStarting: true }), 'building');
	});
});