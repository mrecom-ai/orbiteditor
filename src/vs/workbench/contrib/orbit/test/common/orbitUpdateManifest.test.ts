/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { compareOrbitVersions, getCurrentOrbitVersion, getOrbitUpdateManifestUrl, normalizeOrbitVersion } from '../../common/orbitUpdateManifest.js';

suite('orbitUpdateManifest', () => {
	test('normalizeOrbitVersion strips leading v', () => {
		assert.strictEqual(normalizeOrbitVersion('v0.2.0'), '0.2.0');
		assert.strictEqual(normalizeOrbitVersion('V1.0.0'), '1.0.0');
	});

	test('compareOrbitVersions orders numeric segments', () => {
		assert.ok(compareOrbitVersions('0.1.0', '0.2.0') < 0);
		assert.ok(compareOrbitVersions('0.2.0', '0.1.0') > 0);
		assert.strictEqual(compareOrbitVersions('v0.1.0', '0.1.0'), 0);
		assert.ok(compareOrbitVersions('0.1.9', '0.1.10') < 0);
	});

	test('getCurrentOrbitVersion prefers orbitVersion', () => {
		assert.strictEqual(getCurrentOrbitVersion('9.9.9', '0.1.0'), '0.1.0');
		assert.strictEqual(getCurrentOrbitVersion('0.2.0', undefined), '0.2.0');
		assert.strictEqual(getCurrentOrbitVersion(undefined, undefined), '0.0.0');
	});

	test('getOrbitUpdateManifestUrl includes cache buster', () => {
		const url = getOrbitUpdateManifestUrl();
		assert.ok(url.includes('latest.json?t='));
	});
});