/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IBrowserAutomationService } from '../../../../platform/browserAutomation/common/browserAutomation.js';

/**
 * Register browser automation commands for extensions to use
 */
(function registerBrowserAutomationCommands(): void {

	CommandsRegistry.registerCommand('_browserAutomation.createSession', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.createSession(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.closeSession', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.closeSession(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.navigate', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.navigate(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.goBack', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.goBack(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.goForward', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.goForward(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.reload', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.reload(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.getUrl', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.getUrl(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.click', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.click(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.type', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.type(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.fill', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.fill(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.press', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.press(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.hover', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.hover(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.select', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.select(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.screenshot', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.screenshot(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.pdf', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.pdf(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.getContent', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.getContent(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.getTitle', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.getTitle(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.extractText', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.extractText(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.extractHTML', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.extractHTML(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.evaluate', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.evaluate(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.waitForSelector', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.waitForSelector(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.waitForNavigation', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.waitForNavigation(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.getCookies', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.getCookies(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.setCookies', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.setCookies(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.clearCookies', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.clearCookies(params);
	});

	CommandsRegistry.registerCommand('_browserAutomation.snapshot', async (accessor, params) => {
		const browserAutomationService = accessor.get(IBrowserAutomationService);
		return await browserAutomationService.snapshot(params);
	});

})();
