/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js';
import { PlanEditor } from './PlanEditor.js';
import { PlanEditorTitleActions } from './PlanEditorTitleActions.js';

export const mountPlanEditor = mountFnGenerator(PlanEditor);
export const mountPlanEditorTitleActions = mountFnGenerator(PlanEditorTitleActions);
