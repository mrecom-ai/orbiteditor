/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { EditorInputCapabilities, IUntypedEditorInput, Verbosity } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export interface IBrowserEditorInputData {
	readonly url: string;
	readonly title?: string;
	readonly homeUrl?: string;
	/** Stable tab id; restored from session serialization when present. */
	readonly id?: string;
	/** Optional favicon data URL for tab display. */
	readonly favicon?: string | null;
}

export interface IBrowserEditorInputUntyped extends IBrowserEditorInputData {
	readonly options?: { readonly pinned?: boolean; readonly preview?: boolean };
}

/**
 * `EditorInput` for the integrated native browser. Each input corresponds to one browser
 * tab and owns a stable `BrowserViewId` that the main process uses to identify the backing
 * `WebContentsView`. The input is `Readonly` and `Singleton`. Identity is keyed off the
 * immutable {@link id}; the address-bar URL is deliberately NOT part of identity because it
 * mutates on every navigation (two distinct tabs must never become "equal" just because they
 * happen to be on the same page).
 *
 * This is a plain, serializable data holder — it deliberately holds NO service references (an
 * injected IPC proxy here gets walked and mis-serialized when the editor-tabs model is cloned to
 * the extension host). The backing `WebContentsView`'s lifetime is owned by
 * `BrowserViewOverlayManager`, which closes the view on this input's `onWillDispose` (the pane is
 * shared across a group's editors, so it cannot be the owner either).
 */
export class BrowserEditorInput extends EditorInput {

	public static readonly typeId = 'workbench.editors.browserEditorInput';

	public override get typeId(): string {
		return BrowserEditorInput.typeId;
	}

	public override get editorId(): string | undefined {
		return BrowserEditorInput.typeId;
	}

	public override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	public readonly id: string;

	private _url: string;
	private _title: string;
	private _homeUrl: string;
	private _favicon: string | null;

	constructor(data: IBrowserEditorInputData) {
		super();
		this.id = data.id ?? generateUuid();
		this._url = data.url;
		this._homeUrl = data.homeUrl ?? data.url;
		this._title = data.title ?? '';
		this._favicon = data.favicon ?? null;
	}

	get resource(): URI {
		// URL is intentionally excluded from the resource URI — it mutates on every navigation
		// and would destabilize ext-host tab IDs (see webviewEditorInput for the same pattern).
		return URI.from({
			scheme: Schemas.vscodeBrowser,
			path: `browser/${this.id}`,
		});
	}

	get url(): string {
		return this._url;
	}

	get homeUrl(): string {
		return this._homeUrl;
	}

	setUrl(url: string): void {
		if (this._url === url) {
			return;
		}
		this._url = url;
		// Tab label is driven by page title (setTitle), not URL — firing onDidChangeLabel here
		// would churn the ext-host tabs model on every navigation.
	}

	override getTitle(_verbosity?: Verbosity): string {
		return this._title || this._url;
	}

	override getName(): string {
		return this._title || this._url;
	}

	override getDescription(_verbosity?: Verbosity): string | undefined {
		return this._url;
	}

	getTooltip(): string | undefined {
		return this._url;
	}

	get title(): string {
		return this._title;
	}

	setTitle(title: string): void {
		if (this._title === title) {
			return;
		}
		this._title = title;
		this._onDidChangeLabel.fire();
	}

	get favicon(): string | null {
		return this._favicon;
	}

	setFavicon(favicon: string | null): void {
		if (this._favicon === favicon) {
			return;
		}
		this._favicon = favicon;
		this._onDidChangeLabel.fire();
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (this === other) {
			return true;
		}
		if (other instanceof BrowserEditorInput) {
			// Identity is the immutable id only. Never the URL: it mutates on navigation, so a
			// URL-based compare makes two different tabs collide once they visit the same page.
			return other.id === this.id;
		}
		if (isIBrowserEditorInputUntyped(other)) {
			return other.url === this._url;
		}
		return false;
	}

	override toUntyped(): IBrowserEditorInputUntyped & IUntypedEditorInput {
		return {
			id: this.id,
			url: this._url,
			title: this._title,
			homeUrl: this.homeUrl,
		} as IBrowserEditorInputUntyped & IUntypedEditorInput;
	}

	override dispose(): void {
		// The backing WebContentsView is closed by BrowserViewOverlayManager on `onWillDispose`
		// (fired just before this runs); nothing to do here beyond the base cleanup.
		super.dispose();
	}
}

function isIBrowserEditorInputUntyped(input: unknown): input is IBrowserEditorInputUntyped {
	const candidate = input as IBrowserEditorInputUntyped | undefined;
	return !!candidate && typeof candidate.url === 'string';
}
