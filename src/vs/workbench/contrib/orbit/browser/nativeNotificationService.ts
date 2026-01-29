/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IHostService } from '../../../services/host/browser/host.js';
import { isElectron, isWeb } from '../../../../base/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export const IVoidNativeNotificationService = createDecorator<IVoidNativeNotificationService>('voidNativeNotificationService');

export interface IVoidNativeNotificationService {
	readonly _serviceBrand: undefined;

	/**
	 * Show a native OS notification.
	 * Only shows if window is not focused (unless forced).
	 */
	showNotification(title: string, body: string, force?: boolean): Promise<void>;
}

export class VoidNativeNotificationService extends Disposable implements IVoidNativeNotificationService {
	readonly _serviceBrand: undefined;

	private _webPermissionRequested = false;

	constructor(
		@IHostService private readonly _hostService: IHostService,
		@IMainProcessService private readonly _mainProcessService: IMainProcessService
	) {
		super();
	}

	async showNotification(title: string, body: string, force: boolean = false): Promise<void> {
		try {
			// Only show if window is not focused (unless forced)
			if (!force && this._hostService.hasFocus) {
				return;
			}

			if (isElectron) {
				await this._showElectronNotification(title, body);
			} else if (isWeb) {
				await this._showWebNotification(title, body);
			}
		} catch (error) {
			// Fail silently - notifications are non-critical
			console.debug('Failed to show native notification:', error);
		}
	}

	private async _showElectronNotification(title: string, body: string): Promise<void> {
		const channel = this._mainProcessService.getChannel('voidNativeNotification');
		await channel.call('show', { title, body });
	}

	private async _showWebNotification(title: string, body: string): Promise<void> {
		// Check if Notification API is available
		if (typeof Notification === 'undefined') {
			console.debug('Web Notifications API not available');
			return;
		}

		// Check/request permission
		if (Notification.permission === 'denied') {
			return; // User denied, don't show anything
		}

		if (Notification.permission === 'default' && !this._webPermissionRequested) {
			this._webPermissionRequested = true;
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				return;
			}
		}

		if (Notification.permission === 'granted') {
			const notification = new Notification(title, {
				body,
				icon: '/resources/app/resources/icon.png', // Adjust path as needed
				silent: false
			});

			// Focus window when clicked
			notification.onclick = () => {
				window.focus();
				notification.close();
			};

			// Auto-close after 5 seconds
			setTimeout(() => notification.close(), 5000);
		}
	}
}

registerSingleton(IVoidNativeNotificationService, VoidNativeNotificationService, InstantiationType.Delayed);
