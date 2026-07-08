/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

export const VOID_PLAN_EDITOR_ID = 'workbench.editor.voidPlanEditor';

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