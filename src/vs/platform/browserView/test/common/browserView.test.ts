/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { resolveBrowserNavigationTarget, shouldDisplayBrowserUrl } from '../../common/browserView.js';

suite('browserView', () => {

	suite('resolveBrowserNavigationTarget', () => {
		test('passes through absolute https URLs', () => {
			assert.strictEqual(
				resolveBrowserNavigationTarget('https://example.com/path'),
				'https://example.com/path',
			);
		});

		test('turns bare search terms into Google search URLs', () => {
			assert.strictEqual(
				resolveBrowserNavigationTarget('cursor'),
				'https://www.google.com/search?q=cursor',
			);
		});

		test('adds https to bare hostnames', () => {
			assert.strictEqual(
				resolveBrowserNavigationTarget('github.com'),
				'https://github.com',
			);
		});
	});

	suite('shouldDisplayBrowserUrl', () => {
		test('rejects blank and internal schemes', () => {
			assert.strictEqual(shouldDisplayBrowserUrl('about:blank'), false);
			assert.strictEqual(shouldDisplayBrowserUrl('data:text/html,hi'), false);
			assert.strictEqual(shouldDisplayBrowserUrl('javascript:void(0)'), false);
		});

		test('accepts normal web URLs', () => {
			assert.strictEqual(shouldDisplayBrowserUrl('https://www.google.com/search?q=cursor'), true);
		});
	});
});
