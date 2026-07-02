/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { checksum } from '../../../../base/node/crypto.js';
import * as pfs from '../../../../base/node/pfs.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILifecycleMainService } from '../../../../platform/lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asJson, IRequestService } from '../../../../platform/request/common/request.js';
import { compareOrbitVersions, getCurrentOrbitVersion, getOrbitPlatformAssetKey, IOrbitUpdateManifest, ORBIT_UPDATE_MANIFEST_URL, ORBIT_UPDATE_REPO } from '../common/orbitUpdateManifest.js';
import { IVoidUpdateService } from '../common/orbitUpdateService.js';
import { VoidCheckUpdateRespose } from '../common/orbitUpdateServiceTypes.js';

interface IDownloadedUpdate {
	readonly version: string;
	readonly packagePath: string;
}

export class VoidMainUpdateService extends Disposable implements IVoidUpdateService {
	_serviceBrand: undefined;

	private _downloadPromise: Promise<IDownloadedUpdate | undefined> | undefined;
	private _downloadedUpdate: IDownloadedUpdate | undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IRequestService private readonly _requestService: IRequestService,
		@IFileService private readonly _fileService: IFileService,
		@ILogService private readonly _logService: ILogService,
		@ILifecycleMainService private readonly _lifecycleMainService: ILifecycleMainService,
	) {
		super();
	}

	async check(explicit: boolean): Promise<VoidCheckUpdateRespose> {
		try {
			const manifest = await this._fetchManifest();
			const platformKey = getOrbitPlatformAssetKey();
			const asset = manifest.assets[platformKey];

			if (!asset?.url) {
				this._logService.warn(`[Orbit Update] No asset for platform ${platformKey} in manifest`);
				return this._manifestErrorResponse(explicit, `No update package is published yet for ${platformKey}.`);
			}

			const currentVersion = getCurrentOrbitVersion(this._productService.version, this._productService.orbitVersion);
			const latestVersion = manifest.version;

			this._logService.info(`[Orbit Update] Current=${currentVersion} Latest=${latestVersion} Platform=${platformKey}`);

			if (compareOrbitVersions(currentVersion, latestVersion) >= 0) {
				if (this._downloadedUpdate && compareOrbitVersions(this._downloadedUpdate.version, latestVersion) < 0) {
					this._downloadedUpdate = undefined;
				}
				return explicit ? { message: 'Orbit is up-to-date!' } : { message: null };
			}

			if (this._downloadedUpdate?.version === latestVersion && await pfs.Promises.exists(this._downloadedUpdate.packagePath)) {
				return {
					message: explicit
						? `Orbit ${latestVersion} is downloaded and ready to install.`
						: `A new version of Orbit (${latestVersion}) is ready to install.`,
					action: 'install',
					version: latestVersion,
				};
			}

			if (this._downloadPromise) {
				await this._downloadPromise;
				if (this._downloadedUpdate?.version === latestVersion) {
					return {
						message: explicit
							? `Orbit ${latestVersion} is downloaded and ready to install.`
							: `A new version of Orbit (${latestVersion}) is ready to install.`,
						action: 'install',
						version: latestVersion,
					};
				}
			}

			this._downloadPromise = this._downloadUpdate(latestVersion, asset.url, asset.sha256);
			const downloaded = await this._downloadPromise;
			this._downloadPromise = undefined;

			if (!downloaded) {
				return this._manifestErrorResponse(explicit, 'The update download failed. Please try again in a few minutes.');
			}

			return {
				message: explicit
					? `Orbit ${latestVersion} is downloaded and ready to install.`
					: `A new version of Orbit (${latestVersion}) is ready to install.`,
				action: 'install',
				version: latestVersion,
			};
		} catch (error) {
			this._logService.error('[Orbit Update] Check failed', error);
			return this._manifestErrorResponse(explicit, `Update check failed: ${error}`);
		}
	}

	async install(): Promise<void> {
		if (!this._downloadedUpdate || !await pfs.Promises.exists(this._downloadedUpdate.packagePath)) {
			throw new Error('No downloaded update is available to install.');
		}

		const packagePath = this._downloadedUpdate.packagePath;
		this._logService.info(`[Orbit Update] Installing from ${packagePath}`);

		if (isWindows) {
			spawn(packagePath, ['/silent', '/mergetasks=runcode,!desktopicon,!quicklaunchicon'], {
				detached: true,
				stdio: 'ignore',
				windowsVerbatimArguments: true,
			});
			await this._lifecycleMainService.quit(true);
			return;
		}

		if (isMacintosh) {
			spawn('open', [packagePath], { detached: true, stdio: 'ignore' });
			return;
		}

		if (isLinux) {
			await fs.promises.chmod(packagePath, 0o755);
			spawn(packagePath, [], { detached: true, stdio: 'ignore' });
			await this._lifecycleMainService.quit(true);
			return;
		}

		throw new Error('Automatic install is not supported on this platform.');
	}

	private async _fetchManifest(): Promise<IOrbitUpdateManifest> {
		try {
			const response = await this._requestService.request({
				type: 'GET',
				url: ORBIT_UPDATE_MANIFEST_URL,
				headers: { Accept: 'application/json' },
			}, CancellationToken.None);

			if (response.res.statusCode !== 200) {
				throw new Error(`Manifest request failed with ${response.res.statusCode}`);
			}

			const manifest = await asJson<IOrbitUpdateManifest>(response);
			if (!manifest?.version || !manifest.assets) {
				throw new Error('Manifest is missing version or assets');
			}
			return manifest;
		} catch (error) {
			this._logService.warn('[Orbit Update] Manifest fetch failed, trying GitHub Releases API', error);
			return this._fetchManifestFromGitHubReleases();
		}
	}

	private async _fetchManifestFromGitHubReleases(): Promise<IOrbitUpdateManifest> {
		const response = await this._requestService.request({
			type: 'GET',
			url: `https://api.github.com/repos/${ORBIT_UPDATE_REPO}/releases/latest`,
			headers: { Accept: 'application/vnd.github+json' },
		}, CancellationToken.None);

		if (response.res.statusCode !== 200) {
			throw new Error(`GitHub Releases API returned ${response.res.statusCode}`);
		}

		const release = await asJson<{
			tag_name: string;
			assets: { name: string; browser_download_url: string }[];
		}>(response);

		if (!release?.tag_name || !release.assets) {
			throw new Error('GitHub Releases API returned an invalid payload');
		}

		const platformKey = getOrbitPlatformAssetKey();
		const assets: IOrbitUpdateManifest['assets'] = {};

		for (const releaseAsset of release.assets) {
			const name = releaseAsset.name.toLowerCase();
			if (name.includes('darwin') && name.includes('arm64')) {
				assets['darwin-arm64'] = { url: releaseAsset.browser_download_url };
			} else if (name.includes('darwin') && (name.includes('x64') || name.includes('intel'))) {
				assets['darwin-x64'] = { url: releaseAsset.browser_download_url };
			} else if (name.includes('win32') && name.endsWith('.exe')) {
				assets['win32-x64'] = { url: releaseAsset.browser_download_url };
			} else if (name.includes('linux') && (name.endsWith('.appimage') || name.endsWith('.tar.gz'))) {
				assets['linux-x64'] = { url: releaseAsset.browser_download_url };
			}
		}

		if (!assets[platformKey]) {
			throw new Error(`Latest GitHub release does not contain an asset for ${platformKey}`);
		}

		return {
			version: release.tag_name,
			assets,
		};
	}

	private async _downloadUpdate(version: string, url: string, sha256hash?: string): Promise<IDownloadedUpdate | undefined> {
		try {
			const cacheDir = path.join(tmpdir(), 'orbit-editor-updates', version);
			await fs.promises.mkdir(cacheDir, { recursive: true });

			const fileName = this._getFileNameFromUrl(url);
			const downloadPath = path.join(cacheDir, fileName);
			const tempPath = `${downloadPath}.tmp`;

			if (await pfs.Promises.exists(downloadPath)) {
				this._downloadedUpdate = { version, packagePath: downloadPath };
				return this._downloadedUpdate;
			}

			this._logService.info(`[Orbit Update] Downloading ${url}`);

			const context = await this._requestService.request({ type: 'GET', url }, CancellationToken.None);
			if (context.res.statusCode !== 200) {
				throw new Error(`Download failed with status ${context.res.statusCode}`);
			}

			await this._fileService.writeFile(URI.file(tempPath), context.stream);
			if (sha256hash) {
				await checksum(tempPath, sha256hash);
			}
			await pfs.Promises.rename(tempPath, downloadPath, false);

			this._downloadedUpdate = { version, packagePath: downloadPath };
			this._logService.info(`[Orbit Update] Downloaded to ${downloadPath}`);
			return this._downloadedUpdate;
		} catch (error) {
			this._logService.error('[Orbit Update] Download failed', error);
			return undefined;
		}
	}

	private _getFileNameFromUrl(url: string): string {
		try {
			const parsed = new URL(url);
			const base = path.basename(parsed.pathname);
			return base || 'orbit-update';
		} catch {
			return 'orbit-update';
		}
	}

	private _manifestErrorResponse(explicit: boolean, message: string): VoidCheckUpdateRespose {
		if (!explicit && !this._envMainService.isBuilt) {
			return { message: null };
		}
		return explicit
			? { message, action: 'openRelease' }
			: { message: null };
	}
}