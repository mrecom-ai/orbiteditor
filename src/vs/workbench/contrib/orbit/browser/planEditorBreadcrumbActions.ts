/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../base/common/async.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { PlanEditorInput } from './planEditorInput.js';

const PLAN_EDITOR_BREADCRUMBS_ROW_CLASS = 'plan-editor-breadcrumbs-row';
const PLAN_EDITOR_BREADCRUMB_ACTIONS_CLASS = 'plan-editor-breadcrumb-actions';

export interface PlanEditorTitleActionsState {
	threadId?: string;
	isDraft: boolean;
	isDirty: boolean;
	isSaving: boolean;
	isStarting: boolean;
	onSaveToWorkspace?: () => void;
	onBuild?: () => void;
}

/** Resolve the VS Code title row that hosts breadcrumbs (multi-tab or single-tab layout). */
export function getPlanEditorBreadcrumbRow(editorContainer: HTMLElement): HTMLElement | null {
	const groupContainer = editorContainer.closest('.editor-group-container');
	if (!groupContainer) {
		return null;
	}

	// Multiple tabs: breadcrumbs live below the tab strip.
	const belowTabs = groupContainer.querySelector('.breadcrumbs-below-tabs');
	if (belowTabs instanceof HTMLElement) {
		return belowTabs;
	}

	// Single tab: breadcrumbs are inlined in the title row.
	const singleTabTitle = groupContainer.querySelector('.title.breadcrumbs');
	if (singleTabTitle instanceof HTMLElement) {
		return singleTabTitle;
	}

	return null;
}

type PlanEditorTitleActionsMount = {
	rerender?: (props?: PlanEditorTitleActionsState) => void;
	dispose?: () => void;
};

export class PlanEditorBreadcrumbActionsMount implements IDisposable {
	private _host: HTMLElement | undefined;
	private _reactMount: PlanEditorTitleActionsMount | undefined;
	private _mountScheduler: RunOnceScheduler;
	private _mountAttempts = 0;
	private _state: PlanEditorTitleActionsState | undefined;
	private _input: PlanEditorInput | undefined;
	private _editorContainer: HTMLElement | undefined;

	constructor(
		private readonly instantiationService: IInstantiationService,
	) {
		this._mountScheduler = new RunOnceScheduler(() => {
			void this._mount();
		}, 0);
	}

	scheduleMount(editorContainer: HTMLElement, input: PlanEditorInput, state: PlanEditorTitleActionsState): void {
		this._editorContainer = editorContainer;
		this._input = input;
		this._state = state;
		this._mountAttempts = 0;
		this._mountScheduler.schedule();
	}

	updateState(state: PlanEditorTitleActionsState): void {
		this._state = state;
		if (this._reactMount?.rerender) {
			this._reactMount.rerender(state);
			return;
		}
		if (this._host) {
			void this._mount();
		}
	}

	private async _mount(): Promise<void> {
		if (!this._editorContainer || !this._input || !this._state) {
			return;
		}

		const breadcrumbRow = getPlanEditorBreadcrumbRow(this._editorContainer);
		if (!breadcrumbRow) {
			if (this._mountAttempts++ < 20) {
				this._mountScheduler.schedule();
			}
			return;
		}

		breadcrumbRow.classList.add(PLAN_EDITOR_BREADCRUMBS_ROW_CLASS);

		if (!this._host || this._host.parentElement !== breadcrumbRow) {
			this._host?.remove();
			this._host = document.createElement('div');
			this._host.className = PLAN_EDITOR_BREADCRUMB_ACTIONS_CLASS;

			// Single-tab: keep actions on the title row after breadcrumbs, before native title-actions.
			const titleActions = breadcrumbRow.querySelector('.title-actions');
			if (titleActions) {
				breadcrumbRow.insertBefore(this._host, titleActions);
			} else {
				breadcrumbRow.appendChild(this._host);
			}
		}

		if (!this._reactMount) {
			const { mountPlanEditorTitleActions } = await import('./react/out/plan-editor-tsx/index.js');
			const state = this._state;
			this._reactMount = this.instantiationService.invokeFunction(accessor =>
				mountPlanEditorTitleActions(this._host!, accessor, state)
			);
		} else {
			this._reactMount.rerender?.(this._state);
		}
	}

	dispose(): void {
		this._mountScheduler.dispose();
		this._reactMount?.dispose?.();
		this._reactMount = undefined;
		this._host?.remove();
		this._host = undefined;

		if (this._editorContainer) {
			getPlanEditorBreadcrumbRow(this._editorContainer)?.classList.remove(PLAN_EDITOR_BREADCRUMBS_ROW_CLASS);
		}

		this._editorContainer = undefined;
		this._input = undefined;
		this._state = undefined;
	}
}