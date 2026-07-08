/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { URI } from '../../../../../../../base/common/uri.js';
import { ParsedPlan, parsePlanFile, parseNumberedTodoMarkdown, convertPlanTodoToExecutionTodo } from '../../../../common/planTemplate.js';
import { useIsDark } from '../util/services.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { TodoItem } from '../../../../common/chatThreadServiceTypes.js';
import '../styles.css';

export interface PlanEditorProps {
	plan: ParsedPlan;
	resource: URI;
	onSave?: (content: string) => Promise<void>;
	onContentChange?: (content: string) => void;
	initialViewMode?: 'preview' | 'markdown';
	onBuild?: (todos: TodoItem[]) => Promise<void>;
}

export const PlanEditor: React.FC<PlanEditorProps> = ({
	plan: initialPlan,
	resource,
	onSave,
	onContentChange,
	initialViewMode = 'preview',
	onBuild
}) => {
	const isDark = useIsDark();
	const [viewMode, setViewMode] = useState<'preview' | 'markdown'>(initialViewMode);
	const [rawContent, setRawContent] = useState(initialPlan.rawContent);
	const [isDirty, setIsDirty] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isBuilding, setIsBuilding] = useState(false);

	// Use ref to track the latest resource URI
	const resourceRef = useRef(resource);
	resourceRef.current = resource;

	// Initial loading complete
	useEffect(() => {
		setIsLoading(false);
	}, []);

	// Sync view mode when initialViewMode changes
	useEffect(() => {
		setViewMode(initialViewMode);
	}, [initialViewMode]);

	// Sync content when initialPlan changes (e.g., file reload, external edit)
	useEffect(() => {
		// Only sync if not dirty (avoid overwriting unsaved changes)
		if (initialPlan.rawContent !== rawContent && !isDirty) {
			setRawContent(initialPlan.rawContent);
		}
	}, [initialPlan.rawContent, isDirty]);

	// Sync when resource changes (switching to different plan file)
	useEffect(() => {
		if (resource.toString() !== resourceRef.current.toString()) {
			setRawContent(initialPlan.rawContent);
			setIsDirty(false);
			resourceRef.current = resource;
		}
	}, [resource, initialPlan.rawContent]);

	const handleContentChange = useCallback((newContent: string) => {
		setRawContent(newContent);
		setIsDirty(true);
		onContentChange?.(newContent);
	}, [onContentChange]);

	// Fixed auto-save with proper dependencies
	useEffect(() => {
		if (!isDirty || !onSave) return;

		const timer = setTimeout(() => {
			if (isSaving) return;

			setIsSaving(true);
			onSave(rawContent)
				.then(() => {
					setIsDirty(false);
				})
				.catch((error) => {
					console.error('Save error:', error);
				})
				.finally(() => {
					setIsSaving(false);
				});
		}, 2000);

		return () => clearTimeout(timer);
	}, [rawContent, isDirty, onSave, isSaving]);

	// Handle Build button click
	const handleBuildClick = useCallback(async () => {
		if (!onBuild) return;

		setIsBuilding(true);
		try {
			// Parse current plan content
			const parsed = parsePlanFile(rawContent);

			// Extract todos from checklist section
			const checklistContent = parsed.sections.checklist;
			const parsedTodos = parseNumberedTodoMarkdown(checklistContent);

				// Convert to execution todos with proper status and activeForm
				const executionTodos: TodoItem[] = parsedTodos.map(todo =>
					convertPlanTodoToExecutionTodo(todo)
				);

			// Call onBuild callback with todos
			await onBuild(executionTodos);

		} catch (error) {
			console.error('Build failed:', error);
			// Show error (could use notification service if available)
		} finally {
			setIsBuilding(false);
		}
	}, [rawContent, onBuild]);

	// Get content without frontmatter
	const displayContent = rawContent.replace(/^---\n[\s\S]*?\n---\n*/, '');

	// Show loading state
	if (isLoading) {
		return (
			<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
				<div className="flex items-center justify-center h-full bg-void-bg-3 text-void-fg-2">
					<div className="flex flex-col items-center gap-3">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-void-fg-2"></div>
						<span className="text-sm">Loading plan...</span>
					</div>
				</div>
			</div>
		);
	}

	// Markdown editing mode
	if (viewMode === 'markdown') {
		return (
			<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
				<div className="flex flex-col h-full bg-void-bg-3 text-void-fg-1">
					{/* Build button toolbar */}
					{onBuild && (
						<div className="flex items-center justify-end px-4 py-2 border-b border-void-border-3/30">
							<button
								onClick={handleBuildClick}
								disabled={isBuilding || isDirty}
								className="
									flex items-center gap-2 px-3 py-1.5
									bg-void-accent hover:bg-void-accent/90
									text-white font-medium text-sm rounded
									disabled:opacity-50 disabled:cursor-not-allowed
									transition-all duration-150
								"
								title={isDirty ? "Save plan before building" : "Send plan to agent and start execution"}
							>
								{isBuilding ? (
									<>
										<div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
										<span>Building...</span>
									</>
								) : (
									<>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<polygon points="5 3 19 12 5 21 5 3"></polygon>
										</svg>
										<span>Build</span>
									</>
								)}
							</button>
						</div>
					)}
					<div className="flex-1 overflow-auto">
						<textarea
							value={rawContent}
							onChange={(e) => handleContentChange(e.target.value)}
							className="w-full h-full p-8 font-mono text-sm bg-transparent focus:outline-none resize-none"
							spellCheck={false}
							style={{ userSelect: 'text', minHeight: '100%' }}
							aria-label="Plan markdown editor"
							aria-describedby="plan-editor-description"
						/>
						<div id="plan-editor-description" className="sr-only">
							Edit your plan file in markdown format. Changes are automatically saved after 2 seconds.
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Preview mode with full markdown support
	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<div className="flex flex-col h-full bg-void-bg-3 text-void-fg-1">
				{/* Build button toolbar */}
				{onBuild && (
					<div className="flex items-center justify-end px-4 py-2 border-b border-void-border-3/30">
						<button
							onClick={handleBuildClick}
							disabled={isBuilding || isDirty}
							className="
								flex items-center gap-2 px-3 py-1.5
								bg-void-accent hover:bg-void-accent/90
								text-white font-medium text-sm rounded
								disabled:opacity-50 disabled:cursor-not-allowed
								transition-all duration-150
							"
							title={isDirty ? "Save plan before building" : "Send plan to agent and start execution"}
						>
							{isBuilding ? (
								<>
									<div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
									<span>Building...</span>
								</>
							) : (
								<>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<polygon points="5 3 19 12 5 21 5 3"></polygon>
									</svg>
									<span>Build</span>
								</>
							)}
						</button>
					</div>
				)}
				<div className="flex-1 overflow-auto">
					<article
						className="
							max-w-4xl mx-auto px-12 py-12
							prose prose-sm max-w-none

							prose-p:block
							prose-p:leading-[1.7]
							prose-p:my-3
							prose-p:text-void-fg-1

							prose-h1:text-[24px]
							prose-h1:font-bold
							prose-h1:my-6
							prose-h1:leading-tight
							prose-h1:text-void-fg-0
							prose-h1:border-b
							prose-h1:border-void-border-3/20
							prose-h1:pb-3

							prose-h2:text-[20px]
							prose-h2:font-semibold
							prose-h2:my-5
							prose-h2:leading-tight
							prose-h2:text-void-fg-1

							prose-h3:text-[16px]
							prose-h3:font-semibold
							prose-h3:my-4
							prose-h3:leading-tight
							prose-h3:text-void-fg-1

							prose-h4:text-[14px]
							prose-h4:font-medium
							prose-h4:my-3
							prose-h4:leading-tight
							prose-h4:text-void-fg-2

							prose-h5:text-[13px]
							prose-h5:font-medium
							prose-h5:my-2.5
							prose-h5:leading-tight
							prose-h5:text-void-fg-2

							prose-h6:text-[12px]
							prose-h6:font-medium
							prose-h6:my-2
							prose-h6:leading-tight
							prose-h6:text-void-fg-3

							prose-hr:my-6
							prose-hr:border-void-border-3/30

							prose-pre:my-4
							prose-pre:bg-void-bg-2
							prose-pre:border
							prose-pre:border-void-border-4
							prose-pre:rounded-md
							prose-pre:text-[13px]
							prose-pre:overflow-x-auto
							prose-pre:p-4

							prose-ol:list-outside
							prose-ol:list-decimal
							prose-ol:leading-[1.7]
							prose-ol:my-3
							prose-ol:pl-6

							prose-ul:list-outside
							prose-ul:list-disc
							prose-ul:leading-[1.7]
							prose-ul:my-3
							prose-ul:pl-6

							prose-li:my-1.5
							prose-li:pl-1
							prose-li:text-void-fg-1

							prose-code:before:content-none
							prose-code:after:content-none
							prose-code:text-void-fg-1
							prose-code:bg-void-bg-2-alt/35
							prose-code:px-1.5
							prose-code:py-0.5
							prose-code:rounded
							prose-code:text-[13px]
							prose-code:font-mono
							prose-code:font-medium

							prose-blockquote:border-l-[3px]
							prose-blockquote:border-l-void-border-1/50
							prose-blockquote:pl-5
							prose-blockquote:my-4
							prose-blockquote:py-1
							prose-blockquote:italic
							prose-blockquote:text-void-fg-2
							prose-blockquote:bg-void-bg-1/20
							prose-blockquote:rounded-r

							prose-table:my-4
							prose-table:text-[13px]
							prose-table:border-collapse
							prose-table:w-full

							prose-thead:border-b-2
							prose-thead:border-void-border-1

							prose-th:px-4
							prose-th:py-3
							prose-th:text-left
							prose-th:font-semibold
							prose-th:text-void-fg-1
							prose-th:bg-void-bg-1/30

							prose-td:px-4
							prose-td:py-2.5
							prose-td:border-b
							prose-td:border-void-border-3/20
							prose-td:text-void-fg-1

							prose-tr:hover:bg-void-bg-2-alt/40
							prose-tr:transition-colors

							prose-strong:font-semibold
							prose-strong:text-void-fg-0

							prose-em:italic
							prose-em:text-void-fg-1

							prose-a:text-void-link-color
							prose-a:underline
							prose-a:decoration-void-link-color/40
							prose-a:underline-offset-2
							prose-a:transition-all
							prose-a:hover:decoration-void-link-color
							prose-a:hover:brightness-110

							prose-img:my-6
							prose-img:rounded-lg
							prose-img:border
							prose-img:border-void-border-3/20
							prose-img:shadow-sm
						"
						style={{ userSelect: 'text' }}
						role="article"
						aria-label="Plan preview"
					>
						<ChatMarkdownRender
							string={displayContent}
							chatMessageLocation={undefined}
							isLinkDetectionEnabled={true}
						/>
					</article>
				</div>
			</div>
		</div>
	);
};
