/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IChatThreadService } from './chatThreadService.js';
import { updatePlanSection, todosToNumberedMarkdown, syncPlanStatus } from '../common/planTemplate.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export const IPlanTodoSyncService = createDecorator<IPlanTodoSyncService>('planTodoSyncService');

export interface IPlanTodoSyncService {
	readonly _serviceBrand: undefined;

	/**
	 * Syncs thread todos to plan file (one-way: thread -> plan)
	 */
	syncThreadToPlan(threadId: string): Promise<void>;

	/**
	 * Starts watching thread todos for changes and syncs to plan file
	 */
	watchThreadTodos(threadId: string, planPath: string): void;

	/**
	 * Stops watching thread todos
	 */
	unwatchThreadTodos(threadId: string): void;

	/**
	 * Checks if a thread is currently being watched
	 */
	isWatching(threadId: string): boolean;
}

export class PlanTodoSyncService extends Disposable implements IPlanTodoSyncService {
	readonly _serviceBrand: undefined;

	private watchers = new Map<string, IDisposable>();
	private debounceTimers = new Map<string, NodeJS.Timeout>();
	private lastSyncedTodos = new Map<string, string>(); // threadId -> JSON string of todos
	private currentWatchedThreadId: string | null = null; // Track currently watched thread for cleanup

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService
	) {
		super();
	}

	/**
	 * Syncs thread todos to plan file
	 */
	async syncThreadToPlan(threadId: string): Promise<void> {
		try {
			// Get thread from state
			const thread = this.chatThreadService.state.allThreads[threadId];
			if (!thread) {
				console.warn(`[PlanTodoSync] Thread ${threadId} not found`);
				return;
			}

			// Check if plan is linked
			if (!thread.linkedPlanPath) {
				console.warn(`[PlanTodoSync] Thread ${threadId} has no linked plan`);
				return;
			}

			// Check if todos exist
			if (!thread.todoList || thread.todoList.length === 0) {
				console.log(`[PlanTodoSync] Thread ${threadId} has no todos to sync`);
				return;
			}

			// Check if todos changed since last sync (avoid unnecessary writes)
			const currentTodosJson = JSON.stringify(thread.todoList);
			const lastSynced = this.lastSyncedTodos.get(threadId);
			if (lastSynced === currentTodosJson) {
				console.log(`[PlanTodoSync] Todos unchanged for thread ${threadId}, skipping sync`);
				return;
			}

			// Read plan file
			const planUri = URI.file(thread.linkedPlanPath);
			const fileContent = await this.fileService.readFile(planUri);
			const planContent = fileContent.value.toString();

			// Convert todos to numbered markdown
			const todosMarkdown = todosToNumberedMarkdown(thread.todoList);

			// Update checklist section
			let updatedContent = updatePlanSection(planContent, 'checklist', todosMarkdown);

			// Update status in same operation (combine both updates before writing)
			updatedContent = syncPlanStatus(updatedContent);

			// Single write with both checklist and status updates
			await this.fileService.writeFile(planUri, VSBuffer.fromString(updatedContent));

			// Update last synced state
			this.lastSyncedTodos.set(threadId, currentTodosJson);

			console.log(`[PlanTodoSync] Synced ${thread.todoList.length} todos to plan: ${thread.linkedPlanPath}`);
		} catch (error) {
			console.error(`[PlanTodoSync] Failed to sync thread ${threadId} to plan:`, error);
			// Silent error - no notification per user request
		}
	}

	/**
	 * Starts watching thread todos for changes
	 */
	watchThreadTodos(threadId: string, planPath: string): void {
		// Stop watching previous thread if switching to a new one
		if (this.currentWatchedThreadId && this.currentWatchedThreadId !== threadId) {
			console.log(`[PlanTodoSync] Switching from thread ${this.currentWatchedThreadId} to ${threadId}, cleaning up old watcher`);
			this.unwatchThreadTodos(this.currentWatchedThreadId);
		}

		// Don't watch if already watching this thread
		if (this.watchers.has(threadId)) {
			console.log(`[PlanTodoSync] Already watching thread ${threadId}`);
			return;
		}

		console.log(`[PlanTodoSync] Starting watch for thread ${threadId} -> plan ${planPath}`);
		this.currentWatchedThreadId = threadId;

		// Store current todoList state to detect actual changes
		const thread = this.chatThreadService.state.allThreads[threadId];
		let lastTodoListJson = JSON.stringify(thread?.todoList || []);

		// Listen to thread changes
		const disposable = this.chatThreadService.onDidChangeCurrentThread(() => {
			// Check if thread still exists
			const currentThread = this.chatThreadService.state.allThreads[threadId];
			if (!currentThread) {
				// Thread was deleted, stop watching
				console.log(`[PlanTodoSync] Thread ${threadId} no longer exists, stopping watch`);
				this.unwatchThreadTodos(threadId);
				return;
			}

			// Only sync if todoList actually changed (compare JSON)
			const currentTodoListJson = JSON.stringify(currentThread.todoList || []);
			if (currentTodoListJson !== lastTodoListJson) {
				lastTodoListJson = currentTodoListJson;
				console.log(`[PlanTodoSync] TodoList changed for thread ${threadId}, triggering sync`);

				// Debounce sync to avoid excessive file writes
				const existingTimer = this.debounceTimers.get(threadId);
				if (existingTimer) {
					clearTimeout(existingTimer);
				}

				const timer = setTimeout(() => {
					this.syncThreadToPlan(threadId);
					this.debounceTimers.delete(threadId);
				}, 500); // 500ms debounce

				this.debounceTimers.set(threadId, timer);
			}
		});

		this.watchers.set(threadId, disposable);
	}

	/**
	 * Stops watching thread todos
	 */
	unwatchThreadTodos(threadId: string): void {
		const watcher = this.watchers.get(threadId);
		if (watcher) {
			watcher.dispose();
			this.watchers.delete(threadId);
			console.log(`[PlanTodoSync] Stopped watching thread ${threadId}`);
		}

		// Clear debounce timer
		const timer = this.debounceTimers.get(threadId);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(threadId);
		}

		// Clear last synced state
		this.lastSyncedTodos.delete(threadId);

		// Clear current watched thread if this was it
		if (this.currentWatchedThreadId === threadId) {
			this.currentWatchedThreadId = null;
		}
	}

	/**
	 * Checks if a thread is currently being watched
	 */
	isWatching(threadId: string): boolean {
		return this.watchers.has(threadId);
	}

	override dispose(): void {
		// Stop all watchers
		for (const [threadId] of this.watchers) {
			this.unwatchThreadTodos(threadId);
		}
		super.dispose();
	}
}

// Register the service
registerSingleton(IPlanTodoSyncService, PlanTodoSyncService, InstantiationType.Delayed);
