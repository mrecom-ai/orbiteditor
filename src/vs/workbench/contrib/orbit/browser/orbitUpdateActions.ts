/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import Severity from '../../../../base/common/severity.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationActions, INotificationHandle, INotificationService } from '../../../../platform/notification/common/notification.js';
import { IMetricsService } from '../common/metricsService.js';
import { ORBIT_RELEASES_URL } from '../common/orbitUpdateManifest.js';
import { IVoidUpdateService } from '../common/orbitUpdateService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import * as dom from '../../../../base/browser/dom.js';
import { VoidCheckUpdateRespose } from '../common/orbitUpdateServiceTypes.js';
import { IAction } from '../../../../base/common/actions.js';




const notifyUpdate = (res: VoidCheckUpdateRespose & { message: string }, notifService: INotificationService, voidUpdateService: IVoidUpdateService): INotificationHandle => {
	const message = res?.message || `A new version of Orbit is available. Download it from [GitHub Releases](${ORBIT_RELEASES_URL}).`;

	let actions: INotificationActions | undefined;

	if (res?.action) {
		const primary: IAction[] = [];

		if (res.action === 'install') {
			const installLabel = isWindows ? 'Install now' : isMacintosh ? 'Install update' : 'Install update';
			primary.push({
				label: installLabel,
				id: 'orbit.updater.install',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: async () => {
					try {
						await voidUpdateService.install();
					} catch (error) {
						notifService.error(`Orbit update install failed: ${error}`);
					}
				}
			});
		}

		if (res.action === 'openRelease') {
			primary.push({
				label: `Open releases`,
				id: 'orbit.updater.openRelease',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: () => {
					const { window } = dom.getActiveWindow();
					window.open(ORBIT_RELEASES_URL);
				}
			});
		} else if (res.action === 'install') {
			primary.push({
				id: 'orbit.updater.site',
				enabled: true,
				label: `View release`,
				tooltip: '',
				class: undefined,
				run: () => {
					const { window } = dom.getActiveWindow();
					window.open(ORBIT_RELEASES_URL);
				}
			});
		}

		actions = {
			primary: primary,
			secondary: [{
				id: 'orbit.updater.close',
				enabled: true,
				label: `Later`,
				tooltip: '',
				class: undefined,
				run: () => {
					notifController.close();
				}
			}]
		};
	}
	else {
		actions = undefined;
	}

	const notifController = notifService.notify({
		severity: Severity.Info,
		message: message,
		sticky: true,
		progress: actions ? { worked: 0, total: 100 } : undefined,
		actions: actions,
	});

	return notifController;
};

const notifyErrChecking = (notifService: INotificationService): INotificationHandle => {
	const message = `Orbit could not check for updates. You can download the latest version from [GitHub Releases](${ORBIT_RELEASES_URL}).`;
	const notifController = notifService.notify({
		severity: Severity.Info,
		message: message,
		sticky: true,
	});
	return notifController;
};


const performVoidCheck = async (
	explicit: boolean,
	notifService: INotificationService,
	voidUpdateService: IVoidUpdateService,
	metricsService: IMetricsService,
): Promise<INotificationHandle | null> => {

	const metricsTag = explicit ? 'Manual' : 'Auto';

	console.log('[Orbit Update] Starting check, explicit:', explicit);
	metricsService.capture(`Orbit Update ${metricsTag}: Checking...`, {});

	const statusHandle = explicit ? notifService.status('Checking for Orbit updates...') : undefined;

	try {
		const res = await voidUpdateService.check(explicit);
		console.log('[Orbit Update] Check result:', res);

		if (!res) {
			const notifController = notifyErrChecking(notifService);
			metricsService.capture(`Orbit Update ${metricsTag}: Error`, { res });
			return notifController;
		}

		if (res.message) {
			if (!explicit && res.action === 'install' && isWindows) {
				metricsService.capture(`Orbit Update ${metricsTag}: AutoInstall`, { res });
				try {
					await voidUpdateService.install();
					return null;
				} catch (error) {
					notifService.error(`Automatic Orbit update failed: ${error}`);
				}
			}

			const notifController = notifyUpdate(res, notifService, voidUpdateService);
			metricsService.capture(`Orbit Update ${metricsTag}: Yes`, { res });
			return notifController;
		}

		console.log('[Orbit Update] No message to show - up to date or silent check');
		metricsService.capture(`Orbit Update ${metricsTag}: No`, { res });
		if (explicit) {
			notifService.info('Orbit is up-to-date.');
		}
		return null;
	} catch (error) {
		console.error('[Orbit Update] Check threw', error);
		const notifController = notifyErrChecking(notifService);
		metricsService.capture(`Orbit Update ${metricsTag}: Error`, { error: String(error) });
		return notifController;
	} finally {
		statusHandle?.dispose();
	}
};


// Action
let lastNotifController: INotificationHandle | null = null;


registerAction2(class extends Action2 {
	constructor() {
		super({
			f1: true,
			id: 'void.voidCheckUpdate',
			title: localize2('voidCheckUpdate', 'Orbit: Check for Updates'),
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const voidUpdateService = accessor.get(IVoidUpdateService);
		const notifService = accessor.get(INotificationService);
		const metricsService = accessor.get(IMetricsService);

		const currNotifController = lastNotifController;

		const newController = await performVoidCheck(true, notifService, voidUpdateService, metricsService);

		if (newController) {
			currNotifController?.close();
			lastNotifController = newController;
		}
	}
});

// on mount
class VoidUpdateWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.void.voidUpdate';
	constructor(
		@IVoidUpdateService voidUpdateService: IVoidUpdateService,
		@IMetricsService metricsService: IMetricsService,
		@INotificationService notifService: INotificationService,
	) {
		super();

		const autoCheck = () => {
			performVoidCheck(false, notifService, voidUpdateService, metricsService);
		};

		// check once 5 seconds after mount
		// check every 3 hours
		const { window } = dom.getActiveWindow();

		const initId = window.setTimeout(() => autoCheck(), 5 * 1000);
		this._register({ dispose: () => window.clearTimeout(initId) });


		const intervalId = window.setInterval(() => autoCheck(), 3 * 60 * 60 * 1000); // every 3 hrs
		this._register({ dispose: () => window.clearInterval(intervalId) });

	}
}
registerWorkbenchContribution2(VoidUpdateWorkbenchContribution.ID, VoidUpdateWorkbenchContribution, WorkbenchPhase.BlockRestore);