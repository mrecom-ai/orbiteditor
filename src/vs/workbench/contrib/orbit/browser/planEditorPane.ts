/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
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
import { IChatThreadService } from './chatThreadService.js';
import { IPlanTodoSyncService } from './planTodoSyncService.js';
import { TodoItem } from '../common/chatThreadServiceTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { syncPlanStatus, ParsedPlan } from '../common/planTemplate.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export class PlanEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.voidPlanEditor';

	private _container: HTMLElement | undefined;
	private _reactDisposable: IDisposable | undefined;
	private _externalChangeDisposable: IDisposable | undefined;
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
		@INotificationService private readonly notificationService: INotificationService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IPlanTodoSyncService private readonly planTodoSyncService: IPlanTodoSyncService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IFileService private readonly fileService: IFileService
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

	// Handle Build button click
	private async handleBuild(todos: TodoItem[], input: PlanEditorInput): Promise<void> {
		try {
			// Validate plan before building
			const planContent = await input.loadPlan();

			// Check 1: Valid metadata
			if (!planContent.metadata || !planContent.metadata.title) {
				this.notificationService.error('Plan file has invalid frontmatter. Please check the file format.');
				return;
			}

			// Check 2: Has checklist section
			if (!planContent.sections.checklist || planContent.sections.checklist.trim().length === 0) {
				this.notificationService.error('Plan has no checklist section. Add todos before building.');
				return;
			}

			// Check 3: Todos are parseable
			if (!todos || todos.length === 0) {
				this.notificationService.error('Could not parse any todos from the plan. Check checklist format.');
				return;
			}

			// 1. Get current thread
			const thread = this.chatThreadService.getCurrentThread();
			if (!thread) {
				this.notificationService.error('No active chat thread. Please open a chat first.');
				return;
			}

			// 2. Set linkedPlanPath
			thread.linkedPlanPath = input.resource.fsPath;

			// 3. Initialize thread.todoList with execution todos
			thread.todoList = todos;

			// 4. Update thread state
			thread.lastModified = new Date().toISOString();
			this.chatThreadService.dangerousSetState({
				...this.chatThreadService.state,
				allThreads: {
					...this.chatThreadService.state.allThreads,
					[thread.id]: thread
				}
			});

			// 5. Switch to agent mode
			await this.settingsService.setGlobalSetting('chatMode', 'agent');

			// 5.5. Auto-update plan status to in-progress
			try {
				const currentContent = await this.fileService.readFile(input.resource);
				const statusUpdated = syncPlanStatus(currentContent.value.toString());
				if (statusUpdated !== currentContent.value.toString()) {
					await this.fileService.writeFile(input.resource, VSBuffer.fromString(statusUpdated));
				}
			} catch (error) {
				console.warn('[PlanEditor] Failed to update plan status:', error);
				// Don't block Build on status update failure
			}

			// 6. Start sync watcher
			this.planTodoSyncService.watchThreadTodos(thread.id, input.resource.fsPath);

			// 7. Send plan summary as user message (optimized - not full content)
			const messageContent = `I've created a plan: "${planContent.metadata.title}"

## Overview
${planContent.sections.overview}

## Tasks (${todos.length})
${todos.map((t, i) => `${i + 1}. [${t.status.toUpperCase()}] ${t.content}`).join('\n')}

Let's implement this plan.`;

			await this.chatThreadService.addUserMessageAndStreamResponse({
				userMessage: messageContent,
				threadId: thread.id
			});

			// 8. Build complete (no notification per user request)
			console.log(`[PlanEditor] Build initiated for plan: ${input.resource.fsPath}`);
		} catch (error) {
			console.error('[PlanEditor] Build failed:', error);
			this.notificationService.error(`Failed to build plan: ${error instanceof Error ? error.message : String(error)}`);
		}
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

		// Listen for external file changes and remount React
		this._externalChangeDisposable?.dispose();
		this._externalChangeDisposable = input.onDidChangeExternalContent(async () => {
			console.log('[PlanEditorPane] External content changed, remounting...');
			// Reload plan and remount React component
			const updatedPlan = await input.loadPlan();
			if (this._container && this._reactDisposable) {
				this._reactDisposable.dispose();
				await this._mountReactComponent(input, updatedPlan);
			}
		});

		// Mount React component
		await this._mountReactComponent(input, parsedPlan);

		// Update context keys
		this._contextKeys.editorActive.set(true);
		this._contextKeys.viewMode.set(this._currentViewMode);
	}

	// Helper to mount React component
	private async _mountReactComponent(input: PlanEditorInput, parsedPlan: ParsedPlan): Promise<void> {
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
							}
							// Removed success notification per user request
						},
						onContentChange: (content: string) => {
							input.updateContent(content);
						},
						onBuild: async (todos: TodoItem[]) => {
							await this.handleBuild(todos, input);
						}
					})?.dispose;
					return toDisposable(() => disposeFn?.());
				}
			);
		}
	}

	// Clear input on editor close
	override clearInput(): void {
		this._reactDisposable?.dispose();
		this._reactDisposable = undefined;
		this._externalChangeDisposable?.dispose();
		this._externalChangeDisposable = undefined;
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
		this._externalChangeDisposable?.dispose();
		super.dispose();
	}
}
