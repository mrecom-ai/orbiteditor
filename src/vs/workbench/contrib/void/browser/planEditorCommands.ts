/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RawContextKey, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { localize2 } from '../../../../nls.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { PlanEditorPane } from './planEditorPane.js';

// Context Keys
export const CONTEXT_VOID_PLAN_EDITOR_ACTIVE = new RawContextKey<boolean>(
	'voidPlanEditorActive',
	false,
	'Whether a Void plan editor is currently active'
);

export const CONTEXT_VOID_PLAN_VIEW_MODE = new RawContextKey<string>(
	'voidPlanViewMode',
	'preview',
	'Current view mode of the plan editor (preview or markdown)'
);

// Single Toggle Command with Perfect Visual Button
registerAction2(class TogglePlanViewAction extends Action2 {
	constructor() {
		super({
			id: 'void.plan.toggleView',
			title: localize2('voidPlanToggleView', 'Toggle Plan View: Preview ↔ Markdown'),
			f1: true,
			menu: {
				id: MenuId.EditorTitle,
				when: CONTEXT_VOID_PLAN_EDITOR_ACTIVE,
				group: 'navigation',
				order: 1
			},
			icon: Codicon.splitHorizontal, // Perfect toggle icon
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV,
				weight: KeybindingWeight.EditorContrib,
				when: CONTEXT_VOID_PLAN_EDITOR_ACTIVE
			},
			toggled: ContextKeyExpr.equals('voidPlanViewMode', 'markdown')
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const activePane = editorService.activeEditorPane;

		if (activePane instanceof PlanEditorPane) {
			const currentMode = activePane.getViewMode();
			const newMode = currentMode === 'preview' ? 'markdown' : 'preview';
			activePane.setViewMode(newMode);
		}
	}
});
