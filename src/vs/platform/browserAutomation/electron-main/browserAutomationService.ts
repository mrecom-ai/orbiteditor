/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IBrowserAutomationService, IAutomationResult } from '../common/browserAutomation.js';
import { app } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

interface SessionData {
	page: any; // puppeteer Page
	createdAt: number;
}

interface AccessibilitySnapshotOptions {
	interestingOnly?: boolean;
}

export class BrowserAutomationService implements IBrowserAutomationService {
	readonly _serviceBrand: undefined;

	private browser: any | undefined; // puppeteer Browser
	private sessions: Map<string, SessionData> = new Map();

	/**
	 * Find Chrome/Chromium executable path
	 */
	private findChromePath(): string | undefined {
		const platformName = platform();
		const possiblePaths: string[] = [];

		if (platformName === 'win32') {
			// Windows paths
			possiblePaths.push(
				join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
				join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
				join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
				join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
				join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe')
			);
		} else if (platformName === 'darwin') {
			// macOS paths
			possiblePaths.push(
				'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
				'/Applications/Chromium.app/Contents/MacOS/Chromium',
				'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
				join(process.env.HOME || '', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
			);
		} else {
			// Linux paths
			possiblePaths.push(
				'/usr/bin/google-chrome',
				'/usr/bin/google-chrome-stable',
				'/usr/bin/chromium',
				'/usr/bin/chromium-browser',
				'/snap/bin/chromium',
				'/usr/bin/microsoft-edge',
				'/usr/bin/microsoft-edge-dev'
			);
		}

		// Find first existing path
		for (const path of possiblePaths) {
			if (path && existsSync(path)) {
				return path;
			}
		}

		// Try to use Electron's executable as last resort (it's chromium-based)
		const electronPath = app.getPath('exe');
		if (electronPath && existsSync(electronPath)) {
			console.warn('Using Electron executable for browser automation. This may have limitations.');
			return electronPath;
		}

		return undefined;
	}

	async initialize(): Promise<void> {
		try {
			// Find Chrome executable
			const executablePath = this.findChromePath();

			if (!executablePath) {
				throw new Error(
					'Could not find Chrome/Chromium installation. Please install Google Chrome, Microsoft Edge, or Chromium to use browser automation features.'
				);
			}

			console.log(`Using browser executable: ${executablePath}`);

			// Dynamically import puppeteer-core
			const puppeteer = await import('puppeteer-core');

			// Launch Puppeteer browser with executable path
			this.browser = await puppeteer.default.launch({
				executablePath,
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-accelerated-2d-canvas',
					'--no-first-run',
					'--no-zygote',
					'--disable-gpu',
					'--disable-software-rasterizer',
					'--disable-extensions'
				]
			});

			console.log('Browser automation initialized successfully');
		} catch (error) {
			console.error('Failed to initialize browser automation:', error);
			throw error;
		}
	}

	private wrapResult<T>(data: T): IAutomationResult<T> {
		return { success: true, data };
	}

	private wrapError(error: any): IAutomationResult<never> {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}

	async createSession(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>> {
		try {
			if (!this.browser) {
				await this.initialize();
			}

			if (!this.browser) {
				return this.wrapError('Browser not initialized');
			}

			const page = await this.browser.newPage();

			// Set viewport if provided
			if (params.options?.viewport) {
				await page.setViewport(params.options.viewport);
			}

			// Set user agent if provided
			if (params.options?.userAgent) {
				await page.setUserAgent(params.options.userAgent);
			}

			// Navigate to URL
			await page.goto(params.url, { waitUntil: 'load', timeout: 10000 });

			// Store session
			this.sessions.set(params.sessionId, {
				page,
				createdAt: Date.now()
			});

			return this.wrapResult(params.sessionId);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async closeSession(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.close();
			this.sessions.delete(params.sessionId);

			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async navigate(params: { sessionId: string; url: string; options?: any }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.goto(params.url, {
				waitUntil: params.options?.waitUntil ?? 'load',
				timeout: params.options?.timeout ?? 10000
			});

			const url = session.page.url();
			return this.wrapResult(url);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async goBack(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.goBack({ waitUntil: 'load' });
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async goForward(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.goForward({ waitUntil: 'load' });
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async reload(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.reload({ waitUntil: 'load' });
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async getUrl(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const url = session.page.url();
			return this.wrapResult(url);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async click(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.click(params.selector, params.options);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async type(params: { sessionId: string; selector: string; text: string; options?: any }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.type(params.selector, params.text, params.options);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async fill(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.$eval(params.selector, (el: any, value: string) => {
				el.value = value;
			}, params.value);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async press(params: { sessionId: string; key: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.keyboard.press(params.key as any);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async hover(params: { sessionId: string; selector: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.hover(params.selector);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async select(params: { sessionId: string; selector: string; value: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.select(params.selector, params.value);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async screenshot(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const screenshot = await session.page.screenshot({
				encoding: 'base64',
				...params.options
			});
			return this.wrapResult(screenshot as string);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async pdf(params: { sessionId: string; options?: any }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const pdf = await session.page.pdf(params.options);
			return this.wrapResult(pdf.toString('base64'));
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async getContent(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const content = await session.page.content();
			return this.wrapResult(content);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async getTitle(params: { sessionId: string }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const title = await session.page.title();
			return this.wrapResult(title);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async extractText(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const text = await session.page.$eval(params.selector, (el: any) => el.textContent || el.innerText || '');
			return this.wrapResult(text);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async extractHTML(params: { sessionId: string; selector: string }): Promise<IAutomationResult<string>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const html = await session.page.$eval(params.selector, (el: any) => el.outerHTML || '');
			return this.wrapResult(html);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async evaluate(params: { sessionId: string; script: string }): Promise<IAutomationResult<any>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const result = await session.page.evaluate(params.script);
			return this.wrapResult(result);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async waitForSelector(params: { sessionId: string; selector: string; options?: any }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.waitForSelector(params.selector, {
				timeout: params.options?.timeout ?? 10000,
				visible: params.options?.visible,
				hidden: params.options?.hidden
			});
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async waitForNavigation(params: { sessionId: string; options?: any }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.waitForNavigation({
				timeout: params.options?.timeout ?? 10000,
				waitUntil: params.options?.waitUntil ?? 'load'
			});
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async getCookies(params: { sessionId: string; urls?: string[] }): Promise<IAutomationResult<any[]>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const cookies = await session.page.cookies(...(params.urls || []));
			return this.wrapResult(cookies);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async setCookies(params: { sessionId: string; cookies: any[] }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			await session.page.setCookie(...params.cookies);
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async clearCookies(params: { sessionId: string }): Promise<IAutomationResult<void>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			const client = await session.page.createCDPSession();
			await client.send('Network.clearBrowserCookies');
			return this.wrapResult(undefined);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async snapshot(params: { sessionId: string; options?: AccessibilitySnapshotOptions }): Promise<IAutomationResult<any>> {
		try {
			const session = this.sessions.get(params.sessionId);
			if (!session) {
				return this.wrapError('Session not found');
			}

			// Call Puppeteer's accessibility.snapshot() API
			const snapshot = await session.page.accessibility.snapshot({
				interestingOnly: params.options?.interestingOnly ?? true
			});

			// snapshot can be null for empty pages
			return this.wrapResult(snapshot);
		} catch (error) {
			return this.wrapError(error);
		}
	}

	async dispose(): Promise<void> {
		// Close all sessions
		for (const session of this.sessions.values()) {
			await session.page.close().catch(console.error);
		}
		this.sessions.clear();

		// Close browser
		if (this.browser) {
			await this.browser.close().catch(console.error);
			this.browser = undefined;
		}
	}
}
