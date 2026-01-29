/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts

import { Notification, BrowserWindow } from 'electron';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';

export interface INativeNotificationParams {
	title: string;
	body: string;
}

export class NativeNotificationChannel implements IServerChannel {

	constructor(
		private readonly getWindow: () => BrowserWindow | undefined
	) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'show':
				return this._showNotification(params);
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}

	private async _showNotification(params: INativeNotificationParams): Promise<void> {
		const { title, body } = params;

		const notification = new Notification({
			title,
			body,
			silent: false, // Play system sound
			urgency: 'normal' as any, // Linux only
			timeoutType: 'default' as any
		});

		// Handle notification click - focus the window
		notification.on('click', () => {
			const window = this.getWindow();
			if (window) {
				if (window.isMinimized()) {
					window.restore();
				}
				window.focus();
			}
		});

		notification.show();
	}
}
