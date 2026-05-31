/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ChatHistoryVisibleContext } from '../../../common/contextkeys.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { mountHistoryDropdown } from './react/out/history-dropdown-tsx/index.js';

export const HISTORY_DROPDOWN_TOGGLE_EVENT = 'void-toggle-history-dropdown';

let dropdownContainer: HTMLElement | null = null;

function toggleDropdown() {
	if (!dropdownContainer) { return; }
	const isVisible = dropdownContainer.style.display !== 'none';
	dropdownContainer.style.display = isVisible ? 'none' : 'block';
}

function hideDropdown() {
	if (!dropdownContainer) { return; }
	dropdownContainer.style.display = 'none';
}

export function isHistoryDropdownVisible(): boolean {
	return dropdownContainer !== null && dropdownContainer.style.display !== 'none';
}

export class HistoryDropdownContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.historyDropdown';

	private chatHistoryVisibleKey: ReturnType<typeof ChatHistoryVisibleContext.bindTo>;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();

		// Bind chatHistoryVisible to the GLOBAL context key service so ViewTitle menus can see it
		this.chatHistoryVisibleKey = ChatHistoryVisibleContext.bindTo(this.contextKeyService);

		// Set initial state
		this.chatHistoryVisibleKey.set(this.layoutService.isVisible(Parts.CHATHISTORY_PART));

		this.initializeDropdown();
	}

	private initializeDropdown(): void {
		const workbench = document.querySelector('.monaco-workbench');
		if (!workbench) {
			setTimeout(() => this.initializeDropdown(), 500);
			return;
		}

		dropdownContainer = document.createElement('div');
		dropdownContainer.className = 'void-history-dropdown-container';
		dropdownContainer.style.cssText = 'display:none;position:fixed;z-index:99999;top:35px;right:80px;';
		workbench.appendChild(dropdownContainer);

		this.instantiationService.invokeFunction((accessor: ServicesAccessor) => {
			const result = mountHistoryDropdown(dropdownContainer!, accessor, {
				onClose: hideDropdown,
			});
			if (result && typeof result.dispose === 'function') {
				this._register(toDisposable(result.dispose));
			}
		});

		// Listen for toggle events dispatched by sidebarActions
		const toggleHandler = () => { toggleDropdown(); };
		document.addEventListener(HISTORY_DROPDOWN_TOGGLE_EVENT, toggleHandler);

		// Listen for ChatHistory panel visibility changes and keep the global context key in sync
		const checkVisibility = () => {
			const isVisible = this.layoutService.isVisible(Parts.CHATHISTORY_PART);
			this.chatHistoryVisibleKey.set(isVisible);
		};

		// Poll periodically for visibility changes (layout service fires internal events but
		// they're not easily accessible from here; polling is lightweight and catches all changes)
		const visibilityInterval = setInterval(checkVisibility, 500);

		this._register(toDisposable(() => {
			document.removeEventListener(HISTORY_DROPDOWN_TOGGLE_EVENT, toggleHandler);
			clearInterval(visibilityInterval);
			if (dropdownContainer?.parentElement) {
				dropdownContainer.parentElement.removeChild(dropdownContainer);
			}
			dropdownContainer = null;
		}));
	}
}

registerWorkbenchContribution2(HistoryDropdownContribution.ID, HistoryDropdownContribution, WorkbenchPhase.AfterRestored);
