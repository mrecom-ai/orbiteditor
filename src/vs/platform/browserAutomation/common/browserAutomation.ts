/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IBrowserAutomationService = createDecorator<IBrowserAutomationService>('browserAutomationService');

/**
 * Automation result wrapper
 */
export interface IAutomationResult<T = any> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Browser automation service interface
 */
export interface IBrowserAutomationService {
	readonly _serviceBrand: undefined;

	// Session management
	createSession(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>>;
	closeSession(params: { sessionId: string }): Promise<IAutomationResult<void>>;

	// Navigation
	navigate(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>>;
	goBack(params: { sessionId: string }): Promise<IAutomationResult<void>>;
	goForward(params: { sessionId: string }): Promise<IAutomationResult<void>>;
	reload(params: { sessionId: string }): Promise<IAutomationResult<void>>;
	getUrl(params: { sessionId: string }): Promise<IAutomationResult<string>>;

	// Interaction
	click(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>>;
	type(params: { sessionId: string; selector: string; text: string; options?: any }): Promise<IAutomationResult<void>>;
	fill(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>>;
	press(params: { sessionId: string; key: string }): Promise<IAutomationResult<void>>;
	hover(params: { sessionId: string; selector: string }): Promise<IAutomationResult<void>>;
	select(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>>;

	// Capture
	screenshot(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>>;
	pdf(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>>;
	getContent(params: { sessionId: string }): Promise<IAutomationResult<string>>;
	getTitle(params: { sessionId: string }): Promise<IAutomationResult<string>>;
	extractText(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>>;
	extractHTML(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>>;
	snapshot(params: { sessionId: string; options?: any }): Promise<IAutomationResult<any>>;

	// Evaluation
	evaluate(params: { sessionId: string; script: string }): Promise<IAutomationResult<any>>;
	waitForSelector(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>>;
	waitForNavigation(params: { sessionId: string; options?: any }): Promise<IAutomationResult<void>>;

	// Cookies
	getCookies(params: { sessionId: string; urls?: string[] }): Promise<IAutomationResult<any[]>>;
	setCookies(params: { sessionId: string; cookies: any[] }): Promise<IAutomationResult<void>>;
	clearCookies(params: { sessionId: string }): Promise<IAutomationResult<void>>;
}
