/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import {
	parseNumberedTodoMarkdown,
	parseTodosFromMarkdown,
	togglePlanChecklistTodoStatus,
	addPlanChecklistTodo,
} from '../../../../common/planTemplate.js';
import { useAccessor } from '../util/services.js';
import '../styles.css';

type ChecklistTodo = {
	id: string;
	content: string;
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
};

const parseChecklistTodos = (rawContent: string): ChecklistTodo[] => {
	const body = rawContent.replace(/^---\n[\s\S]*?\n---\n*/, '');
	const checklistMatch = body.match(/## Implementation Checklist\n([\s\S]*?)(?=\n## |\n*$)/i);
	const checklistContent = checklistMatch?.[1]?.trim() ?? '';
	let todos = parseNumberedTodoMarkdown(checklistContent);
	if (todos.length === 0) {
		todos = parseTodosFromMarkdown(checklistContent || body);
	}
	return todos;
};

export const PlanChecklistPanel: React.FC<{
	rawContent: string;
	threadId?: string;
	onContentChange: (content: string) => void;
}> = ({ rawContent, threadId, onContentChange }) => {
	const accessor = useAccessor();
	const chatThreadService = accessor.get('IChatThreadService');
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const todos = useMemo(() => parseChecklistTodos(rawContent), [rawContent]);

	const toggleSelected = useCallback((id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const handleToggleStatus = useCallback((id: string) => {
		const updated = togglePlanChecklistTodoStatus(rawContent, id);
		onContentChange(updated);
	}, [rawContent, onContentChange]);

	const handleAddTodo = useCallback(() => {
		const text = window.prompt('New to-do');
		if (!text?.trim()) {
			return;
		}
		const updated = addPlanChecklistTodo(rawContent, text.trim());
		onContentChange(updated);
	}, [rawContent, onContentChange]);

	const referencedLabel = useMemo(() => {
		if (!threadId) {
			return null;
		}
		const thread = chatThreadService.state.allThreads[threadId];
		if (!thread) {
			return null;
		}
		return `Referenced by 1 Agent`;
	}, [threadId, chatThreadService.state.allThreads]);

	return (
		<div className="border-t border-void-border-3/30 bg-void-bg-2/40 px-8 py-6">
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-medium text-void-fg-1">
						{todos.length} To-do{todos.length !== 1 ? 's' : ''}
					</h3>
					<button
						type="button"
						onClick={handleAddTodo}
						className="flex items-center gap-1 text-xs text-void-fg-3 hover:text-void-fg-1 transition-colors"
					>
						<Plus size={12} />
						<span>New</span>
					</button>
				</div>

				<div className="plan-checklist border border-void-border-2 rounded-md p-3 bg-void-bg-1">
					{todos.length === 0 ? (
						<p className="text-xs text-void-fg-3">No to-dos yet. Click + New to add one.</p>
					) : (
						todos.map(todo => (
							<div
								key={todo.id}
								className={`plan-checklist-item py-1.5 ${todo.status === 'completed' ? 'completed' : 'pending'}`}
							>
								<button
									type="button"
									onClick={() => handleToggleStatus(todo.id)}
									className="mt-0.5 w-4 h-4 rounded-full border border-void-border-2 flex items-center justify-center shrink-0 hover:border-void-fg-3"
									aria-label={todo.status === 'completed' ? 'Mark pending' : 'Mark complete'}
								>
									{todo.status === 'completed' && <span className="text-[10px]">✓</span>}
								</button>
								<span className="flex-1 text-sm leading-snug">{todo.content}</span>
								<button
									type="button"
									onClick={() => toggleSelected(todo.id)}
									className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
										selectedIds.has(todo.id)
											? 'bg-void-accent text-white'
											: 'border border-void-border-2 text-transparent hover:border-void-fg-3'
									}`}
									aria-label="Select to-do"
								>
									<Check size={12} />
								</button>
							</div>
						))
					)}
				</div>

				{referencedLabel && (
					<div className="mt-4 pt-3 border-t border-void-border-2/60">
						<p className="text-[11px] text-void-fg-3">{referencedLabel}</p>
					</div>
				)}
			</div>
		</div>
	);
};