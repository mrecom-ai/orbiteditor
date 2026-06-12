/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FolderDown, ListChecks } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';
import { PlanTodoItem } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor } from '../../../util/services.js';
import { ModelDropdown } from '../../../orbit-settings-tsx/ModelDropdown.js';
import { OrbitProgressIndicator } from '../../../util/OrbitProgressIndicator.js';
import { usePlanBuildButtonPhase, PlanBuildButtonPhase } from '../../../util/planBuildButtonState.js';
import '../../../styles.css';

// scope-tailwind does not add void- prefix to computed expressions, so these class names
// reach the DOM without prefix and correctly match .void-scope .orbit-file-link and
// .void-scope .plan-editor-btn-* selectors defined in styles.css.
const ORBIT_FILE_LINK = 'orbit-file-link';
const PLAN_EDITOR_BTN_KBD = 'plan-editor-btn-kbd';
const PLAN_EDITOR_BTN_STATUS_DOT = 'plan-editor-btn-status-dot';
const IS_BUILDING = 'is-building';

const TodoCheckbox: React.FC<{ status: 'pending' | 'in_progress' | 'completed' }> = ({ status }) => {
	const isChecked = status === 'completed';
	const isMixed = status === 'in_progress';
	return (
		<span
			role="checkbox"
			aria-checked={isMixed ? 'mixed' : isChecked}
			tabIndex={-1}
			aria-hidden={false}
			className={
				isChecked
					? 'shrink-0 w-[14px] h-[14px] rounded-[3px] border-[1.5px] mt-[2px] inline-flex items-center justify-center'
					: isMixed
						? 'shrink-0 w-[14px] h-[14px] rounded-[3px] border-[1.5px] mt-[2px] inline-flex items-center justify-center'
						: 'shrink-0 w-[14px] h-[14px] rounded-[3px] border-[1.5px] mt-[2px] inline-block'
			}
			style={
				isChecked
					? { background: 'var(--void-fg-2)', borderColor: 'var(--void-fg-2)' }
					: isMixed
						? { borderColor: 'var(--void-fg-2)' }
						: { borderColor: 'var(--void-fg-3)' }
			}
		>
			{isChecked && (
				<svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
					<path d="M3 8.5l3.2 3.2L13 4.5" stroke="var(--void-bg-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			)}
		</span>
	);
};

export const PlanCard = ({
	threadId,
	planName,
	overview,
	todos: initialTodos,
	planPath,
	isDraft,
}: {
	threadId: string;
	planName: string;
	overview: string;
	todos: PlanTodoItem[];
	planMarkdown?: string;
	planPath?: string;
	isDraft: boolean;
}) => {
	const accessor = useAccessor();
	const chatThreadService = accessor.get('IChatThreadService');
	const commandService = accessor.get('ICommandService');

	const [draftVersion, setDraftVersion] = useState(0);
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		const disposable = chatThreadService.onDidChangeThreadPlanDraft(({ threadId: changedId }) => {
			if (changedId === threadId) setDraftVersion(v => v + 1);
		});
		return () => disposable.dispose();
	}, [chatThreadService, threadId]);

	useEffect(() => {
		const disposable = chatThreadService.onDidChangeThreadLinkedPlanPath(({ threadId: changedId }) => {
			if (changedId === threadId) setDraftVersion(v => v + 1);
		});
		return () => disposable.dispose();
	}, [chatThreadService, threadId]);

	const thread = chatThreadService.state.allThreads[threadId];
	const liveDraft = thread?.planDraft;
	const linkedPlanPath = thread?.linkedPlanPath;
	const savedPath = liveDraft?.savedPlanPath ?? planPath ?? linkedPlanPath;

	const displayTitle = liveDraft?.name ?? planName;
	const displayOverview = liveDraft?.overview ?? overview;

	const displayTodos = useMemo(() => {
		const base = liveDraft?.todos?.length ? liveDraft.todos : initialTodos;
		return base.map(t => ({
			...t,
			status: thread?.todoList?.find(td => td.id === t.id)?.status ?? 'pending',
		}));
	}, [liveDraft, initialTodos, thread?.todoList, draftVersion]);

	const isSaved = !!(savedPath && (!isDraft || liveDraft?.savedPlanPath));

	const displayFilename = useMemo(() => {
		if (savedPath) {
			const sep = savedPath.includes('/') ? '/' : '\\';
			return savedPath.split(sep).pop() ?? savedPath;
		}
		return isDraft ? 'Unsaved draft' : planName;
	}, [savedPath, isDraft, planName]);

	const buildPhase: PlanBuildButtonPhase = usePlanBuildButtonPhase(threadId);
	const buildIsBusy = buildPhase === 'building';

	const handleViewPlan = () => {
		if (savedPath) {
			commandService.executeCommand('vscode.open', URI.file(savedPath));
			return;
		}
		if (!isSaved && (isDraft || liveDraft)) {
			commandService.executeCommand('orbit.plan.openDraft', threadId);
		}
	};

	const handleSave = () => {
		commandService.executeCommand('orbit.plan.saveToWorkspace', threadId);
	};

	const handleBuild = () => {
		if (buildIsBusy || buildPhase === 'built') return;
		commandService.executeCommand('orbit.plan.buildFromDraft', threadId);
	};

	const buildButtonClass = (() => {
		switch (buildPhase) {
			case 'built':  return 'plan-editor-btn plan-editor-btn-built';
			case 'failed': return 'plan-editor-btn plan-editor-btn-failed';
			default:       return 'plan-editor-btn plan-editor-btn-primary';
		}
	})();

	const buildButtonLabel = (() => {
		switch (buildPhase) {
			case 'built':    return 'Built';
			case 'failed':   return 'Failed';
			case 'building': return 'Building…';
			default:         return 'Build';
		}
	})();

	const isBuilding = buildPhase === 'building';
	const isBuilt = buildPhase === 'built';
	const isFailed = buildPhase === 'failed';

	return (
		<ToolChildrenWrapper disableOverflowY disableMaxHeight>
			<div className="py-1.5 px-3">
				<div className="border border-void-border-2 rounded-[10px] bg-void-bg-2 overflow-hidden transition-colors duration-200 hover:border-void-border-1">

					<div className="flex items-center gap-2 px-3 py-2 border-b border-void-border-2">
						<ListChecks
							size={13}
							className="shrink-0 text-void-fg-3"
							strokeWidth={1.75}
							aria-hidden
						/>
						<span
							className="text-void-fg-3 text-[11px] flex-1 min-w-0 truncate leading-none"
							title={savedPath ?? displayTitle}
						>
							{displayFilename}
						</span>
						<div className="flex items-center gap-0.5 shrink-0 ml-auto -mr-0.5">
							{!isSaved && (
								<button
									type="button"
									className="p-1 rounded text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1 transition-colors duration-150"
									onClick={handleSave}
									aria-label="Save to workspace"
									title="Save to workspace"
								>
									<FolderDown size={13} strokeWidth={1.75} />
								</button>
							)}
							<button
								type="button"
								className="p-1 rounded text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1 transition-colors duration-150"
								onClick={() => setCollapsed(v => !v)}
								aria-label={collapsed ? 'Expand plan' : 'Collapse plan'}
								aria-expanded={!collapsed}
								title={collapsed ? 'Expand' : 'Collapse'}
							>
								{collapsed
									? <ChevronDown size={13} strokeWidth={1.75} />
									: <ChevronUp size={13} strokeWidth={1.75} />}
							</button>
						</div>
					</div>

					{!collapsed && (
						<>
							<div className="flex flex-col gap-2 px-3 pt-2.5 pb-2">
								<h3 className="text-void-fg-0 font-bold text-xl leading-tight tracking-tight m-0">
									{displayTitle}
								</h3>

								{displayOverview && (
									<p className="text-void-fg-2 text-[12px] leading-[1.5] m-0 whitespace-pre-wrap break-words">
										{displayOverview}
									</p>
								)}

								{displayTodos.length > 0 && (
									<div className="border border-void-border-2 rounded-lg bg-void-bg-1 px-3 py-2 flex flex-col gap-1.5">
										<div className="text-void-fg-3 text-[11px] font-medium tracking-wide">
											{displayTodos.length} To-do{displayTodos.length !== 1 ? 's' : ''}
										</div>
										<div className="flex flex-col gap-1.5">
											{displayTodos.map(todo => (
												<div key={todo.id} className="flex items-start gap-2 text-[12.5px] leading-snug text-void-fg-1">
													<TodoCheckbox status={todo.status} />
													<span
														className={
															todo.status === 'completed'
																? 'flex-1 min-w-0 break-words text-void-fg-3 line-through'
																: 'flex-1 min-w-0 break-words'
														}
													>
														{todo.content}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							<div className="flex items-center justify-between gap-2 border-t border-void-border-2 px-3 py-1.5">
								<button
									type="button"
									onClick={handleViewPlan}
									className={ORBIT_FILE_LINK}
									style={{ fontSize: '12px', flexShrink: 0 }}
									title={savedPath ?? 'Open plan'}
								>
									View Plan
								</button>
								<div className="flex items-center gap-2 min-w-0 shrink-0">
									<ModelDropdown featureName="Chat" className="text-[11px]" />
								<button
									type="button"
									onClick={handleBuild}
									className={`${buildButtonClass} flex items-center gap-1.5${isBuilding ? ` ${IS_BUILDING}` : ''}`}
									title={isFailed ? 'Build failed — click to try again' : 'Build plan (⌘↵)'}
									disabled={buildIsBusy}
									aria-busy={buildIsBusy}
									aria-label={isBuilt ? 'Built' : isFailed ? 'Build failed' : 'Build plan'}
								>
									{isBuilding && (
										<OrbitProgressIndicator size="xs" variant="foreground" label="Building" />
									)}
									{isFailed && <span className={PLAN_EDITOR_BTN_STATUS_DOT} aria-hidden />}
									<span aria-live="polite" className="truncate">{buildButtonLabel}</span>
									{!isBuilding && !isBuilt && !isFailed && (
										<span className={PLAN_EDITOR_BTN_KBD} aria-hidden>⌘↵</span>
									)}
								</button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</ToolChildrenWrapper>
	);
};
