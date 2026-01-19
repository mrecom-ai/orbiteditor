/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';
import { TodoItem, TodoStatus } from '../../../../../../common/chatThreadServiceTypes.js';
import { Check, Circle, ChevronDown, ChevronUp, ListTodo } from 'lucide-react';
import { useTodoContext } from '../../contexts/TodoContext.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { ToolHeaderWrapper } from '../toolHeaders/ToolHeaderWrapper.js';

export type TodoToolProps = {
	todos: TodoItem[];
	isCreation: boolean;
	isStreaming?: boolean;
	onMount?: (element: HTMLDivElement) => void;
};

// Pie-style progress circle - fills sectors like pizza slices
const ProgressCircle = ({
	completed,
	total,
	size = 16,
}: {
	completed: number;
	total: number;
	size?: number;
}) => {
	const cx = size / 2;
	const cy = size / 2;
	const outerRadius = (size - 1) / 2;
	const innerRadius = outerRadius - 1.5;

	// Create pie segments
	const segments = [];
	for (let i = 0; i < total; i++) {
		const startAngle = (i / total) * 360 - 90;
		const endAngle = ((i + 1) / total) * 360 - 90;
		const gap = total > 1 ? 4 : 0;
		const adjustedStartAngle = startAngle + gap / 2;
		const adjustedEndAngle = endAngle - gap / 2;

		const startRad = (adjustedStartAngle * Math.PI) / 180;
		const endRad = (adjustedEndAngle * Math.PI) / 180;

		const x1 = cx + innerRadius * Math.cos(startRad);
		const y1 = cy + innerRadius * Math.sin(startRad);
		const x2 = cx + innerRadius * Math.cos(endRad);
		const y2 = cy + innerRadius * Math.sin(endRad);

		const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
		const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

		segments.push(
			<path
				key={i}
				d={pathData}
				fill={i < completed ? 'currentColor' : 'transparent'}
				opacity={i < completed ? 1 : 0.2}
			/>
		);
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			style={{ color: 'var(--vscode-textLink-foreground)' }}
		>
			<circle
				cx={cx}
				cy={cy}
				r={outerRadius}
				fill="none"
				stroke="currentColor"
				strokeWidth={0.5}
				opacity={0.5}
			/>
			{segments}
		</svg>
	);
};

// Status icon for individual todo items
const TodoStatusIcon = ({ status }: { status: TodoStatus }) => {
	switch (status) {
		case 'completed':
			return (
				<div
					className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
					style={{
						backgroundColor: 'var(--vscode-charts-green)',
					}}
				>
					<Check className="w-2 h-2" style={{ color: 'var(--vscode-editor-background)' }} />
				</div>
			);
		case 'in_progress':
			return (
				<div
					className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
					style={{
						backgroundColor: 'var(--vscode-textLink-foreground)',
					}}
				>
					<div className="w-2 h-2" style={{ color: 'var(--vscode-editor-background)' }}>
						<svg viewBox="0 0 16 16" fill="currentColor">
							<path d="M6 3l6 5-6 5V3z" />
						</svg>
					</div>
				</div>
			);
		default:
			return (
				<div
					className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
					style={{
						border: '0.5px solid var(--vscode-descriptionForeground)',
						opacity: 0.4,
					}}
				/>
			);
	}
};

// Helper to generate update description based on changes
const getUpdateDescription = (todos: TodoItem[], previousTodos: TodoItem[]): string => {
	const prevMap = new Map(previousTodos.map(t => [t.id, t]));
	const changedItems: { type: 'started' | 'finished' | 'created'; item: TodoItem }[] = [];

	todos.forEach(todo => {
		const prev = prevMap.get(todo.id);
		if (!prev) {
			changedItems.push({ type: 'created', item: todo });
		} else if (prev.status !== todo.status) {
			if (todo.status === 'completed') {
				changedItems.push({ type: 'finished', item: todo });
			} else if (todo.status === 'in_progress') {
				changedItems.push({ type: 'started', item: todo });
			}
		}
	});

	// Single change - show specific task
	if (changedItems.length === 1) {
		const { type, item } = changedItems[0];
		const verb = type === 'finished' ? 'Finished' : type === 'started' ? 'Started' : 'Created';
		return `${verb}: ${item.content}`;
	}

	// Multiple changes - show summary
	if (changedItems.length > 1) {
		const started = changedItems.filter(c => c.type === 'started').length;
		const finished = changedItems.filter(c => c.type === 'finished').length;
		const created = changedItems.filter(c => c.type === 'created').length;

		const parts: string[] = [];
		if (finished > 0) parts.push(`Finished ${finished}`);
		if (started > 0) parts.push(`Started ${started}`);
		if (created > 0) parts.push(`Created ${created}`);

		return parts.length > 0 ? parts.join(', ') + ' tasks' : 'Updated todos';
	}

	// No changes
	return `Updated TODO list (${todos.length} items)`;
};

// Individual todo item in expanded list
const TodoItemRow = ({ todo, isLast }: { todo: TodoItem; isLast: boolean }) => {
	const displayText = todo.status === 'in_progress' && todo.activeForm
		? todo.activeForm
		: todo.content;

	return (
		<div
			className={`flex items-center gap-2 px-2.5 py-1.5 ${!isLast ? 'border-b' : ''}`}
			style={{
				borderColor: !isLast ? 'var(--vscode-panel-border)' : undefined,
			}}
		>
			<TodoStatusIcon status={todo.status} />
			<span
				className={`text-xs truncate ${todo.status === 'completed' ? 'line-through' : ''}`}
				style={{
					color: todo.status === 'completed'
						? 'var(--vscode-descriptionForeground)'
						: 'var(--vscode-foreground)',
					fontWeight: todo.status === 'in_progress' ? 500 : 400,
				}}
			>
				{displayText}
			</span>
		</div>
	);
};

// Full todo list UI (for creation) - Cleaner two-block design
const TodoListFull = ({ todos, isExpanded, onToggle, isSticky }: {
	todos: TodoItem[];
	isExpanded: boolean;
	onToggle: () => void;
	isSticky?: boolean;
}) => {
	const completedCount = todos.filter(t => t.status === 'completed').length;
	const totalTodos = todos.length;

	// Find current task (in_progress first, then first pending)
	const currentTask = todos.find(t => t.status === 'in_progress') || todos.find(t => t.status === 'pending');
	const currentTaskIndex = currentTask ? todos.findIndex(t => t === currentTask) + 1 : completedCount;

	const stickyRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={stickyRef}
			data-todo-tool
			className={isSticky ? 'sticky' : ''}
			style={isSticky ? {
				top: '8px',
				paddingTop: '4px',
				paddingBottom: '4px',
				backgroundColor: 'var(--vscode-editor-background)',
				zIndex: 15,
				boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.15)',
			} : undefined}
		>
			{/* TOP BLOCK - Title */}
			<div
				className="rounded-t-lg border border-b-0 px-2.5 py-1.5 cursor-pointer transition-colors duration-150"
				onClick={onToggle}
				role="button"
				aria-expanded={isExpanded}
				tabIndex={0}
				style={{
					borderColor: 'var(--vscode-panel-border)',
					backgroundColor: 'var(--vscode-sideBar-background)',
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = 'var(--vscode-sideBar-background)';
				}}
			>
				<div className="flex items-center gap-1.5">
					<ListTodo className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--vscode-descriptionForeground)' }} />
					<span className="text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
						To-dos
					</span>
					<div className="flex items-center gap-2 flex-1 min-w-0">
						{completedCount === totalTodos && totalTodos > 0 ? (
							<div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{
								backgroundColor: 'var(--vscode-charts-green)',
							}}>
								<Check className="w-2.5 h-2.5" style={{ color: 'var(--vscode-editor-background)' }} />
							</div>
						) : (
							<ProgressCircle completed={completedCount} total={totalTodos} size={16} />
						)}
						<span className="text-xs flex-shrink-0" style={{
							color: 'var(--vscode-descriptionForeground)',
							fontVariantNumeric: 'tabular-nums',
						}}>
							{currentTaskIndex}/{totalTodos}
						</span>
					</div>
					<div className="relative w-4 h-4 flex-shrink-0">
						<ChevronDown
							className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${isExpanded ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}
							style={{ color: 'var(--vscode-descriptionForeground)' }}
						/>
						<ChevronUp
							className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
							style={{ color: 'var(--vscode-descriptionForeground)' }}
						/>
					</div>
				</div>
			</div>

			{/* BOTTOM BLOCK - Progress/List */}
			<div
				className="rounded-b-lg border"
				style={{
					borderColor: 'var(--vscode-panel-border)',
					backgroundColor: 'var(--vscode-sideBar-background)',
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
				}}
			>
				{!isExpanded && (
					<div
						className="cursor-pointer"
						onClick={onToggle}
					>
						{currentTask && (
							<TodoItemRow
								todo={currentTask}
								isLast={true}
							/>
						)}
						{!currentTask && todos.length > 0 && (
							<TodoItemRow
								todo={todos[todos.length - 1]}
								isLast={true}
							/>
						)}
					</div>
				)}

				{isExpanded && (
					<div
						className="max-h-[300px] overflow-y-auto cursor-pointer"
						onClick={onToggle}
					>
						{todos.map((todo, idx) => (
							<TodoItemRow
								key={todo.id}
								todo={todo}
								isLast={idx === todos.length - 1}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

// Main TodoTool component
export const TodoTool = ({ todos, isCreation, isStreaming = false, onMount }: TodoToolProps) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (containerRef.current && onMount) {
			onMount(containerRef.current);
		}
	}, [onMount]);

	if (isCreation) {
		return (
			<div ref={containerRef} className="my-2">
				<TodoListFull
					todos={todos}
					isExpanded={isExpanded}
					onToggle={() => setIsExpanded(!isExpanded)}
					isSticky={true}
				/>
			</div>
		);
	}

	// Should not reach here - updates are handled in TodoToolWithState
	return null;
};

// Wrapper that manages state and detects creation vs update
export const TodoToolWithState = ({
	todos,
	threadId,
	toolCallId,
	isStreaming = false
}: {
	todos: TodoItem[];
	threadId: string;
	toolCallId: string;
	isStreaming?: boolean;
}) => {
	const todoContext = useTodoContext();
	const todoState = todoContext.getTodoState(threadId);

	useEffect(() => {
		todoContext.updateTodoState(threadId, todos, toolCallId, isStreaming);
	}, [todos, threadId, toolCallId, isStreaming, todoContext]);

	const isCreation = todoState.creationToolCallId === toolCallId;
	const previousTodos = isCreation ? [] : todoState.todos;

	const handleMount = isCreation
		? (element: HTMLDivElement) => todoContext.registerCreationElement(threadId, element)
		: undefined;

	if (isCreation) {
		// Use the latest todos from context state, not the initial todos
		// This ensures the creation card updates when subsequent tool calls update the state
		const latestTodos = todoState.todos.length > 0 ? todoState.todos : todos;

		return (
			<TodoTool
				todos={latestTodos}
				isCreation={true}
				isStreaming={isStreaming}
				onMount={handleMount}
			/>
		);
	}

	// For updates - use ToolHeaderWrapper to match other tools
	const description = getUpdateDescription(todos, previousTodos);

	return (
		<ToolHeaderWrapper
			title={isStreaming ? <TextShimmer duration={2.5} spread={2}>Update TODO list</TextShimmer> : "Update TODO list"}
			desc1={description}
			isRunning={isStreaming}
		/>
	);
};
