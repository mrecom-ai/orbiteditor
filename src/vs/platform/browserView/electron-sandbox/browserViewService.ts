/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainProcessService } from '../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { ProxyChannel } from '../../../base/parts/ipc/common/ipc.js';
import { INativeHostService } from '../../../platform/native/common/native.js';
import { IBrowserViewService } from '../common/browserView.js';

/**
 * Renderer-side proxy for `BrowserViewMainService`. All calls are forwarded to the main
 * process over the `browserView` IPC channel, with `nativeHostService.windowId` injected
 * as the IPC context so the main process knows which Electron window owns the calling
 * editor pane.
 */
// @ts-ignore: interface is implemented via proxy
export class BrowserViewService implements IBrowserViewService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@INativeHostService nativeHostService: INativeHostService,
	) {
		return ProxyChannel.toService<IBrowserViewService>(
			mainProcessService.getChannel('browserView'),
			{
				context: nativeHostService.windowId,
				properties: (() => {
					const properties = new Map<string, unknown>();
					// Prevent JSON.stringify / structured-clone walks from routing `.toJSON`
					// through the IPC proxy (which has no such handler on the main channel).
					properties.set('toJSON', () => ({}));
					return properties;
				})(),
			},
		);
	}
}

registerSingleton(IBrowserViewService, BrowserViewService, InstantiationType.Delayed);
