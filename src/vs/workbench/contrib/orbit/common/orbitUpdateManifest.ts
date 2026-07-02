/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';

export const ORBIT_UPDATE_REPO = 'ashish200729/orbiteditor';

export const ORBIT_UPDATE_MANIFEST_URL = `https://raw.githubusercontent.com/${ORBIT_UPDATE_REPO}/main/update/latest.json`;

export const ORBIT_RELEASES_URL = `https://github.com/${ORBIT_UPDATE_REPO}/releases/latest`;

export interface IOrbitUpdateAsset {
	readonly url: string;
	readonly sha256?: string;
}

export interface IOrbitUpdateManifest {
	readonly version: string;
	readonly commit?: string;
	readonly releasedAt?: string;
	readonly assets: Record<string, IOrbitUpdateAsset>;
}

export function normalizeOrbitVersion(version: string): string {
	return version.replace(/^v/i, '').trim();
}

export function getOrbitPlatformAssetKey(): string {
	const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
	if (isWindows) {
		return `win32-${arch}`;
	}
	if (isMacintosh) {
		return `darwin-${arch}`;
	}
	if (isLinux) {
		return `linux-${arch}`;
	}
	return `linux-${arch}`;
}

export function compareOrbitVersions(current: string, latest: string): number {
	const parse = (value: string) => normalizeOrbitVersion(value).split('.').map(part => parseInt(part, 10) || 0);
	const a = parse(current);
	const b = parse(latest);
	const length = Math.max(a.length, b.length);

	for (let i = 0; i < length; i++) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

export function getCurrentOrbitVersion(version: string | undefined, orbitVersion: string | undefined): string {
	return normalizeOrbitVersion(orbitVersion ?? version ?? '0.0.0');
}