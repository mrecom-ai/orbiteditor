/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService, IContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { PlanEditorInput } from './planEditorInput.js';
import { CONTEXT_VOID_PLAN_EDITOR_ACTIVE, CONTEXT_VOID_PLAN_VIEW_MODE } from './planEditorCommands.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';

export class PlanEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.voidPlanEditor';

	private _container: HTMLElement | undefined;
	private _reactDisposable: IDisposable | undefined;
	private _contextKeys: {
		editorActive: IContextKey<boolean>;
		viewMode: IContextKey<string>;
	};
	private _currentViewMode: 'preview' | 'markdown' = 'preview';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(PlanEditorPane.ID, group, telemetryService, themeService, storageService);

		// Bind context keys
		this._contextKeys = {
			editorActive: CONTEXT_VOID_PLAN_EDITOR_ACTIVE.bindTo(contextKeyService),
			viewMode: CONTEXT_VOID_PLAN_VIEW_MODE.bindTo(contextKeyService)
		};
	}

	// Create DOM container for React
	protected createEditor(parent: HTMLElement): void {
		this._container = document.createElement('div');
		this._container.classList.add('plan-editor-container');
		this._container.style.width = '100%';
		this._container.style.height = '100%';
		this._container.style.overflow = 'hidden';
		parent.appendChild(this._container);
	}

	// Load editor input and mount React
	override async setInput(
		input: EditorInput,
		options: any | undefined,
		context: IEditorOpenContext,
		token: CancellationToken
	): Promise<void> {
		await super.setInput(input, options, context, token);

		if (!(input instanceof PlanEditorInput)) {
			throw new Error('PlanEditorPane requires PlanEditorInput');
		}

		// Load plan content
		const parsedPlan = await input.loadPlan();

		// Mount React component
		if (this._container) {
			const { mountPlanEditor } = await import('./react/out/plan-editor-tsx/index.js');

			this._reactDisposable = this.instantiationService.invokeFunction(
				accessor => {
					const disposeFn = mountPlanEditor(this._container!, accessor, {
						plan: parsedPlan,
						resource: input.resource,
						initialViewMode: this._currentViewMode,
						onSave: async (content: string) => {
							input.updateContent(content);
							const result = await input.save(this.group.id);
							if (!result) {
								this.notificationService.error('Failed to save plan file');
							} else {
								this.notificationService.info('Plan saved successfully');
							}
						},
						onContentChange: (content: string) => {
							input.updateContent(content);
						}
					})?.dispose;
					return toDisposable(() => disposeFn?.());
				}
			);
		}

		// Update context keys
		this._contextKeys.editorActive.set(true);
		this._contextKeys.viewMode.set(this._currentViewMode);
	}

	// Clear input on editor close
	override clearInput(): void {
		this._reactDisposable?.dispose();
		this._reactDisposable = undefined;
		this._contextKeys.editorActive.set(false);
		super.clearInput();
	}

	// Handle layout changes
	override layout(dimension: Dimension): void {
		if (this._container) {
			this._container.style.width = `${dimension.width}px`;
			this._container.style.height = `${dimension.height}px`;
		}
	}

	// Focus management
	override focus(): void {
		this._container?.focus();
	}

	// Public API for commands
	setViewMode(mode: 'preview' | 'markdown'): void {
		if (this._currentViewMode === mode) return;

		this._currentViewMode = mode;
		this._contextKeys.viewMode.set(mode);

		// Remount React with new view mode
		if (this._reactDisposable && this.input instanceof PlanEditorInput) {
			this._reactDisposable.dispose();
			this.setInput(this.input, undefined, { newInGroup: false }, CancellationToken.None);
		}
	}

	getViewMode(): 'preview' | 'markdown' {
		return this._currentViewMode;
	}

	// Cleanup
	override dispose(): void {
		this._reactDisposable?.dispose();
		super.dispose();
	}
}
