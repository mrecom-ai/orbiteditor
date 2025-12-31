/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel } from '../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../ipc/common/mainProcessService.js';
import { IBrowserAutomationService, IAutomationResult } from '../common/browserAutomation.js';

export class BrowserAutomationService implements IBrowserAutomationService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		this.channel = mainProcessService.getChannel('browserAutomation');
	}

	createSession(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>> {
		return this.channel.call('createSession', params);
	}

	closeSession(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('closeSession', params);
	}

	navigate(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>> {
		return this.channel.call('navigate', params);
	}

	goBack(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('goBack', params);
	}

	goForward(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('goForward', params);
	}

	reload(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('reload', params);
	}

	getUrl(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		return this.channel.call('getUrl', params);
	}

	click(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>> {
		return this.channel.call('click', params);
	}

	type(params: { sessionId: string; selector: string; text: string; options?: any }): Promise<IAutomationResult<void>> {
		return this.channel.call('type', params);
	}

	fill(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('fill', params);
	}

	press(params: { sessionId: string; key: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('press', params);
	}

	hover(params: { sessionId: string; selector: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('hover', params);
	}

	select(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('select', params);
	}

	screenshot(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>> {
		return this.channel.call('screenshot', params);
	}

	pdf(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>> {
		return this.channel.call('pdf', params);
	}

	getContent(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		return this.channel.call('getContent', params);
	}

	getTitle(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		return this.channel.call('getTitle', params);
	}

	extractText(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>> {
		return this.channel.call('extractText', params);
	}

	extractHTML(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>> {
		return this.channel.call('extractHTML', params);
	}

	evaluate(params: { sessionId: string; script: string }): Promise<IAutomationResult<any>> {
		return this.channel.call('evaluate', params);
	}

	waitForSelector(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>> {
		return this.channel.call('waitForSelector', params);
	}

	waitForNavigation(params: { sessionId: string; options?: any }): Promise<IAutomationResult<void>> {
		return this.channel.call('waitForNavigation', params);
	}

	getCookies(params: { sessionId: string; urls?: string[] }): Promise<IAutomationResult<any[]>> {
		return this.channel.call('getCookies', params);
	}

	setCookies(params: { sessionId: string; cookies: any[] }): Promise<IAutomationResult<void>> {
		return this.channel.call('setCookies', params);
	}

	clearCookies(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		return this.channel.call('clearCookies', params);
	}

	snapshot(params: { sessionId: string; options?: any }): Promise<IAutomationResult<any>> {
		return this.channel.call('snapshot', params);
	}
}
