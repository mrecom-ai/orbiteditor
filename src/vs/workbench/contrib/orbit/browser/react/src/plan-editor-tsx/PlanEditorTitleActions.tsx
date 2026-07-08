/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { Check } from 'lucide-react';
import { ModelDropdown } from '../orbit-settings-tsx/ModelDropdown.js';
import { useIsDark } from '../util/services.js';
import { usePlanBuildButtonPhase } from '../util/planBuildButtonState.js';
import { OrbitProgressIndicator } from '../util/OrbitProgressIndicator.js';
import '../styles.css';

export interface PlanEditorTitleActionsProps {
	threadId?: string;
	isDraft?: boolean;
	isDirty?: boolean; // accepted but display handled by parent PlanEditor
	isSaving?: boolean;
	isStarting?: boolean;
	onSaveToWorkspace?: () => void;
	onBuild?: () => void;
}

export const PlanEditorTitleActions: React.FC<PlanEditorTitleActionsProps> = ({
	threadId,
	isDraft,
	isSaving,
	isStarting,
	onSaveToWorkspace,
	onBuild,
}) => {
	const isDark = useIsDark();
	const buildPhase = usePlanBuildButtonPhase(threadId, { isSaving, isStarting });
	const isBuilding = buildPhase === 'building';
	const isBuilt = buildPhase === 'built';
	const isFailed = buildPhase === 'failed';

	const buildTitle = isDraft
		? 'Save and send plan to agent'
		: isBuilt
			? 'Agent finished — click to run again'
			: isFailed
				? 'Build failed — click to try again'
				: 'Send plan to agent and start execution';

		return (
			<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
				<div className="@@plan-editor-breadcrumb-actions-inner">
					{isDraft && onSaveToWorkspace && (
						<button
							type="button"
							onClick={onSaveToWorkspace}
							disabled={isSaving || isBuilding}
							className="@@plan-editor-btn @@plan-editor-btn-secondary @@plan-editor-save-btn"
							title="Save plan to .void/plans/"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
								<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
								<polyline points="17 21 17 13 7 13 7 21" />
								<polyline points="7 3 7 8 15 8" />
							</svg>
							<span className="@@plan-editor-save-label">Save</span>
						</button>
					)}
					<ModelDropdown
						featureName="Chat"
						className="@@plan-editor-model-dropdown min-w-[72px] max-w-[min(180px,28vw)] text-xs leading-5 px-1 shrink-0"
					/>
					{onBuild && (
						<button
							type="button"
							onClick={onBuild}
							disabled={isBuilding || isSaving}
							className={`@@plan-editor-btn @@plan-editor-build-btn ${
								isBuilt
									? '@@plan-editor-btn-built'
									: isFailed
										? '@@plan-editor-btn-failed'
										: '@@plan-editor-btn-primary'
							}${isBuilding ? ' @@is-building' : ''}`}
							title={buildTitle}
							aria-busy={isBuilding}
							aria-label={isBuilt ? 'Built' : isFailed ? 'Build failed' : 'Build plan'}
						>
							{isBuilding ? (
								<>
									<OrbitProgressIndicator size="xs" variant="foreground" label="Building" />
									<span className="@@plan-editor-build-label">Building…</span>
								</>
							) : isBuilt ? (
								<>
									<Check className="@@plan-editor-build-icon" size={12} strokeWidth={3} aria-hidden />
									<span className="@@plan-editor-build-label">Built</span>
								</>
							) : isFailed ? (
								<>
									<span className="@@plan-editor-btn-status-dot" aria-hidden />
									<span className="@@plan-editor-build-label">Failed</span>
								</>
							) : (
								<>
									<svg className="@@plan-editor-build-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
										<polygon points="5 3 19 12 5 21 5 3" />
									</svg>
									<span className="@@plan-editor-build-label">Build</span>
									<span className="@@plan-editor-btn-kbd" aria-hidden>⌘↵</span>
								</>
							)}
						</button>
					)}
				</div>
			</div>
		);
};