/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { EditorInputCapabilities, IUntypedEditorInput, ISaveOptions, GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IFileService, FileChangeType } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IFilesConfigurationService } from '../../../services/filesConfiguration/common/filesConfigurationService.js';
import { ParsedPlan, parsePlanFile } from '../common/planTemplate.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { isEqual } from '../../../../base/common/resources.js';
import { Emitter } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

export class PlanEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.void.planEditor';

	private _resource: URI;
	private _parsedPlan: ParsedPlan | undefined;
	private _isDirty: boolean = false;
	private _currentContent: string = '';
	private _fileWatcher: IDisposable | undefined;

	// Event for external file changes
	private readonly _onDidChangeExternalContent = new Emitter<void>();
	readonly onDidChangeExternalContent = this._onDidChangeExternalContent.event;

	constructor(
		resource: URI,
		@IFileService private readonly fileService: IFileService,
		@ILabelService private readonly labelService: ILabelService,
		@IFilesConfigurationService private readonly filesConfigurationService: IFilesConfigurationService
	) {
		super();
		this._resource = resource;
		this._setupFileWatcher();
	}

	// Setup file watcher to detect external changes
	private _setupFileWatcher(): void {
		this._fileWatcher = this.fileService.watch(this._resource);

		// Listen for file changes
		this._register(this.fileService.onDidFilesChange(async (event) => {
			// Check if our file was updated
			const wasUpdated = event.contains(this._resource, FileChangeType.UPDATED);

			if (wasUpdated && !this._isDirty) {
				// File was changed externally (not by us) - reload it
				console.log('[PlanEditorInput] External file change detected, reloading...');
				await this.reloadFromDisk();
				this._onDidChangeExternalContent.fire();
			}
		}));
	}

	// Reload content from disk without marking as dirty
	private async reloadFromDisk(): Promise<void> {
		try {
			const content = await this.fileService.readFile(this._resource);
			const contentStr = content.value.toString();
			this._currentContent = contentStr;
			this._parsedPlan = parsePlanFile(contentStr);
		} catch (error) {
			console.error('[PlanEditorInput] Failed to reload from disk:', error);
		}
	}

	// Core EditorInput overrides
	override get typeId(): string {
		return PlanEditorInput.ID;
	}

	override get editorId(): string {
		return 'workbench.editor.voidPlanEditor';
	}

	override get resource(): URI {
		return this._resource;
	}

	override get capabilities(): EditorInputCapabilities {
		let capabilities = EditorInputCapabilities.CanSplitInGroup;

		if (this.filesConfigurationService.isReadonly(this._resource)) {
			capabilities |= EditorInputCapabilities.Readonly;
		}

		return capabilities;
	}

	// Display name
	override getName(): string {
		return this.labelService.getUriBasenameLabel(this._resource);
	}

	// Dirty state
	override isDirty(): boolean {
		return this._isDirty;
	}

	// Get current parsed plan
	getParsedPlan(): ParsedPlan | undefined {
		return this._parsedPlan;
	}

	// Get current content
	getCurrentContent(): string {
		return this._currentContent;
	}

	// Load plan from file system
	async loadPlan(): Promise<ParsedPlan> {
		try {
			const content = await this.fileService.readFile(this._resource);
			const contentStr = content.value.toString();
			this._currentContent = contentStr;
			this._parsedPlan = parsePlanFile(contentStr);
			return this._parsedPlan;
		} catch (error) {
			// Return fallback plan with error message
			return this.createErrorPlan(error);
		}
	}

	// Update content (from React component)
	updateContent(content: string): void {
		if (this._currentContent !== content) {
			this._currentContent = content;
			try {
				this._parsedPlan = parsePlanFile(content);
			} catch {
				// Ignore parse errors during editing
			}
			this._isDirty = true;
			this._onDidChangeDirty.fire();
		}
	}

	// Save to file system
	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<EditorInput | IUntypedEditorInput | undefined> {
		try {
			await this.fileService.writeFile(
				this._resource,
				VSBuffer.fromString(this._currentContent)
			);
			this._isDirty = false;
			this._onDidChangeDirty.fire();
			return this;
		} catch (error) {
			console.error('Failed to save plan:', error);
			return undefined;
		}
	}

	// Revert unsaved changes
	override async revert(group: GroupIdentifier, options?: any): Promise<void> {
		await this.loadPlan();
		this._isDirty = false;
		this._onDidChangeDirty.fire();
	}

	// Helper: Create fallback plan for errors
	private createErrorPlan(error: any): ParsedPlan {
		return {
			metadata: {
				title: 'Parse Error',
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				status: 'planning'
			},
			sections: {
				overview: `**Error loading plan file:**\n\n${error.message}`,
				files: '',
				steps: '',
				checklist: '',
				testing: '',
				notes: ''
			},
			rawContent: this._currentContent
		};
	}

	// Match other editor inputs
	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (other instanceof PlanEditorInput) {
			return isEqual(other.resource, this._resource);
		}
		return false;
	}

	// Serialization
	override toUntyped(): IUntypedEditorInput | undefined {
		return {
			resource: this._resource,
			options: {
				override: this.editorId
			}
		};
	}

	override dispose(): void {
		this._fileWatcher?.dispose();
		this._onDidChangeExternalContent.dispose();
		super.dispose();
	}
}
