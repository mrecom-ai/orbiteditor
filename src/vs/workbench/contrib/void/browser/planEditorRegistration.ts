/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { PlanEditorInput } from './planEditorInput.js';
import { PlanEditorPane } from './planEditorPane.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions } from '../../../common/editor.js';

// Register EditorPane with VSCode registry
const editorPaneRegistry = Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane);
editorPaneRegistry.registerEditorPane(
	EditorPaneDescriptor.create(
		PlanEditorPane,
		PlanEditorPane.ID,
		'Void Plan Editor'
	),
	[new SyncDescriptor(PlanEditorInput)]
);

// Register custom editor for .void/plans/*.md files
class PlanEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidPlanEditor';

	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();

		this._register(editorResolverService.registerEditor(
			'**/.void/plans/*.md',
			{
				id: PlanEditorPane.ID,
				label: 'Void Plan Editor',
				priority: RegisteredEditorPriority.exclusive
			},
			{
				canSupportResource: (resource) => {
					// Only handle files in .void/plans/ directory with .md extension
					const path = resource.path;
					return path.includes('/.void/plans/') && path.endsWith('.md');
				}
			},
			{
				createEditorInput: ({ resource }) => {
					return {
						editor: instantiationService.createInstance(PlanEditorInput, resource)
					};
				}
			}
		));
	}
}

// Register at BlockRestore phase (after workbench is ready)
registerWorkbenchContribution2(
	PlanEditorContribution.ID,
	PlanEditorContribution,
	WorkbenchPhase.BlockRestore
);
