/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import * as domStylesheetsJs from '../../../../base/browser/domStylesheets.js';
import * as cssJs from '../../../../base/browser/cssValue.js';
import { Action, IAction } from '../../../../base/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService, Themable } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { switchTerminalActionViewItemSeparator, switchTerminalShowTabsTitle } from './terminalActions.js';
import { INotificationService, IPromptChoice, Severity } from '../../../../platform/notification/common/notification.js';
import { ICreateTerminalOptions, ITerminalConfigurationService, ITerminalGroup, ITerminalGroupService, ITerminalInstance, ITerminalService, TerminalConnectionState, TerminalDataTransfers } from './terminal.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IMenu, IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ITerminalProfileResolverService, ITerminalProfileService, TerminalCommandId } from '../common/terminal.js';
import { TerminalSettingId, ITerminalProfile, TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { ActionViewItem, IBaseActionViewItemOptions, SelectActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { asCssVariable, selectBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { ISelectOptionItem } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { IActionViewItem } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { TerminalTabbedView } from './terminalTabbedView.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { getColorForSeverity } from './terminalStatusList.js';
import { getFlatContextMenuActions, MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { DisposableMap, DisposableStore, dispose, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { getColorClass, getUriClasses } from './terminalIcon.js';
import { getTerminalActionBarArgs } from './terminalMenus.js';
import { TerminalContextKeys, TerminalContextKeyStrings } from '../common/terminalContextKey.js';
import { TerminalStorageKeys } from '../common/terminalStorageKeys.js';
import { getInstanceHoverInfo } from './terminalTooltip.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { TerminalCapability } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { Event } from '../../../../base/common/event.js';
import { IHoverDelegate, IHoverDelegateOptions } from '../../../../base/browser/ui/hover/hoverDelegate.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { InstanceContext, TerminalContextActionRunner } from './terminalContextMenu.js';
import { MicrotaskDelay } from '../../../../base/common/symbols.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';

export class TerminalViewPane extends ViewPane {
	private _parentDomElement: HTMLElement | undefined;
	private _terminalTabbedView?: TerminalTabbedView;
	get terminalTabbedView(): TerminalTabbedView | undefined { return this._terminalTabbedView; }
	private _isInitialized: boolean = false;
	/**
	 * Tracks an active promise of terminal creation requested by this component. This helps prevent
	 * double creation for example when toggling a terminal's visibility and focusing it.
	 */
	private _isTerminalBeingCreated: boolean = false;
	private readonly _newDropdown: MutableDisposable<DropdownWithPrimaryActionViewItem> = this._register(new MutableDisposable());
	private readonly _dropdownMenu: IMenu;
	private readonly _singleTabMenu: IMenu;
	private _viewShowing: IContextKey<boolean>;
	private readonly _disposableStore = this._register(new DisposableStore());
	private readonly _actionDisposables: DisposableMap<TerminalCommandId> = this._register(new DisposableMap());
	private _vibeSubHeader: HTMLElement | undefined;
	private _vibeContextKey!: IContextKey<boolean>;
	private _vibeTabsContainer: HTMLElement | undefined;
	private _vibeTabsDisposables: DisposableStore = this._register(new DisposableStore());
	private _vibeGroupListeners: DisposableStore = this._register(new DisposableStore());
	private _draggedGroup: ITerminalGroup | undefined;
	private _dropIndicator: HTMLElement | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@IMenuService private readonly _menuService: IMenuService,
		@ITerminalProfileService private readonly _terminalProfileService: ITerminalProfileService,
		@ITerminalProfileResolverService private readonly _terminalProfileResolverService: ITerminalProfileResolverService,
		@IThemeService private readonly _themeService: IThemeService,
		@IAccessibilityService private readonly _accessibilityService: IAccessibilityService,
		@IStorageService private readonly _storageService: IStorageService
	) {
		super(options, keybindingService, _contextMenuService, _configurationService, _contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService);
		this._register(this._terminalService.onDidRegisterProcessSupport(() => {
			this._onDidChangeViewWelcomeState.fire();
		}));

		this._register(this._terminalService.onDidChangeInstances(() => {
			// If the first terminal is opened, hide the welcome view
			// and if the last one is closed, show it again
			if (this._hasWelcomeScreen() && this._terminalGroupService.instances.length <= 1) {
				this._onDidChangeViewWelcomeState.fire();
			}
			if (!this._parentDomElement) { return; }
			// If we do not have the tab view yet, create it now.
			if (!this._terminalTabbedView) {
				this._createTabsView();
			}
			// If we just opened our first terminal, layout
			if (this._terminalGroupService.instances.length === 1) {
				this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
			}
			// Update vibe sub-header when terminals are created/destroyed
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));
		this._dropdownMenu = this._register(this._menuService.createMenu(MenuId.TerminalNewDropdownContext, this._contextKeyService));
		this._singleTabMenu = this._register(this._menuService.createMenu(MenuId.TerminalTabContext, this._contextKeyService));
		this._register(this._terminalProfileService.onDidChangeAvailableProfiles(profiles => this._updateTabActionBar(profiles)));
		this._viewShowing = TerminalContextKeys.viewShowing.bindTo(this._contextKeyService);

		// Initialize vibe with terminal context key
		this._vibeContextKey = TerminalContextKeys.vibeWithTerminal.bindTo(this._contextKeyService);
		const initialVibeState = this._storageService.getBoolean(
			TerminalStorageKeys.VibeWithTerminalEnabled,
			StorageScope.PROFILE,
			false
		);
		this._vibeContextKey.set(initialVibeState);

		// Set up group instance listeners
		this._setupGroupInstanceListeners();

		// Apply initial vibe mode state to existing groups
		if (initialVibeState) {
			const groups = this._terminalGroupService.groups;
			for (const group of groups) {
				try {
					// Don't force orientation - let groups use default or preserved orientation
					group.setVibeMode(true);
				} catch (error) {
					// Group might not be fully initialized, will be set when it initializes
					console.warn('Failed to set initial vibe mode on group:', error);
				}
			}
		}

		this._register(this.onDidChangeBodyVisibility(e => {
			if (e) {
				this._terminalTabbedView?.rerenderTabs();
			}
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (this._parentDomElement && (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled) || e.affectsConfiguration(TerminalSettingId.ShellIntegrationEnabled))) {
				this._updateForShellIntegration(this._parentDomElement);
			}
		}));
		const shellIntegrationDisposable = this._register(new MutableDisposable());
		shellIntegrationDisposable.value = this._terminalService.onAnyInstanceAddedCapabilityType(c => {
			if (c === TerminalCapability.CommandDetection && this._gutterDecorationsEnabled()) {
				this._parentDomElement?.classList.add('shell-integration');
				shellIntegrationDisposable.clear();
			}
		});

		// Listen for context key changes (toggle button clicks)
		this._register(this._contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([TerminalContextKeyStrings.VibeWithTerminal]))) {
				this._updateVibeSubHeader();
			}
		}));

		// Listen for terminal name changes
		this._register(this._terminalService.onAnyInstanceTitleChange(() => {
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));

		// Listen for active terminal switching
		this._register(this._terminalGroupService.onDidChangeActiveInstance(() => {
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));

		// Listen for group changes (creation, disposal, reordering)
		this._register(this._terminalGroupService.onDidChangeGroups(() => {
			// Set up listeners for all groups' instance changes
			this._setupGroupInstanceListeners();
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));

		// Listen for group disposal
		this._register(this._terminalGroupService.onDidDisposeGroup(() => {
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));

		// Listen for active group changes
		this._register(this._terminalGroupService.onDidChangeActiveGroup(() => {
			if (this._vibeContextKey.get()) {
				this._updateVibeSubHeader();
			}
		}));
	}

	private _updateForShellIntegration(container: HTMLElement) {
		container.classList.toggle('shell-integration', this._gutterDecorationsEnabled());
	}

	private _gutterDecorationsEnabled(): boolean {
		const decorationsEnabled = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
		return (decorationsEnabled === 'both' || decorationsEnabled === 'gutter') && this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled);
	}

	private _updateVibeSubHeader(): void {
		const isEnabled = this._vibeContextKey.get() ?? false;
		const groups = this._terminalGroupService.groups;

		// Ensure tabs view is created if we have terminals
		if (!this._terminalTabbedView && groups.length > 0 && this._parentDomElement) {
			this._createTabsView();
		}

		// Update the terminalTabbedView to hide/show the sidebar
		if (this._terminalTabbedView) {
			this._terminalTabbedView.setVibeMode(isEnabled);
			// Force a refresh of the tabs view layout
			this._terminalTabbedView.rerenderTabs();
		}

		// Set vibe mode on all groups
		// IMPORTANT: Call without explicit orientation to preserve each group's choice
		// - New groups automatically get HORIZONTAL (default in setVibeMode)
		// - Groups with VERTICAL (set by Cmd+D) keep VERTICAL
		// Create a shallow copy to avoid issues if groups are modified during iteration
		const groupsCopy = [...groups];
		for (const group of groupsCopy) {
			try {
				// Call setVibeMode without orientation parameter
				// This preserves existing orientation or uses HORIZONTAL default for new groups
				group.setVibeMode(isEnabled);
			} catch (error) {
				// Group might have been disposed, continue with others
				console.warn('Failed to set vibe mode on group:', error);
			}
		}

		// Only show sub-header when vibe mode is enabled AND there are 2+ groups
		if (isEnabled && groups.length > 1) {
			// Create sub-header container if it doesn't exist
			if (!this._vibeSubHeader && this._parentDomElement) {
				this._vibeSubHeader = dom.prepend(
					this._parentDomElement,
					dom.$('.terminal-vibe-subheader')
				);
				this._vibeSubHeader.style.height = '35px';
				this._vibeSubHeader.style.minHeight = '35px';
				this._vibeSubHeader.style.width = '100%';
				this._vibeSubHeader.style.padding = '0 8px';
				this._vibeSubHeader.style.borderBottom = '1px solid var(--vscode-panel-border)';
				this._vibeSubHeader.style.backgroundColor = 'var(--vscode-editor-background)';
				this._vibeSubHeader.style.display = 'flex';
				this._vibeSubHeader.style.alignItems = 'center';
				this._vibeSubHeader.style.overflowX = 'auto';
				this._vibeSubHeader.style.overflowY = 'hidden';
				this._vibeSubHeader.style.flexShrink = '0';
				this._vibeSubHeader.style.boxSizing = 'border-box';
				this._vibeSubHeader.style.position = 'relative';
				this._vibeSubHeader.style.zIndex = '1';

				// Create tabs container
				this._vibeTabsContainer = dom.$('.terminal-vibe-tabs');
				this._vibeTabsContainer.style.display = 'flex';
				this._vibeTabsContainer.style.gap = '0';
				this._vibeTabsContainer.style.alignItems = 'stretch';
				this._vibeTabsContainer.style.height = '100%';
				this._vibeTabsContainer.style.minWidth = '100%';
				dom.append(this._vibeSubHeader, this._vibeTabsContainer);
			}

			if (this._vibeSubHeader && this._vibeTabsContainer) {
				// Clear existing tabs and disposables
				dom.clearNode(this._vibeTabsContainer);
				this._vibeTabsDisposables.clear();

				const activeGroup = this._terminalGroupService.activeGroup;

				// Create a tab for each terminal group
				for (const group of groups) {
					const isActive = group === activeGroup;
					const tab = this._createTerminalGroupTab(group, isActive);
					dom.append(this._vibeTabsContainer, tab);
				}

				this._vibeSubHeader.style.display = 'flex';
			}
		} else {
			// Hide sub-header when disabled, only 1 terminal, or no terminals
			if (this._vibeSubHeader) {
				this._vibeSubHeader.style.display = 'none';
			}
			this._vibeTabsDisposables.clear();

			// When switching back to normal mode, refresh the tabs view to show sidebar
			if (this._terminalTabbedView && !isEnabled) {
				this._terminalTabbedView.rerenderTabs();
			}
		}

		// Re-layout to account for sub-header height
		if (this._parentDomElement) {
			this.layoutBody(
				this._parentDomElement.offsetHeight,
				this._parentDomElement.offsetWidth
			);
		}
	}

	private _setupGroupInstanceListeners(): void {
		// Clear existing listeners
		this._vibeGroupListeners.clear();

		// Set up listeners for each group's instance changes
		for (const group of this._terminalGroupService.groups) {
			this._vibeGroupListeners.add(group.onInstancesChanged(() => {
				if (this._vibeContextKey.get()) {
					this._updateVibeSubHeader();
				}
			}));
		}
	}

	private _createTerminalGroupTab(group: ITerminalGroup, isActive: boolean): HTMLElement {
		const primaryInstance = group.terminalInstances[0];
		if (!primaryInstance) {
			// Fallback for empty group
			return dom.$('.terminal-vibe-tab');
		}
		const tab = dom.$('.terminal-vibe-tab');
		tab.style.display = 'flex';
		tab.style.alignItems = 'center';
		tab.style.gap = '8px';
		tab.style.padding = '0 16px';
		tab.style.height = '100%';
		tab.style.cursor = 'pointer';
		tab.style.fontSize = '13px';
		tab.style.fontWeight = '400';
		tab.style.minWidth = '100px';
		tab.style.maxWidth = '300px';
		tab.style.position = 'relative';
		tab.style.userSelect = 'none';
		tab.style.borderRight = '1px solid rgba(128, 128, 128, 0.1)';
		tab.style.transition = 'all 0.15s ease';

		// Make tab draggable
		tab.draggable = true;
		tab.setAttribute('data-group-id', group.terminalInstances[0]?.instanceId.toString() || '');

		// Create content wrapper (for icon and label)
		const contentWrapper = dom.$('.terminal-vibe-tab-content');
		contentWrapper.style.display = 'flex';
		contentWrapper.style.alignItems = 'center';
		contentWrapper.style.gap = '8px';
		contentWrapper.style.flex = '1';
		contentWrapper.style.minWidth = '0';
		contentWrapper.style.overflow = 'hidden';

		// Premium clean styling for active/inactive tabs
		if (isActive) {
			tab.style.backgroundColor = 'var(--vscode-tab-activeBackground, rgba(255, 255, 255, 0.08))';
			tab.style.color = 'var(--vscode-tab-activeForeground, inherit)';
			tab.style.borderBottom = '2px solid var(--vscode-focusBorder, rgba(14, 165, 233, 1))';
			tab.style.fontWeight = '500';
		} else {
			tab.style.backgroundColor = 'transparent';
			tab.style.color = 'var(--vscode-tab-inactiveForeground, rgba(255, 255, 255, 0.6))';
			tab.style.borderBottom = '2px solid transparent';
		}

		// Add icon with premium styling
		const icon = primaryInstance.icon;
		if (icon && ThemeIcon.isThemeIcon(icon)) {
			const iconElement = dom.$('span.codicon.codicon-' + icon.id);
			iconElement.style.flexShrink = '0';
			iconElement.style.display = 'flex';
			iconElement.style.alignItems = 'center';
			iconElement.style.fontSize = '16px';
			iconElement.style.opacity = isActive ? '1' : '0.7';
			dom.append(contentWrapper, iconElement);
		}

		// Add terminal name with split count - clean typography
		const nameElement = dom.$('span.terminal-vibe-tab-label');
		const groupTitle = group.title || primaryInstance.title || 'Terminal';
		const splitCount = group.terminalInstances.length;

		// Show split count if more than 1 terminal in group
		if (splitCount > 1) {
			const titleSpan = dom.$('span');
			titleSpan.textContent = groupTitle;
			titleSpan.style.fontWeight = 'inherit';

			const countSpan = dom.$('span');
			countSpan.textContent = ` (${splitCount})`;
			countSpan.style.opacity = '0.6';
			countSpan.style.fontSize = '12px';
			countSpan.style.fontWeight = '400';

			nameElement.appendChild(titleSpan);
			nameElement.appendChild(countSpan);
		} else {
			nameElement.textContent = groupTitle;
		}

		nameElement.style.overflow = 'hidden';
		nameElement.style.textOverflow = 'ellipsis';
		nameElement.style.whiteSpace = 'nowrap';
		nameElement.style.flex = '1';
		nameElement.style.minWidth = '0';
		nameElement.style.lineHeight = '1.4';
		dom.append(contentWrapper, nameElement);

		dom.append(tab, contentWrapper);

		// Add close button with premium clean styling
		const closeButton = dom.$('span.codicon.codicon-close.terminal-vibe-tab-close');
		closeButton.style.flexShrink = '0';
		closeButton.style.display = 'none';
		closeButton.style.alignItems = 'center';
		closeButton.style.justifyContent = 'center';
		closeButton.style.width = '22px';
		closeButton.style.height = '22px';
		closeButton.style.borderRadius = '3px';
		closeButton.style.cursor = 'pointer';
		closeButton.style.opacity = '0.6';
		closeButton.style.fontSize = '14px';
		closeButton.style.transition = 'all 0.15s ease';
		closeButton.title = 'Kill Terminal';
		dom.append(tab, closeButton);

		// Premium close button hover effect
		this._vibeTabsDisposables.add(dom.addDisposableListener(closeButton, 'mouseenter', (e) => {
			e.stopPropagation();
			closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
			closeButton.style.opacity = '1';
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(closeButton, 'mouseleave', (e) => {
			e.stopPropagation();
			closeButton.style.backgroundColor = 'transparent';
			closeButton.style.opacity = '0.6';
		}));

		// Close button click handler - dispose all terminals in the group
		this._vibeTabsDisposables.add(dom.addDisposableListener(closeButton, 'click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			// Dispose all instances in the group
			for (const instance of group.terminalInstances) {
				instance.dispose();
			}
		}));

		// Add click handler to switch to this group
		this._vibeTabsDisposables.add(dom.addDisposableListener(contentWrapper, 'click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			// Set the group's active instance as the global active instance
			if (group.activeInstance) {
				this._terminalGroupService.setActiveInstance(group.activeInstance);
			} else if (group.terminalInstances[0]) {
				this._terminalGroupService.setActiveInstance(group.terminalInstances[0]);
			}
			this._terminalGroupService.showPanel(true);
		}));

		// Add context menu handler
		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			// Set active instance from group before showing menu
			const targetInstance = group.activeInstance || group.terminalInstances[0];
			if (targetInstance) {
				this._terminalGroupService.setActiveInstance(targetInstance);
			}
			this._contextMenuService.showContextMenu({
				getAnchor: () => ({ x: e.clientX, y: e.clientY }),
				getActions: () => {
					const actions = this._singleTabMenu.getActions();
					return actions.flatMap(group => group[1]);
				}
			});
		}));

		// Add hover effect for tab
		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'mouseenter', () => {
			closeButton.style.display = 'flex';
			if (!isActive) {
				tab.style.backgroundColor = 'var(--vscode-tab-hoverBackground)';
				tab.style.color = 'var(--vscode-tab-hoverForeground)';
			}
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'mouseleave', () => {
			if (!isActive) {
				closeButton.style.display = 'none';
			}
			if (!isActive) {
				tab.style.backgroundColor = 'var(--vscode-tab-inactiveBackground)';
				tab.style.color = 'var(--vscode-tab-inactiveForeground)';
			}
		}));

		// Show close button on active tab
		if (isActive) {
			closeButton.style.display = 'flex';
		}

		// Drag and drop handlers for groups
		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'dragstart', (e: DragEvent) => {
			if (!e.dataTransfer) {
				return;
			}
			this._draggedGroup = group;
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', 'group');
			tab.style.opacity = '0.5';
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'dragend', (e: DragEvent) => {
			this._draggedGroup = undefined;
			tab.style.opacity = '1';
			this._removeDropIndicator();
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'dragover', (e: DragEvent) => {
			if (!this._draggedGroup || this._draggedGroup === group) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}

			// Show drop indicator
			const rect = tab.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			const insertBefore = e.clientX < midpoint;
			this._showDropIndicator(tab, insertBefore);
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'dragleave', (e: DragEvent) => {
			// Only remove if we're actually leaving the tab (not entering a child)
			const relatedTarget = e.relatedTarget as HTMLElement;
			if (!tab.contains(relatedTarget)) {
				this._removeDropIndicator();
			}
		}));

		this._vibeTabsDisposables.add(dom.addDisposableListener(tab, 'drop', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this._removeDropIndicator();

			if (!this._draggedGroup || this._draggedGroup === group) {
				return;
			}

			// Calculate drop position
			const rect = tab.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			const insertBefore = e.clientX < midpoint;

			// Reorder groups (not instances!)
			this._reorderGroups(this._draggedGroup, group, insertBefore);
		}));

		return tab;
	}

	private _showDropIndicator(targetTab: HTMLElement, before: boolean): void {
		this._removeDropIndicator();

		this._dropIndicator = dom.$('.terminal-vibe-drop-indicator');
		this._dropIndicator.style.position = 'absolute';
		this._dropIndicator.style.top = '0';
		this._dropIndicator.style.width = '2px';
		this._dropIndicator.style.height = '100%';
		this._dropIndicator.style.backgroundColor = 'var(--vscode-focusBorder)';
		this._dropIndicator.style.pointerEvents = 'none';
		this._dropIndicator.style.zIndex = '1000';

		if (before) {
			this._dropIndicator.style.left = '0';
		} else {
			this._dropIndicator.style.right = '0';
		}

		targetTab.style.position = 'relative';
		dom.append(targetTab, this._dropIndicator);
	}

	private _removeDropIndicator(): void {
		if (this._dropIndicator) {
			this._dropIndicator.remove();
			this._dropIndicator = undefined;
		}
	}

	private _reorderGroups(draggedGroup: ITerminalGroup, targetGroup: ITerminalGroup, insertBefore: boolean): void {
		const groups = this._terminalGroupService.groups;
		const draggedIndex = groups.indexOf(draggedGroup);
		const targetIndex = groups.indexOf(targetGroup);

		if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
			return;
		}

		// Get any instance from each group to use with moveGroup
		const draggedInstance = draggedGroup.terminalInstances[0];
		const targetInstance = targetGroup.terminalInstances[0];

		if (!draggedInstance || !targetInstance) {
			return;
		}

		// Use moveGroup to reorder groups without creating splits
		// moveGroup handles the positioning automatically
		this._terminalGroupService.moveGroup(draggedInstance, targetInstance);

		// Refresh the tabs
		this._updateVibeSubHeader();
	}

	private _initializeTerminal(checkRestoredTerminals: boolean) {
		if (this.isBodyVisible() && this._terminalService.isProcessSupportRegistered && this._terminalService.connectionState === TerminalConnectionState.Connected) {
			const wasInitialized = this._isInitialized;
			this._isInitialized = true;

			let hideOnStartup: 'never' | 'whenEmpty' | 'always' = 'never';
			if (!wasInitialized) {
				hideOnStartup = this._configurationService.getValue(TerminalSettingId.HideOnStartup);
				if (hideOnStartup === 'always') {
					this._terminalGroupService.hidePanel();
				}
			}

			let shouldCreate = this._terminalGroupService.groups.length === 0;
			// When triggered just after reconnection, also check there are no groups that could be
			// getting restored currently
			if (checkRestoredTerminals) {
				shouldCreate &&= this._terminalService.restoredGroupCount === 0;
			}
			if (!shouldCreate) {
				return;
			}
			if (!wasInitialized) {
				switch (hideOnStartup) {
					case 'never':
						this._isTerminalBeingCreated = true;
						this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
						break;
					case 'whenEmpty':
						if (this._terminalService.restoredGroupCount === 0) {
							this._terminalGroupService.hidePanel();
						}
						break;
				}
				return;
			}

			if (!this._isTerminalBeingCreated) {
				this._isTerminalBeingCreated = true;
				this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		if (!this._parentDomElement) {
			this._updateForShellIntegration(container);
		}
		this._parentDomElement = container;
		this._parentDomElement.classList.add('integrated-terminal');
		domStylesheetsJs.createStyleSheet(this._parentDomElement);
		this._instantiationService.createInstance(TerminalThemeIconStyle, this._parentDomElement);

		if (!this.shouldShowWelcome()) {
			this._createTabsView();
		}

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TerminalSettingId.FontFamily) || e.affectsConfiguration('editor.fontFamily')) {
				if (!this._terminalConfigurationService.configFontIsMonospace()) {
					const choices: IPromptChoice[] = [{
						label: nls.localize('terminal.useMonospace', "Use 'monospace'"),
						run: () => this.configurationService.updateValue(TerminalSettingId.FontFamily, 'monospace'),
					}];
					this._notificationService.prompt(Severity.Warning, nls.localize('terminal.monospaceOnly', "The terminal only supports monospace fonts. Be sure to restart VS Code if this is a newly installed font."), choices);
				}
			}
		}));
		this._register(this.onDidChangeBodyVisibility(async visible => {
			this._viewShowing.set(visible);
			if (visible) {
				if (this._hasWelcomeScreen()) {
					this._onDidChangeViewWelcomeState.fire();
				}
				this._initializeTerminal(false);
				// we don't know here whether or not it should be focused, so
				// defer focusing the panel to the focus() call
				// to prevent overriding preserveFocus for extensions
				this._terminalGroupService.showPanel(false);
			} else {
				for (const instance of this._terminalGroupService.instances) {
					instance.resetFocusContextKey();
				}
			}
			this._terminalGroupService.updateVisibility();
		}));
		this._register(this._terminalService.onDidChangeConnectionState(() => this._initializeTerminal(true)));

		// Initialize vibe sub-header if needed
		this._updateVibeSubHeader();

		this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
	}

	private _createTabsView(): void {
		if (!this._parentDomElement) {
			return;
		}
		this._terminalTabbedView = this._register(this.instantiationService.createInstance(TerminalTabbedView, this._parentDomElement));
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);

		// Calculate available height accounting for sub-header
		let availableHeight = height;
		if (this._vibeContextKey.get() && this._vibeSubHeader && this._vibeSubHeader.style.display !== 'none') {
			const subHeaderHeight = this._vibeSubHeader.offsetHeight || 0;
			availableHeight = Math.max(0, height - subHeaderHeight);
		}

		this._terminalTabbedView?.layout(width, availableHeight);
	}

	override createActionViewItem(action: Action, options: IBaseActionViewItemOptions): IActionViewItem | undefined {
		switch (action.id) {
			case TerminalCommandId.Split: {
				// Split needs to be special cased to force splitting within the panel, not the editor
				const that = this;
				const store = new DisposableStore();
				const panelOnlySplitAction = store.add(new class extends Action {
					constructor() {
						super(action.id, action.label, action.class, action.enabled);
						this.checked = action.checked;
						this.tooltip = action.tooltip;
					}
					override async run() {
						const instance = that._terminalGroupService.activeInstance;
						if (instance) {
							const newInstance = await that._terminalService.createTerminal({ location: { parentTerminal: instance } });
							return newInstance?.focusWhenReady();
						}
						return;
					}
				});
				const item = store.add(new ActionViewItem(action, panelOnlySplitAction, { ...options, icon: true, label: false, keybinding: this._getKeybindingLabel(action) }));
				this._actionDisposables.set(action.id, store);
				return item;
			}
			case TerminalCommandId.SwitchTerminal: {
				const item = this._instantiationService.createInstance(SwitchTerminalActionViewItem, action);
				this._actionDisposables.set(action.id, item);
				return item;
			}
			case TerminalCommandId.Focus: {
				if (action instanceof MenuItemAction) {
					const actions = getFlatContextMenuActions(this._singleTabMenu.getActions({ shouldForwardArgs: true }));
					const item = this._instantiationService.createInstance(SingleTerminalTabActionViewItem, action, actions);
					this._actionDisposables.set(action.id, item);
					return item;
				}
				break;
			}
			case TerminalCommandId.New: {
				if (action instanceof MenuItemAction) {
					const actions = getTerminalActionBarArgs(TerminalLocation.Panel, this._terminalProfileService.availableProfiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
					this._newDropdown.value = new DropdownWithPrimaryActionViewItem(action, actions.dropdownAction, actions.dropdownMenuActions, actions.className, { hoverDelegate: options.hoverDelegate }, this._contextMenuService, this._keybindingService, this._notificationService, this._contextKeyService, this._themeService, this._accessibilityService);
					this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
					return this._newDropdown.value;
				}
			}
		}
		return super.createActionViewItem(action, options);
	}

	private _getDefaultProfileName(): string {
		let defaultProfileName;
		try {
			defaultProfileName = this._terminalProfileService.getDefaultProfileName();
		} catch (e) {
			defaultProfileName = this._terminalProfileResolverService.defaultProfileName;
		}
		return defaultProfileName!;
	}

	private _getKeybindingLabel(action: IAction): string | undefined {
		return this._keybindingService.lookupKeybinding(action.id)?.getLabel() ?? undefined;
	}

	private _updateTabActionBar(profiles: ITerminalProfile[]): void {
		const actions = getTerminalActionBarArgs(TerminalLocation.Panel, profiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
		this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
	}

	override focus() {
		super.focus();
		if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
			if (this._terminalGroupService.instances.length === 0 && !this._isTerminalBeingCreated) {
				this._isTerminalBeingCreated = true;
				this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
			}
			this._terminalGroupService.showPanel(true);
			return;
		}

		// If the terminal is waiting to reconnect to remote terminals, then there is no TerminalInstance yet that can
		// be focused. So wait for connection to finish, then focus.
		const previousActiveElement = this.element.ownerDocument.activeElement;
		if (previousActiveElement) {
			// TODO: Improve lifecycle management this event should be disposed after first fire
			this._register(this._terminalService.onDidChangeConnectionState(() => {
				// Only focus the terminal if the activeElement has not changed since focus() was called
				// TODO: Hack
				if (previousActiveElement && dom.isActiveElement(previousActiveElement)) {
					this._terminalGroupService.showPanel(true);
				}
			}));
		}
	}

	private _hasWelcomeScreen(): boolean {
		return !this._terminalService.isProcessSupportRegistered;
	}

	override shouldShowWelcome(): boolean {
		return this._hasWelcomeScreen() && this._terminalService.instances.length === 0;
	}
}

class SwitchTerminalActionViewItem extends SelectActionViewItem {
	constructor(
		action: IAction,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IContextViewService contextViewService: IContextViewService,
		@ITerminalProfileService terminalProfileService: ITerminalProfileService
	) {
		super(null, action, getTerminalSelectOpenItems(_terminalService, _terminalGroupService), _terminalGroupService.activeGroupIndex, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('terminals', 'Open Terminals.'), optionsAsChildren: true });
		this._register(_terminalService.onDidChangeInstances(() => this._updateItems(), this));
		this._register(_terminalService.onDidChangeActiveGroup(() => this._updateItems(), this));
		this._register(_terminalService.onDidChangeActiveInstance(() => this._updateItems(), this));
		this._register(_terminalService.onAnyInstanceTitleChange(() => this._updateItems(), this));
		this._register(_terminalGroupService.onDidChangeGroups(() => this._updateItems(), this));
		this._register(_terminalService.onDidChangeConnectionState(() => this._updateItems(), this));
		this._register(terminalProfileService.onDidChangeAvailableProfiles(() => this._updateItems(), this));
		this._register(_terminalService.onAnyInstancePrimaryStatusChange(() => this._updateItems(), this));
	}

	override render(container: HTMLElement): void {
		super.render(container);
		container.classList.add('switch-terminal');
		container.style.borderColor = asCssVariable(selectBorder);
	}

	private _updateItems(): void {
		const options = getTerminalSelectOpenItems(this._terminalService, this._terminalGroupService);
		this.setOptions(options, this._terminalGroupService.activeGroupIndex);
	}
}

function getTerminalSelectOpenItems(terminalService: ITerminalService, terminalGroupService: ITerminalGroupService): ISelectOptionItem[] {
	let items: ISelectOptionItem[];
	if (terminalService.connectionState === TerminalConnectionState.Connected) {
		items = terminalGroupService.getGroupLabels().map(label => {
			return { text: label };
		});
	} else {
		items = [{ text: nls.localize('terminalConnectingLabel', "Starting...") }];
	}
	items.push({ text: switchTerminalActionViewItemSeparator, isDisabled: true });
	items.push({ text: switchTerminalShowTabsTitle });
	return items;
}

class SingleTerminalTabActionViewItem extends MenuEntryActionViewItem {
	private _color: string | undefined;
	private _altCommand: string | undefined;
	private _class: string | undefined;
	private readonly _elementDisposables: IDisposable[] = [];

	constructor(
		action: MenuItemAction,
		private readonly _actions: IAction[],
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalConfigurationService private readonly _terminaConfigurationService: ITerminalConfigurationService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@ICommandService private readonly _commandService: ICommandService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IAccessibilityService _accessibilityService: IAccessibilityService
	) {
		super(action, {
			draggable: true,
			hoverDelegate: _instantiationService.createInstance(SingleTabHoverDelegate)
		}, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, _accessibilityService);

		// Register listeners to update the tab
		this._register(Event.debounce<ITerminalInstance | undefined, Set<ITerminalInstance>>(Event.any(
			this._terminalService.onAnyInstancePrimaryStatusChange,
			this._terminalGroupService.onDidChangeActiveInstance,
			Event.map(this._terminalService.onAnyInstanceIconChange, e => e.instance),
			this._terminalService.onAnyInstanceTitleChange,
			this._terminalService.onDidChangeInstanceCapability,
		), (last, e) => {
			if (!last) {
				last = new Set();
			}
			if (e) {
				last.add(e);
			}
			return last;
		}, MicrotaskDelay)(merged => {
			for (const e of merged) {
				this.updateLabel(e);
			}
		}));

		// Clean up on dispose
		this._register(toDisposable(() => dispose(this._elementDisposables)));
	}

	override async onClick(event: MouseEvent): Promise<void> {
		this._terminalGroupService.lastAccessedMenu = 'inline-tab';
		if (event.altKey && this._menuItemAction.alt) {
			this._commandService.executeCommand(this._menuItemAction.alt.id, { location: TerminalLocation.Panel } satisfies ICreateTerminalOptions);
		} else {
			this._openContextMenu();
		}
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected override updateLabel(e?: ITerminalInstance): void {
		// Only update if it's the active instance
		if (e && e !== this._terminalGroupService.activeInstance) {
			return;
		}

		if (this._elementDisposables.length === 0 && this.element && this.label) {
			// Right click opens context menu
			this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.CONTEXT_MENU, e => {
				if (e.button === 2) {
					this._openContextMenu();
					e.preventDefault();
				}
			}));
			// Middle click kills
			this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.AUXCLICK, e => {
				if (e.button === 1) {
					const instance = this._terminalGroupService.activeInstance;
					if (instance) {
						this._terminalService.safeDisposeTerminal(instance);
					}
					e.preventDefault();
				}
			}));
			// Drag and drop
			this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.DRAG_START, e => {
				const instance = this._terminalGroupService.activeInstance;
				if (e.dataTransfer && instance) {
					e.dataTransfer.setData(TerminalDataTransfers.Terminals, JSON.stringify([instance.resource.toString()]));
				}
			}));
		}
		if (this.label) {
			const label = this.label;
			const instance = this._terminalGroupService.activeInstance;
			if (!instance) {
				dom.reset(label, '');
				return;
			}
			label.classList.add('single-terminal-tab');
			let colorStyle = '';
			const primaryStatus = instance.statusList.primary;
			if (primaryStatus) {
				const colorKey = getColorForSeverity(primaryStatus.severity);
				this._themeService.getColorTheme();
				const foundColor = this._themeService.getColorTheme().getColor(colorKey);
				if (foundColor) {
					colorStyle = foundColor.toString();
				}
			}
			label.style.color = colorStyle;
			dom.reset(label, ...renderLabelWithIcons(this._instantiationService.invokeFunction(getSingleTabLabel, instance, this._terminaConfigurationService.config.tabs.separator, ThemeIcon.isThemeIcon(this._commandAction.item.icon) ? this._commandAction.item.icon : undefined)));

			if (this._altCommand) {
				label.classList.remove(this._altCommand);
				this._altCommand = undefined;
			}
			if (this._color) {
				label.classList.remove(this._color);
				this._color = undefined;
			}
			if (this._class) {
				label.classList.remove(this._class);
				label.classList.remove('terminal-uri-icon');
				this._class = undefined;
			}
			const colorClass = getColorClass(instance);
			if (colorClass) {
				this._color = colorClass;
				label.classList.add(colorClass);
			}
			const uriClasses = getUriClasses(instance, this._themeService.getColorTheme().type);
			if (uriClasses) {
				this._class = uriClasses?.[0];
				label.classList.add(...uriClasses);
			}
			if (this._commandAction.item.icon) {
				this._altCommand = `alt-command`;
				label.classList.add(this._altCommand);
			}
			this.updateTooltip();
		}
	}

	private _openContextMenu() {
		const actionRunner = new TerminalContextActionRunner();
		this._contextMenuService.showContextMenu({
			actionRunner,
			getAnchor: () => this.element!,
			getActions: () => this._actions,
			// The context is always the active instance in the terminal view
			getActionsContext: () => {
				const instance = this._terminalGroupService.activeInstance;
				return instance ? [new InstanceContext(instance)] : [];
			},
			onHide: () => actionRunner.dispose()
		});
	}
}

function getSingleTabLabel(accessor: ServicesAccessor, instance: ITerminalInstance | undefined, separator: string, icon?: ThemeIcon) {
	// Don't even show the icon if there is no title as the icon would shift around when the title
	// is added
	if (!instance || !instance.title) {
		return '';
	}
	const iconId = ThemeIcon.isThemeIcon(instance.icon) ? instance.icon.id : accessor.get(ITerminalProfileResolverService).getDefaultIcon().id;
	const label = `$(${icon?.id || iconId}) ${getSingleTabTitle(instance, separator)}`;

	const primaryStatus = instance.statusList.primary;
	if (!primaryStatus?.icon) {
		return label;
	}
	return `${label} $(${primaryStatus.icon.id})`;
}

function getSingleTabTitle(instance: ITerminalInstance | undefined, separator: string): string {
	if (!instance) {
		return '';
	}
	return !instance.description ? instance.title : `${instance.title} ${separator} ${instance.description}`;
}

class TerminalThemeIconStyle extends Themable {
	private _styleElement: HTMLElement;
	constructor(
		container: HTMLElement,
		@IThemeService private readonly _themeService: IThemeService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService
	) {
		super(_themeService);
		this._registerListeners();
		this._styleElement = domStylesheetsJs.createStyleSheet(container);
		this._register(toDisposable(() => this._styleElement.remove()));
		this.updateStyles();
	}

	private _registerListeners(): void {
		this._register(this._terminalService.onAnyInstanceIconChange(() => this.updateStyles()));
		this._register(this._terminalService.onDidChangeInstances(() => this.updateStyles()));
		this._register(this._terminalGroupService.onDidChangeGroups(() => this.updateStyles()));
	}

	override updateStyles(): void {
		super.updateStyles();
		const colorTheme = this._themeService.getColorTheme();

		// TODO: add a rule collector to avoid duplication
		let css = '';

		// Add icons
		for (const instance of this._terminalService.instances) {
			const icon = instance.icon;
			if (!icon) {
				continue;
			}
			let uri = undefined;
			if (icon instanceof URI) {
				uri = icon;
			} else if (icon instanceof Object && 'light' in icon && 'dark' in icon) {
				uri = colorTheme.type === ColorScheme.LIGHT ? icon.light : icon.dark;
			}
			const iconClasses = getUriClasses(instance, colorTheme.type);
			if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
				css += (
					`.monaco-workbench .${iconClasses[0]} .monaco-highlighted-label .codicon, .monaco-action-bar .terminal-uri-icon.single-terminal-tab.action-label:not(.alt-command) .codicon` +
					`{background-image: ${cssJs.asCSSUrl(uri)};}`
				);
			}
		}

		// Add colors
		for (const instance of this._terminalService.instances) {
			const colorClass = getColorClass(instance);
			if (!colorClass || !instance.color) {
				continue;
			}
			const color = colorTheme.getColor(instance.color);
			if (color) {
				// exclude status icons (file-icon) and inline action icons (trashcan, horizontalSplit, rerunTask)
				css += (
					`.monaco-workbench .${colorClass} .codicon:first-child:not(.codicon-split-horizontal):not(.codicon-trashcan):not(.file-icon):not(.codicon-rerun-task)` +
					`{ color: ${color} !important; }`
				);
			}
		}

		this._styleElement.textContent = css;
	}
}

class SingleTabHoverDelegate implements IHoverDelegate {
	private _lastHoverHideTime: number = 0;

	readonly placement = 'element';

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IHoverService private readonly _hoverService: IHoverService,
		@IStorageService private readonly _storageService: IStorageService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
	) {
	}

	get delay(): number {
		return Date.now() - this._lastHoverHideTime < 200
			? 0  // show instantly when a hover was recently shown
			: this._configurationService.getValue<number>('workbench.hover.delay');
	}

	showHover(options: IHoverDelegateOptions, focus?: boolean) {
		const instance = this._terminalGroupService.activeInstance;
		if (!instance) {
			return;
		}
		const hoverInfo = getInstanceHoverInfo(instance, this._storageService);
		return this._hoverService.showInstantHover({
			...options,
			content: hoverInfo.content,
			actions: hoverInfo.actions
		}, focus);
	}

	onDidHideHover() {
		this._lastHoverHideTime = Date.now();
	}
}
