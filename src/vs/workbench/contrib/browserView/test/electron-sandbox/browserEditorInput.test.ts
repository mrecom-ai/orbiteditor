/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Schemas } from '../../../../../base/common/network.js';
import { BrowserEditorInput } from '../../electron-sandbox/browserEditorInput.js';

suite('BrowserEditorInput', () => {

	test('resource URI is stable across URL changes', () => {
		const input = new BrowserEditorInput({ url: 'https://www.google.com/' });
		const resourceBefore = input.resource.toString();
		input.setUrl('https://www.google.com/search?q=cursor');
		assert.strictEqual(input.resource.toString(), resourceBefore);
		assert.strictEqual(input.url, 'https://www.google.com/search?q=cursor');
	});

	test('resource uses vscode-browser scheme and id path', () => {
		const input = new BrowserEditorInput({ url: 'https://example.com', id: 'test-tab-id' });
		assert.strictEqual(input.resource.scheme, Schemas.vscodeBrowser);
		assert.strictEqual(input.resource.path, 'browser/test-tab-id');
		assert.strictEqual(input.resource.query, '');
	});
});
