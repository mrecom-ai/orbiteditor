/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { getErrorMessage } from '../common/sendLLMMessageTypes.js';
import { SUBAGENT_TASK_STORAGE_KEY } from '../common/storageKeys.js';
import { SubAgentSessionSnapshot, SubAgentTaskRecord, SubAgentTaskStoreState, applyBackgroundDefaults, isEvictable, isTerminalTaskStatus, markNotified, transitionToTerminal } from '../common/subAgentTypes.js';

const MAX_STORED_TASKS = 120
const MAX_STORED_SESSIONS = 120
const MAX_SESSION_HISTORY_MESSAGES = 48
const MAX_FULL_TEXT_CHARS = 24_000

const defaultState = (): SubAgentTaskStoreState => ({
	version: 1,
	tasksById: {},
	taskIdsByThread: {},
	sessionsById: {},
})

const truncateText = (value: string | undefined, maxChars: number): string | undefined => {
	if (typeof value !== 'string') return value
	if (value.length <= maxChars) return value
	return `${value.slice(0, maxChars)}\n\n... (truncated)`
}

const sanitizeSession = (session: SubAgentSessionSnapshot): SubAgentSessionSnapshot => ({
	...session,
	history: session.history.slice(-MAX_SESSION_HISTORY_MESSAGES),
})

const sanitizeTask = (task: SubAgentTaskRecord): SubAgentTaskRecord => ({
	...applyBackgroundDefaults(task),
	fullText: truncateText(task.fullText, MAX_FULL_TEXT_CHARS),
	report: task.report ? {
		...task.report,
		rawResponse: truncateText(task.report.rawResponse, MAX_FULL_TEXT_CHARS) ?? task.report.rawResponse,
	} : task.report,
})

export interface ISubAgentTaskStoreService {
	readonly _serviceBrand: undefined;
	readonly state: SubAgentTaskStoreState;
	readonly onDidChangeState: Event<{ threadId?: string; taskId?: string; sessionId?: string }>;
	getTask(taskId: string): SubAgentTaskRecord | undefined;
	getTasksForThread(threadId: string): SubAgentTaskRecord[];
	getSession(sessionId: string): SubAgentSessionSnapshot | undefined;
	upsertTask(task: SubAgentTaskRecord): void;
	upsertSession(session: SubAgentSessionSnapshot): void;
	markTaskNotified(taskId: string): boolean;
	removeThread(threadId: string): void;
	/** Evict all terminal tasks that are notified and past their eviction deadline. */
	evictTerminalTasks(): string[];
	reset(): void;
}

export const ISubAgentTaskStoreService = createDecorator<ISubAgentTaskStoreService>('subAgentTaskStoreService');

class SubAgentTaskStoreService extends Disposable implements ISubAgentTaskStoreService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<{ threadId?: string; taskId?: string; sessionId?: string }>())
	readonly onDidChangeState = this._onDidChangeState.event

	private _state: SubAgentTaskStoreState
	get state(): SubAgentTaskStoreState {
		return this._state
	}

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super()
		this._state = this._loadState()
	}

	getTask(taskId: string): SubAgentTaskRecord | undefined {
		return this._state.tasksById[taskId]
	}

	getTasksForThread(threadId: string): SubAgentTaskRecord[] {
		const taskIds = this._state.taskIdsByThread[threadId] ?? []
		return taskIds
			.map(taskId => this._state.tasksById[taskId])
			.filter((task): task is SubAgentTaskRecord => !!task)
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	getSession(sessionId: string): SubAgentSessionSnapshot | undefined {
		return this._state.sessionsById[sessionId]
	}

	upsertTask(task: SubAgentTaskRecord): void {
		const sanitized = sanitizeTask(task)
		const nextState = deepClone(this._state)
		nextState.tasksById[sanitized.taskId] = sanitized
		const taskIds = nextState.taskIdsByThread[sanitized.threadId] ?? []
		if (!taskIds.includes(sanitized.taskId)) {
			taskIds.push(sanitized.taskId)
		}
		nextState.taskIdsByThread[sanitized.threadId] = taskIds
		this._state = this._gcState(nextState)
		this._persistState()
		this._onDidChangeState.fire({ threadId: sanitized.threadId, taskId: sanitized.taskId })
	}

	upsertSession(session: SubAgentSessionSnapshot): void {
		const sanitized = sanitizeSession(session)
		const nextState = deepClone(this._state)
		nextState.sessionsById[sanitized.sessionId] = sanitized
		this._state = this._gcState(nextState)
		this._persistState()
		this._onDidChangeState.fire({ threadId: sanitized.threadId, taskId: sanitized.taskId, sessionId: sanitized.sessionId })
	}

	markTaskNotified(taskId: string): boolean {
		const task = this._state.tasksById[taskId]
		if (!task) return false
		const { task: notifiedTask, wasAlreadyNotified } = markNotified(task)
		if (wasAlreadyNotified) return false

		const nextState = deepClone(this._state)
		nextState.tasksById[taskId] = sanitizeTask(notifiedTask)
		this._state = this._gcState(nextState)
		this._persistState()
		this._onDidChangeState.fire({ threadId: notifiedTask.threadId, taskId })
		return true
	}

	removeThread(threadId: string): void {
		const taskIds = this._state.taskIdsByThread[threadId] ?? []
		if (taskIds.length === 0) return

		const nextState = deepClone(this._state)
		delete nextState.taskIdsByThread[threadId]
		const sessionIdsToDelete = new Set<string>()

		for (const taskId of taskIds) {
			const task = nextState.tasksById[taskId]
			if (task?.sessionId) sessionIdsToDelete.add(task.sessionId)
			delete nextState.tasksById[taskId]
		}

		for (const sessionId of sessionIdsToDelete) {
			delete nextState.sessionsById[sessionId]
		}

		this._state = nextState
		this._persistState()
		this._onDidChangeState.fire({ threadId })
	}

	reset(): void {
		this._state = defaultState()
		this._persistState()
		this._onDidChangeState.fire({})
	}

	evictTerminalTasks(): string[] {
		const evictedIds: string[] = []
		const allTasks = Object.values(this._state.tasksById)

		for (const task of allTasks) {
			if (isEvictable(task)) {
				evictedIds.push(task.taskId)
			}
		}

		if (evictedIds.length === 0) return []

		const nextState = deepClone(this._state)
		const sessionIdsToCheck = new Set<string>()

		for (const taskId of evictedIds) {
			const task = nextState.tasksById[taskId]
			if (task?.sessionId) sessionIdsToCheck.add(task.sessionId)
			delete nextState.tasksById[taskId]
		}

		// Clean up thread index
		for (const [threadId, taskIds] of Object.entries(nextState.taskIdsByThread)) {
			nextState.taskIdsByThread[threadId] = taskIds.filter(id => !!nextState.tasksById[id])
			if (nextState.taskIdsByThread[threadId].length === 0) {
				delete nextState.taskIdsByThread[threadId]
			}
		}

		// Evict orphaned sessions (no remaining task references them)
		const referencedSessionIds = new Set<string>()
		for (const task of Object.values(nextState.tasksById)) {
			if (task.sessionId) referencedSessionIds.add(task.sessionId)
		}
		for (const sessionId of sessionIdsToCheck) {
			if (!referencedSessionIds.has(sessionId)) {
				delete nextState.sessionsById[sessionId]
			}
		}

		this._state = nextState
		this._persistState()
		this._onDidChangeState.fire({})

		return evictedIds
	}

	private _loadState(): SubAgentTaskStoreState {
		const raw = this._storageService.get(SUBAGENT_TASK_STORAGE_KEY, StorageScope.APPLICATION)
		if (!raw) return defaultState()
		try {
			const parsed = JSON.parse(raw) as Partial<SubAgentTaskStoreState>
			return this._gcState(this._reconcileLoadedState({
				version: 1,
				tasksById: deepClone(parsed.tasksById ?? {}),
				taskIdsByThread: deepClone(parsed.taskIdsByThread ?? {}),
				sessionsById: deepClone(parsed.sessionsById ?? {}),
			}))
		} catch (error) {
			console.error('[subAgentTaskStoreService] Failed to load state:', getErrorMessage(error))
			return defaultState()
		}
	}

	private _reconcileLoadedState(state: SubAgentTaskStoreState): SubAgentTaskStoreState {
		const nextState = deepClone(state)
		const staleLiveSessionIds = new Set<string>()

		for (const [taskId, task] of Object.entries(nextState.tasksById)) {
			let reconciled = applyBackgroundDefaults(task)
			if (!isTerminalTaskStatus(reconciled.status)) {
				reconciled = transitionToTerminal(reconciled, 'canceled', 'Interrupted by restart')
				reconciled.notified = true
				if (reconciled.sessionId) staleLiveSessionIds.add(reconciled.sessionId)
			}
			nextState.tasksById[taskId] = sanitizeTask(reconciled)
		}

		for (const sessionId of staleLiveSessionIds) {
			delete nextState.sessionsById[sessionId]
		}

		for (const [threadId, taskIds] of Object.entries(nextState.taskIdsByThread)) {
			const keptTaskIds = taskIds.filter(taskId => !!nextState.tasksById[taskId])
			if (keptTaskIds.length > 0) {
				nextState.taskIdsByThread[threadId] = keptTaskIds
			} else {
				delete nextState.taskIdsByThread[threadId]
			}
		}

		return nextState
	}

	private _persistState(): void {
		try {
			this._storageService.store(
				SUBAGENT_TASK_STORAGE_KEY,
				JSON.stringify(this._state),
				StorageScope.APPLICATION,
				StorageTarget.USER,
			)
		} catch (error) {
			console.error('[subAgentTaskStoreService] Failed to persist state:', getErrorMessage(error))
		}
	}

	private _gcState(state: SubAgentTaskStoreState): SubAgentTaskStoreState {
		const allTasks = Object.values(state.tasksById).sort((a, b) => b.updatedAt - a.updatedAt)
		if (allTasks.length > MAX_STORED_TASKS) {
			const keepTaskIds = new Set(allTasks.slice(0, MAX_STORED_TASKS).map(task => task.taskId))
			for (const task of allTasks) {
				if (keepTaskIds.has(task.taskId)) continue
				delete state.tasksById[task.taskId]
			}
			for (const [threadId, taskIds] of Object.entries(state.taskIdsByThread)) {
				state.taskIdsByThread[threadId] = taskIds.filter(taskId => !!state.tasksById[taskId])
				if (state.taskIdsByThread[threadId].length === 0) {
					delete state.taskIdsByThread[threadId]
				}
			}
		}

		const referencedSessionIds = new Set<string>()
		for (const task of Object.values(state.tasksById)) {
			if (task.sessionId) referencedSessionIds.add(task.sessionId)
		}

		const allSessions = Object.values(state.sessionsById).sort((a, b) => b.updatedAt - a.updatedAt)
		const keepSessionIds = new Set<string>()
		for (const session of allSessions) {
			if (referencedSessionIds.has(session.sessionId) || keepSessionIds.size < MAX_STORED_SESSIONS) {
				keepSessionIds.add(session.sessionId)
			}
		}
		for (const session of allSessions) {
			if (!keepSessionIds.has(session.sessionId)) {
				delete state.sessionsById[session.sessionId]
			}
		}

		return state
	}
}

registerSingleton(ISubAgentTaskStoreService, SubAgentTaskStoreService, InstantiationType.Eager);
