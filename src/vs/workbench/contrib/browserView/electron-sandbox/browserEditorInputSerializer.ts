/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorSerializer } from '../../../common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { BrowserEditorInput, IBrowserEditorInputData } from './browserEditorInput.js';

interface SerializedBrowserEditor {
	readonly id?: string;
	readonly url: string;
	readonly title?: string;
	readonly homeUrl?: string;
	readonly favicon?: string | null;
}

export class BrowserEditorInputSerializer implements IEditorSerializer {

	public static readonly ID = BrowserEditorInput.typeId;

	canSerialize(input: BrowserEditorInput): boolean {
		return !!input.url;
	}

	serialize(input: BrowserEditorInput): string | undefined {
		if (!this.canSerialize(input)) {
			return undefined;
		}
		const data: SerializedBrowserEditor = {
			id: input.id,
			url: input.url,
			title: input.title || undefined,
			homeUrl: input.homeUrl !== input.url ? input.homeUrl : undefined,
			favicon: input.favicon || undefined,
		};
		return JSON.stringify(data);
	}

	deserialize(_instantiationService: IInstantiationService, serialized: string): BrowserEditorInput {
		const parsed = JSON.parse(serialized) as SerializedBrowserEditor;
		const data: IBrowserEditorInputData = {
			id: parsed.id,
			url: parsed.url,
			title: parsed.title,
			homeUrl: parsed.homeUrl,
			favicon: parsed.favicon,
		};
		return new BrowserEditorInput(data);
	}
}
