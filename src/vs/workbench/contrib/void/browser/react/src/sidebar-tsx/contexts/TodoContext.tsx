/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { TodoItem } from '../../../../../../common/chatThreadServiceTypes.js';

export type TodoState = {
	todos: TodoItem[];
	isFirstCall: boolean;
	creationToolCallId: string | null;
};

export type TodoContextValue = {
	getTodoState: (threadId: string) => TodoState;
	updateTodoState: (threadId: string, todos: TodoItem[], toolCallId: string, isStreaming: boolean) => void;
	registerCreationElement: (threadId: string, element: HTMLDivElement) => void;
	getCreationElement: (threadId: string) => HTMLDivElement | null;
	updateCounter: number; // Add counter to track updates
};

const TodoContext = createContext<TodoContextValue | null>(null);

export const useTodoContext = (): TodoContextValue => {
	const context = useContext(TodoContext);
	if (!context) {
		throw new Error('useTodoContext must be used within TodoProvider');
	}
	return context;
};

export const TodoProvider: React.FC<{ children: React.ReactNode; threadId: string }> = ({ children, threadId }) => {
	// Store todo state per thread
	const todoStateRef = useRef<Map<string, TodoState>>(new Map());
	// Store creation element refs per thread for sticky positioning
	const creationElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
	// Counter to track updates and force re-renders
	const [updateCounter, setUpdateCounter] = useState(0);

	const getTodoState = useCallback((tid: string): TodoState => {
		const state = todoStateRef.current.get(tid);
		if (!state) {
			return { todos: [], isFirstCall: true, creationToolCallId: null };
		}
		return state;
	}, [updateCounter]); // Add updateCounter as dependency

	const updateTodoState = useCallback((tid: string, todos: TodoItem[], toolCallId: string, isStreaming: boolean) => {
		const currentState = todoStateRef.current.get(tid);

		// Prevent flicker during streaming by not committing if todos array is shrinking (partial parse)
		if (isStreaming && currentState && todos.length < currentState.todos.length) {
			return;
		}

		const isFirstCall = !currentState || currentState.isFirstCall;

		// Determine final todos list
		let finalTodos = todos;

		// If this is an update (not first call) and we have existing todos
		// merge by ID to preserve the full list even if updates only send changed items
		if (!isFirstCall && currentState && currentState.todos.length > 0) {
			// If new todos list has FEWER items than current, it's likely a partial update
			// In this case, merge by ID instead of replacing
			if (todos.length < currentState.todos.length) {
				const existingMap = new Map(currentState.todos.map(t => [t.id, t]));
				// Update existing todos with new data
				todos.forEach(todo => {
					existingMap.set(todo.id, todo);
				});
				finalTodos = Array.from(existingMap.values());
			}
			// Otherwise, if new list has same or more items, trust it as the complete state
			else {
				finalTodos = todos;
			}
		}

		todoStateRef.current.set(tid, {
			todos: finalTodos,
			isFirstCall: isFirstCall && todos.length > 0 ? false : isFirstCall,
			creationToolCallId: isFirstCall ? toolCallId : (currentState?.creationToolCallId || toolCallId),
		});

		// Increment counter to trigger re-renders
		setUpdateCounter(prev => prev + 1);
	}, []);

	const registerCreationElement = useCallback((tid: string, element: HTMLDivElement) => {
		creationElementsRef.current.set(tid, element);
	}, []);

	const getCreationElement = useCallback((tid: string): HTMLDivElement | null => {
		return creationElementsRef.current.get(tid) || null;
	}, []);

	// Clean up when thread changes
	useEffect(() => {
		// Keep only current thread state to avoid memory leaks
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

	// Use useMemo to ensure value changes when updateCounter changes
	const value: TodoContextValue = useMemo(() => ({
		getTodoState,
		updateTodoState,
		registerCreationElement,
		getCreationElement,
		updateCounter,
	}), [getTodoState, updateTodoState, registerCreationElement, getCreationElement, updateCounter]);

	return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};
