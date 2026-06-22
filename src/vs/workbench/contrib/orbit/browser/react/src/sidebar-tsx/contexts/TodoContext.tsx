/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { TodoItem } from '../../../../../../common/chatThreadServiceTypes.js';
import { normalizeTodoList, todoListsEqual, pickHydratedTodoList, pickLiveTodoList } from '../components/toolResults/todo/todoState.js';

export type TodoState = {
	todos: TodoItem[];
	isFirstCall: boolean;
	creationToolCallId: string | null;
};

export type TodoContextValue = {
	getTodoState: (threadId: string) => TodoState;
	/** Only for in-flight TodoWrite (streaming). Committed tools hydrate via persisted thread state. */
	updateTodoState: (threadId: string, todos: TodoItem[], toolCallId: string, isStreaming: boolean) => void;
	registerCreationElement: (threadId: string, element: HTMLDivElement) => void;
	getCreationElement: (threadId: string) => HTMLDivElement | null;
	updateCounter: number;
	liveTodos: TodoItem[];
	isAgentRunning: boolean;
};

const TodoContext = createContext<TodoContextValue | null>(null);

export const useTodoContext = (): TodoContextValue => {
	const context = useContext(TodoContext);
	if (!context) {
		throw new Error('useTodoContext must be used within TodoProvider');
	}
	return context;
};

export const TodoProvider: React.FC<{
	children: React.ReactNode;
	threadId: string;
	initialTodos?: TodoItem[];
	isAgentRunning?: boolean;
}> = ({ children, threadId, initialTodos, isAgentRunning = false }) => {
	const todoStateRef = useRef<Map<string, TodoState>>(new Map());
	const creationElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
	const [updateCounter, setUpdateCounter] = useState(0);

	// Memoize the serialized key to avoid re-serializing on every render
	const persistedTodosRef = useRef<string>('');
	const persistedTodosKey = useMemo(() => {
		const next = JSON.stringify(initialTodos ?? []);
		if (next === persistedTodosRef.current) {
			return persistedTodosRef.current;
		}
		persistedTodosRef.current = next;
		return next;
	}, [initialTodos]);

	const getTodoState = useCallback((tid: string): TodoState => {
		const state = todoStateRef.current.get(tid);
		if (!state) {
			return { todos: [], isFirstCall: true, creationToolCallId: null };
		}
		return state;
	}, [updateCounter]);

	const updateTodoState = useCallback((tid: string, todos: TodoItem[], toolCallId: string, isStreaming: boolean) => {
		// Never apply committed/historical tool renders — only live streaming updates
		if (!isStreaming) {
			return;
		}

		const currentState = todoStateRef.current.get(tid);
		const normalized = normalizeTodoList(todos);

		if (currentState && todoListsEqual(currentState.todos, normalized)) {
			return;
		}

		const isFirstCall = !currentState || currentState.isFirstCall;

		todoStateRef.current.set(tid, {
			todos: normalized,
			isFirstCall: isFirstCall && todos.length > 0 ? false : isFirstCall,
			creationToolCallId: isFirstCall ? toolCallId : (currentState?.creationToolCallId || toolCallId),
		});

		setUpdateCounter(prev => prev + 1);
	}, []);

	const registerCreationElement = useCallback((tid: string, element: HTMLDivElement) => {
		creationElementsRef.current.set(tid, element);
	}, []);

	const getCreationElement = useCallback((tid: string): HTMLDivElement | null => {
		return creationElementsRef.current.get(tid) || null;
	}, []);

	// Hydrate from persisted storage without clobbering a fresher in-flight streaming snapshot
	useEffect(() => {
		const persisted = initialTodos ?? [];
		const existing = todoStateRef.current.get(threadId);
		const nextTodos = pickHydratedTodoList(persisted, existing?.todos);
		if (existing && todoListsEqual(existing.todos, nextTodos)) {
			return;
		}
		todoStateRef.current.set(threadId, {
			todos: nextTodos,
			isFirstCall: !nextTodos.length,
			creationToolCallId: existing?.creationToolCallId ?? null,
		});
		setUpdateCounter(prev => prev + 1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadId, persistedTodosKey]);

	useEffect(() => {
		const currentState = todoStateRef.current.get(threadId);
		const currentElement = creationElementsRef.current.get(threadId);
		todoStateRef.current.clear();
		creationElementsRef.current.clear();
		if (currentState) {
			todoStateRef.current.set(threadId, currentState);
		}
		if (currentElement) {
			creationElementsRef.current.set(threadId, currentElement);
		}
	}, [threadId]);

	const liveTodos = useMemo(() => {
		const persisted = initialTodos ?? [];
		if (!isAgentRunning) {
			return persisted;
		}
		const contextTodos = todoStateRef.current.get(threadId)?.todos ?? [];
		return pickLiveTodoList(persisted, contextTodos, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [persistedTodosKey, isAgentRunning, updateCounter, threadId]);

	const value: TodoContextValue = useMemo(() => ({
		getTodoState,
		updateTodoState,
		registerCreationElement,
		getCreationElement,
		updateCounter,
		liveTodos,
		isAgentRunning,
	}), [getTodoState, updateTodoState, registerCreationElement, getCreationElement, updateCounter, liveTodos, isAgentRunning]);

	return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};
