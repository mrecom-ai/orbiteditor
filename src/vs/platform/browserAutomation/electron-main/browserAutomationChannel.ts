/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import { IBrowserAutomationService } from '../common/browserAutomation.js';

export class BrowserAutomationChannel implements IServerChannel {
	constructor(private readonly service: IBrowserAutomationService) { }

	listen<T>(_: unknown, event: string): Event<T> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'createSession':
				return this.service.createSession(arg);
			case 'closeSession':
				return this.service.closeSession(arg);
			case 'navigate':
				return this.service.navigate(arg);
			case 'goBack':
				return this.service.goBack(arg);
			case 'goForward':
				return this.service.goForward(arg);
			case 'reload':
				return this.service.reload(arg);
			case 'getUrl':
				return this.service.getUrl(arg);
			case 'click':
				return this.service.click(arg);
			case 'type':
				return this.service.type(arg);
			case 'fill':
				return this.service.fill(arg);
			case 'press':
				return this.service.press(arg);
			case 'hover':
				return this.service.hover(arg);
			case 'select':
				return this.service.select(arg);
			case 'screenshot':
				return this.service.screenshot(arg);
			case 'pdf':
				return this.service.pdf(arg);
			case 'getContent':
				return this.service.getContent(arg);
			case 'getTitle':
				return this.service.getTitle(arg);
			case 'extractText':
				return this.service.extractText(arg);
			case 'extractHTML':
				return this.service.extractHTML(arg);
			case 'evaluate':
				return this.service.evaluate(arg);
			case 'waitForSelector':
				return this.service.waitForSelector(arg);
			case 'waitForNavigation':
				return this.service.waitForNavigation(arg);
			case 'getCookies':
				return this.service.getCookies(arg);
			case 'setCookies':
				return this.service.setCookies(arg);
			case 'clearCookies':
				return this.service.clearCookies(arg);
			case 'snapshot':
				return this.service.snapshot(arg);
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}

	dispose() {
		// No-op
	}
}
