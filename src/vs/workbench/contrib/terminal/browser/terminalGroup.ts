/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TERMINAL_VIEW_ID } from '../common/terminal.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { IDisposable, Disposable, DisposableStore, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { Direction as GridDirection, Grid, IView as IGridView, Orientation, Sizing as GridSizing } from '../../../../base/browser/ui/grid/grid.js';
import { isHorizontal, IWorkbenchLayoutService, Position } from '../../../services/layout/browser/layoutService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITerminalInstance, Direction, ITerminalGroup, ITerminalInstanceService, ITerminalConfigurationService, ITerminalService } from './terminal.js';
import { ViewContainerLocation, IViewDescriptorService } from '../../../common/views.js';
import { IShellLaunchConfig, ITerminalTabLayoutInfoById, TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { TerminalStatus } from './terminalStatusList.js';
import { addDisposableListener, EventType, getWindow } from '../../../../base/browser/dom.js';
import { getPartByLocation } from '../../../services/views/browser/viewsService.js';
import { asArray } from '../../../../base/common/arrays.js';
import { localize } from '../../../../nls.js';

const enum Constants {
	/**
	 * The minimum size in pixels of a split pane.
	 */
	SplitPaneMinSize = 80,
	/**
	 * The number of cells the terminal gets added or removed when asked to increase or decrease
	 * the view size.
	 */
	ResizePartCellCount = 4
}

class SplitPaneContainer extends Disposable {
	private _height: number;
	private _width: number;
	private _grid: Grid<SplitPane> | undefined;
	private readonly _gridDisposables = this._register(new DisposableStore());
	private _children: SplitPane[] = [];
	private _terminalToPane: Map<ITerminalInstance, SplitPane> = new Map();

	constructor(
		private _container: HTMLElement,
		public orientation: Orientation,
		@ITerminalService private readonly _terminalService: ITerminalService,
	) {
		super();
		this._width = this._container.offsetWidth;
		this._height = this._container.offsetHeight;
	}

	private _createGrid(initialPane: SplitPane): void {
		this._gridDisposables.clear();
		this._grid = new Grid(initialPane);
		this._grid.orientation = this.orientation;
		this._container.appendChild(this._grid.element);
		this._gridDisposables.add(this._grid);
		this._grid.layout(this._width, this._height);
	}

	split(instance: ITerminalInstance, index: number, referenceInstance?: ITerminalInstance, orientation: Orientation = this.orientation, placeBefore: boolean = false): void {
		this._addChild(instance, index, referenceInstance, orientation, placeBefore);
	}

	resizePane(instance: ITerminalInstance, direction: Direction, amount: number): boolean {
		const pane = this._terminalToPane.get(instance);
		if (!pane || !this._grid || this._children.length <= 1) {
			return false;
		}

		const gridDirection = this._toGridDirection(direction);
		const neighbors = this._grid.getNeighborViews(pane, gridDirection);
		const oppositeNeighbors = this._grid.getNeighborViews(pane, this._oppositeGridDirection(gridDirection));
		if (neighbors.length === 0 && oppositeNeighbors.length === 0) {
			return false;
		}

		const size = this._grid.getViewSize(pane);
		const delta = neighbors.length > 0 ? amount : -amount;
		if (direction === Direction.Left || direction === Direction.Right) {
			this._grid.resizeView(pane, { width: Math.max(Constants.SplitPaneMinSize, size.width + delta), height: size.height });
		} else {
			this._grid.resizeView(pane, { width: size.width, height: Math.max(Constants.SplitPaneMinSize, size.height + delta) });
		}
		return true;
	}

	resizePanes(relativeSizes: number[]): void {
		if (!this._grid || this._children.length <= 1 || relativeSizes.length !== this._children.length) {
			return;
		}

		// Assign any extra size to the last terminal.
		relativeSizes[relativeSizes.length - 1] += 1 - relativeSizes.reduce((totalValue, currentValue) => totalValue + currentValue, 0);
		let totalSize = 0;
		for (const pane of this._children) {
			totalSize += this._getPanePrimarySize(pane);
		}
		for (let i = 0; i < this._children.length; i++) {
			const pane = this._children[i];
			const size = this._grid.getViewSize(pane);
			const newPrimarySize = totalSize * relativeSizes[i];
			if (this.orientation === Orientation.HORIZONTAL) {
				this._grid.resizeView(pane, { width: newPrimarySize, height: size.height });
			} else {
				this._grid.resizeView(pane, { width: size.width, height: newPrimarySize });
			}
		}
	}

	getPaneSize(instance: ITerminalInstance): number {
		const paneForInstance = this._terminalToPane.get(instance);
		if (!paneForInstance || !this._grid) {
			return 0;
		}

		return this._getPanePrimarySize(paneForInstance);
	}

	private _getPanePrimarySize(pane: SplitPane): number {
		const size = this._grid!.getViewSize(pane);
		return this.orientation === Orientation.HORIZONTAL ? size.width : size.height;
	}

	private _addChild(instance: ITerminalInstance, index: number, referenceInstance: ITerminalInstance | undefined, orientation: Orientation, placeBefore: boolean): void {
		const child = new SplitPane(instance, () => this._terminalService.safeDisposeTerminal(instance));
		if (typeof index === 'number') {
			this._children.splice(index, 0, child);
		} else {
			this._children.push(child);
		}
		this._terminalToPane.set(instance, child);

		if (!this._grid) {
			this.orientation = orientation;
			this._createGrid(child);
		} else {
			const referencePane = referenceInstance ? this._terminalToPane.get(referenceInstance) : undefined;
			const fallbackPane = this._children[index - 1] ?? this._children[index + 1] ?? this._children.find(pane => pane !== child)!;
			const targetPane = referencePane ?? fallbackPane;
			this._withDisabledLayout(() => {
				this._grid!.addView(
					child,
					GridSizing.Split,
					targetPane,
					orientation === Orientation.HORIZONTAL
						? (placeBefore ? GridDirection.Left : GridDirection.Right)
						: (placeBefore ? GridDirection.Up : GridDirection.Down)
				);
			});
		}
		this.relayoutChildren();
		// Grid needs one frame to settle sizes after a structural split.
		getWindow(this._container).requestAnimationFrame(() => this.relayoutChildren());
	}

	remove(instance: ITerminalInstance): void {
		const pane = this._terminalToPane.get(instance);
		if (!pane) {
			return;
		}

		const index = this._children.indexOf(pane);
		if (this._grid && this._children.length > 1) {
			this._grid.removeView(pane, GridSizing.Distribute);
		} else {
			this._grid?.element.remove();
			this._gridDisposables.clear();
			this._grid = undefined;
		}
		this._children.splice(index, 1);
		this._terminalToPane.delete(instance);
		pane.dispose();
		this.relayoutChildren();
	}

	override dispose(): void {
		for (const child of this._children) {
			child.dispose();
		}
		this._children = [];
		this._terminalToPane.clear();
		super.dispose();
	}

	relayoutChildren(): void {
		if (!this._grid) {
			return;
		}
		this._grid.layout(this._width, this._height);
		for (const child of this._children) {
			const size = this._grid.getViewSize(child);
			child.layout(size.width, size.height);
		}
	}

	layout(width: number, height: number): void {
		this._width = width;
		this._height = height;
		this.relayoutChildren();
	}

	setOrientation(orientation: Orientation): void {
		if (this.orientation === orientation) {
			return;
		}
		this.orientation = orientation;
		if (this._grid) {
			this._grid.orientation = orientation;
		}
		this.layout(this._width, this._height);
	}

	private _toGridDirection(direction: Direction): GridDirection {
		switch (direction) {
			case Direction.Left: return GridDirection.Left;
			case Direction.Right: return GridDirection.Right;
			case Direction.Up: return GridDirection.Up;
			case Direction.Down: return GridDirection.Down;
		}
	}

	private _oppositeGridDirection(direction: GridDirection): GridDirection {
		switch (direction) {
			case GridDirection.Left: return GridDirection.Right;
			case GridDirection.Right: return GridDirection.Left;
			case GridDirection.Up: return GridDirection.Down;
			case GridDirection.Down: return GridDirection.Up;
		}
	}

	private _withDisabledLayout(innerFunction: () => void): void {
		// Whenever manipulating views that are going to be changed immediately, disabling
		// layout/resize events in the terminal prevent bad dimensions going to the pty.
		this._children.forEach(c => c.instance.disableLayout = true);
		try {
			innerFunction();
		} finally {
			this._children.forEach(c => c.instance.disableLayout = false);
		}
	}
}

class SplitPane extends Disposable implements IGridView {
	readonly minimumWidth: number = Constants.SplitPaneMinSize;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = Constants.SplitPaneMinSize;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	readonly onDidChange = Event.None;

	readonly element: HTMLElement;
	private readonly _bodyElement: HTMLElement;

	constructor(readonly instance: ITerminalInstance, onDidRequestClose: () => Promise<void>) {
		super();
		this.element = document.createElement('div');
		this.element.className = 'terminal-split-pane';

		const chrome = document.createElement('div');
		chrome.className = 'terminal-vibe-pane-chrome';

		const closeWrap = document.createElement('div');
		closeWrap.className = 'terminal-vibe-pane-close-wrap';

		const closeButton = document.createElement('button');
		closeButton.className = 'terminal-vibe-pane-close codicon codicon-close';
		closeButton.type = 'button';
		closeButton.title = localize('terminalVibeClosePane', 'Close Terminal Pane');
		closeButton.setAttribute('aria-label', closeButton.title);
		closeWrap.appendChild(closeButton);
		chrome.appendChild(closeWrap);
		this._register(addDisposableListener(closeButton, EventType.CLICK, event => {
			event.preventDefault();
			event.stopPropagation();
			void onDidRequestClose();
		}));

		this._bodyElement = document.createElement('div');
		this._bodyElement.className = 'terminal-vibe-pane-body';

		// Body first, chrome last — chrome must paint above the xterm canvas
		this.element.appendChild(this._bodyElement);
		this.element.appendChild(chrome);
		this.instance.attachToElement(this._bodyElement);
	}

	layout(width: number, height: number): void {
		if (!width || !height) {
			return;
		}
		this.instance.layout({ width, height });
	}

	override dispose(): void {
		this.instance.detachFromElement();
		super.dispose();
	}
}

export class TerminalGroup extends Disposable implements ITerminalGroup {
	private _terminalInstances: ITerminalInstance[] = [];
	private _splitPaneContainer: SplitPaneContainer | undefined;
	private _groupElement: HTMLElement | undefined;
	private _panelPosition: Position = Position.BOTTOM;
	private _terminalLocation: ViewContainerLocation = ViewContainerLocation.Panel;
	private _instanceDisposables: Map<number, IDisposable[]> = new Map();
	private _vibeMode: boolean = false;
	private _vibeOrientationOverride: Orientation | undefined;

	private _activeInstanceIndex: number = -1;

	get terminalInstances(): ITerminalInstance[] { return this._terminalInstances; }

	private _initialRelativeSizes: number[] | undefined;
	private _visible: boolean = false;

	private readonly _onDidDisposeInstance: Emitter<ITerminalInstance> = this._register(new Emitter<ITerminalInstance>());
	readonly onDidDisposeInstance = this._onDidDisposeInstance.event;
	private readonly _onDidFocusInstance: Emitter<ITerminalInstance> = this._register(new Emitter<ITerminalInstance>());
	readonly onDidFocusInstance = this._onDidFocusInstance.event;
	private readonly _onDidChangeInstanceCapability: Emitter<ITerminalInstance> = this._register(new Emitter<ITerminalInstance>());
	readonly onDidChangeInstanceCapability = this._onDidChangeInstanceCapability.event;
	private readonly _onDisposed: Emitter<ITerminalGroup> = this._register(new Emitter<ITerminalGroup>());
	readonly onDisposed = this._onDisposed.event;
	private readonly _onInstancesChanged: Emitter<void> = this._register(new Emitter<void>());
	readonly onInstancesChanged = this._onInstancesChanged.event;
	private readonly _onDidChangeActiveInstance = this._register(new Emitter<ITerminalInstance | undefined>());
	readonly onDidChangeActiveInstance = this._onDidChangeActiveInstance.event;
	private readonly _onPanelOrientationChanged = this._register(new Emitter<Orientation>());
	readonly onPanelOrientationChanged = this._onPanelOrientationChanged.event;

	constructor(
		private _container: HTMLElement | undefined,
		shellLaunchConfigOrInstance: IShellLaunchConfig | ITerminalInstance | undefined,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@ITerminalInstanceService private readonly _terminalInstanceService: ITerminalInstanceService,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
		@IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();
		if (shellLaunchConfigOrInstance) {
			this.addInstance(shellLaunchConfigOrInstance);
		}
		if (this._container) {
			this.attachToElement(this._container);
		}
		this._onPanelOrientationChanged.fire(this._terminalLocation === ViewContainerLocation.Panel && isHorizontal(this._panelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL);
		this._register(toDisposable(() => {
			if (this._container && this._groupElement) {
				this._groupElement.remove();
				this._groupElement = undefined;
			}
		}));
	}

	addInstance(shellLaunchConfigOrInstance: IShellLaunchConfig | ITerminalInstance, parentTerminalId?: number): void {
		let instance: ITerminalInstance;
		// if a parent terminal is provided, find it
		// otherwise, parent is the active terminal
		const parentIndex = parentTerminalId ? this._terminalInstances.findIndex(t => t.instanceId === parentTerminalId) : this._activeInstanceIndex;
		const parentInstance = this._terminalInstances[parentIndex];
		if ('instanceId' in shellLaunchConfigOrInstance) {
			instance = shellLaunchConfigOrInstance;
		} else {
			instance = this._terminalInstanceService.createInstance(shellLaunchConfigOrInstance, TerminalLocation.Panel);
		}
		if (this._terminalInstances.length === 0) {
			this._terminalInstances.push(instance);
			this._activeInstanceIndex = 0;
		} else {
			this._terminalInstances.splice(parentIndex + 1, 0, instance);
		}
		this._initInstanceListeners(instance);

		if (this._vibeMode) {
			instance.xterm?.applyVibeModeLayout(true);
		}

		if (this._splitPaneContainer) {
			this._splitPaneContainer.split(instance, parentIndex + 1, parentInstance, this._getOrientation());
		}

		this._onInstancesChanged.fire();
		this._updatePaneChromeState();
	}

	override dispose(): void {
		this._terminalInstances = [];
		this._onInstancesChanged.fire();
		this._splitPaneContainer?.dispose();
		super.dispose();
	}

	get activeInstance(): ITerminalInstance | undefined {
		if (this._terminalInstances.length === 0) {
			return undefined;
		}
		return this._terminalInstances[this._activeInstanceIndex];
	}

	getLayoutInfo(isActive: boolean): ITerminalTabLayoutInfoById {
		const instances = this.terminalInstances.filter(instance => typeof instance.persistentProcessId === 'number' && instance.shouldPersist);
		const totalSize = instances.map(t => this._splitPaneContainer?.getPaneSize(t) || 0).reduce((total, size) => total += size, 0);
		return {
			isActive: isActive,
			activePersistentProcessId: this.activeInstance ? this.activeInstance.persistentProcessId : undefined,
			terminals: instances.map(t => {
				return {
					relativeSize: totalSize > 0 ? this._splitPaneContainer!.getPaneSize(t) / totalSize : 0,
					terminal: t.persistentProcessId || 0
				};
			})
		};
	}

	private _initInstanceListeners(instance: ITerminalInstance) {
		this._instanceDisposables.set(instance.instanceId, [
			instance.onDisposed(instance => {
				this._onDidDisposeInstance.fire(instance);
				this._handleOnDidDisposeInstance(instance);
			}),
			instance.onDidFocus(instance => {
				this._setActiveInstance(instance);
				this._onDidFocusInstance.fire(instance);
			}),
			instance.capabilities.onDidAddCapabilityType(() => this._onDidChangeInstanceCapability.fire(instance)),
			instance.capabilities.onDidRemoveCapabilityType(() => this._onDidChangeInstanceCapability.fire(instance)),
		]);
	}

	private _handleOnDidDisposeInstance(instance: ITerminalInstance) {
		this._removeInstance(instance);
	}

	removeInstance(instance: ITerminalInstance) {
		this._removeInstance(instance);
	}

	private _removeInstance(instance: ITerminalInstance) {
		const index = this._terminalInstances.indexOf(instance);
		if (index === -1) {
			return;
		}

		const wasActiveInstance = instance === this.activeInstance;
		this._terminalInstances.splice(index, 1);

		// Adjust focus if the instance was active
		if (wasActiveInstance && this._terminalInstances.length > 0) {
			const newIndex = index < this._terminalInstances.length ? index : this._terminalInstances.length - 1;
			this.setActiveInstanceByIndex(newIndex);
			// TODO: Only focus the new instance if the group had focus?
			this.activeInstance?.focus(true);
		} else if (index < this._activeInstanceIndex) {
			// Adjust active instance index if needed
			this._activeInstanceIndex--;
		}

		this._splitPaneContainer?.remove(instance);

		// Fire events and dispose group if it was the last instance
		if (this._terminalInstances.length === 0) {
			this._onDisposed.fire(this);
			this.dispose();
		} else {
			this._onInstancesChanged.fire();
		}

		this._updatePaneChromeState();

		// Dispose instance event listeners
		const disposables = this._instanceDisposables.get(instance.instanceId);
		if (disposables) {
			dispose(disposables);
			this._instanceDisposables.delete(instance.instanceId);
		}
	}

	moveInstance(instances: ITerminalInstance | ITerminalInstance[], index: number, position: 'before' | 'after'): void {
		instances = asArray(instances);
		const hasInvalidInstance = instances.some(instance => !this.terminalInstances.includes(instance));
		if (hasInvalidInstance) {
			return;
		}
		const insertIndex = position === 'before' ? index : index + 1;
		this._terminalInstances.splice(insertIndex, 0, ...instances);
		for (const item of instances) {
			const originSourceGroupIndex = position === 'after' ? this._terminalInstances.indexOf(item) : this._terminalInstances.lastIndexOf(item);
			this._terminalInstances.splice(originSourceGroupIndex, 1);
		}
		if (this._splitPaneContainer) {
			for (let i = 0; i < instances.length; i++) {
				const item = instances[i];
				this._splitPaneContainer.remove(item);
				const itemIndex = this._terminalInstances.indexOf(item);
				const placeBefore = itemIndex === 0;
				const referenceInstance = placeBefore ? this._terminalInstances[1] : this._terminalInstances[itemIndex - 1];
				this._splitPaneContainer.split(item, itemIndex, referenceInstance, this._getOrientation(), placeBefore);
			}
			this._splitPaneContainer.relayoutChildren();
		}
		this._onInstancesChanged.fire();
	}

	private _setActiveInstance(instance: ITerminalInstance) {
		this.setActiveInstanceByIndex(this._getIndexFromId(instance.instanceId));
	}

	private _getIndexFromId(terminalId: number): number {
		let terminalIndex = -1;
		this.terminalInstances.forEach((terminalInstance, i) => {
			if (terminalInstance.instanceId === terminalId) {
				terminalIndex = i;
			}
		});
		if (terminalIndex === -1) {
			throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
		}
		return terminalIndex;
	}

	setActiveInstanceByIndex(index: number, force?: boolean): void {
		// Check for invalid value
		if (index < 0 || index >= this._terminalInstances.length) {
			return;
		}

		const oldActiveInstance = this.activeInstance;
		this._activeInstanceIndex = index;
		if (oldActiveInstance !== this.activeInstance || force) {
			this._onInstancesChanged.fire();
			this._onDidChangeActiveInstance.fire(this.activeInstance);
		}
	}

	attachToElement(element: HTMLElement): void {
		this._container = element;

		// If we already have a group element, we can reparent it
		if (!this._groupElement) {
			this._groupElement = document.createElement('div');
			this._groupElement.classList.add('terminal-group');
			// Ensure proper layout in vibe mode
			this._groupElement.style.width = '100%';
			this._groupElement.style.height = '100%';
			this._groupElement.style.overflow = 'hidden';
			this._groupElement.style.position = 'relative';
		}
		this._groupElement.classList.toggle('vibe-mode', this._vibeMode);

		this._container.appendChild(this._groupElement);
		if (!this._splitPaneContainer) {
			this._panelPosition = this._layoutService.getPanelPosition();
			this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;

			// Use vibe mode orientation override if set, otherwise use panel-based orientation
			const orientation = this._vibeOrientationOverride !== undefined
				? this._vibeOrientationOverride
				: (this._terminalLocation === ViewContainerLocation.Panel && isHorizontal(this._panelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL);

			this._splitPaneContainer = this._instantiationService.createInstance(SplitPaneContainer, this._groupElement, orientation);
			this.terminalInstances.forEach((instance, index) => {
				const parentId = instance.shellLaunchConfig.parentTerminalId;
				const parentInstance = parentId !== undefined
					? this.terminalInstances.find(t => t.instanceId === parentId)
					: (index > 0 ? this.terminalInstances[index - 1] : undefined);
				this._splitPaneContainer!.split(instance, index, parentInstance, orientation);
			});
		}
		this._updatePaneChromeState();
	}

	get title(): string {
		if (this._terminalInstances.length === 0) {
			// Normally consumers should not call into title at all after the group is disposed but
			// this is required when the group is used as part of a tree.
			return '';
		}
		let title = this.terminalInstances[0].title + this._getBellTitle(this.terminalInstances[0]);
		if (this.terminalInstances[0].description) {
			title += ` (${this.terminalInstances[0].description})`;
		}
		for (let i = 1; i < this.terminalInstances.length; i++) {
			const instance = this.terminalInstances[i];
			if (instance.title) {
				title += `, ${instance.title + this._getBellTitle(instance)}`;
				if (instance.description) {
					title += ` (${instance.description})`;
				}
			}
		}
		return title;
	}

	private _getBellTitle(instance: ITerminalInstance) {
		if (this._terminalConfigurationService.config.enableBell && instance.statusList.statuses.some(e => e.id === TerminalStatus.Bell)) {
			return '*';
		}
		return '';
	}

	setVisible(visible: boolean): void {
		this._visible = visible;
		if (this._groupElement) {
			this._groupElement.style.display = visible ? '' : 'none';
		}
		this.terminalInstances.forEach(i => i.setVisible(visible));
	}

	split(shellLaunchConfig: IShellLaunchConfig): ITerminalInstance {
		const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Panel);
		this.addInstance(instance, shellLaunchConfig.parentTerminalId);
		this._setActiveInstance(instance);
		return instance;
	}

	addDisposable(disposable: IDisposable): void {
		this._register(disposable);
	}

	layout(width: number, height: number): void {
		if (this._splitPaneContainer) {
			// Check if the panel position changed and rotate panes if so
			const newPanelPosition = this._layoutService.getPanelPosition();
			const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
			const terminalPositionChanged = newPanelPosition !== this._panelPosition || newTerminalLocation !== this._terminalLocation;
			if (terminalPositionChanged && !this._vibeMode) {
				// Only auto-adjust orientation based on panel position if NOT in vibe mode
				const newOrientation = newTerminalLocation === ViewContainerLocation.Panel && isHorizontal(newPanelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
				this._splitPaneContainer.setOrientation(newOrientation);
				this._panelPosition = newPanelPosition;
				this._terminalLocation = newTerminalLocation;
				this._onPanelOrientationChanged.fire(this._splitPaneContainer.orientation);
			} else if (terminalPositionChanged) {
				// In vibe mode, just update position tracking without changing orientation
				this._panelPosition = newPanelPosition;
				this._terminalLocation = newTerminalLocation;
			}
			this._splitPaneContainer.layout(width, height);
			if (this._initialRelativeSizes && this._visible) {
				this.resizePanes(this._initialRelativeSizes);
				this._initialRelativeSizes = undefined;
			}
		}
	}

	focusPreviousPane(): void {
		const newIndex = this._activeInstanceIndex === 0 ? this._terminalInstances.length - 1 : this._activeInstanceIndex - 1;
		this.setActiveInstanceByIndex(newIndex);
	}

	focusNextPane(): void {
		const newIndex = this._activeInstanceIndex === this._terminalInstances.length - 1 ? 0 : this._activeInstanceIndex + 1;
		this.setActiveInstanceByIndex(newIndex);
	}

	private _getPosition(): Position {
		switch (this._terminalLocation) {
			case ViewContainerLocation.Panel:
				return this._panelPosition;
			case ViewContainerLocation.Sidebar:
				return this._layoutService.getSideBarPosition();
			case ViewContainerLocation.AuxiliaryBar:
				return this._layoutService.getSideBarPosition() === Position.LEFT ? Position.RIGHT : Position.LEFT;
		}
	}

	private _getOrientation(): Orientation {
		// In vibe mode with override, use the override orientation
		if (this._vibeMode && this._vibeOrientationOverride !== undefined) {
			return this._vibeOrientationOverride;
		}
		return isHorizontal(this._getPosition()) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
	}

	/**
	 * Enable or disable vibe mode and optionally set a specific orientation.
	 * When enabled with an orientation, splits will always use that orientation regardless of panel position.
	 * If vibe mode is already enabled and no orientation is specified, the current orientation is preserved.
	 */
	setVibeMode(enabled: boolean, orientation?: Orientation): void {
		let newOverride: Orientation | undefined;

		if (enabled) {
			if (orientation !== undefined) {
				// Explicit orientation provided - use it
				newOverride = orientation;
			} else if (this._vibeMode && this._vibeOrientationOverride !== undefined) {
				// Vibe mode already enabled and no new orientation specified - preserve current
				newOverride = this._vibeOrientationOverride;
			} else {
				// First time enabling vibe mode without orientation - use default HORIZONTAL
				newOverride = Orientation.HORIZONTAL;
			}
		} else {
			// Disabling vibe mode
			newOverride = undefined;
		}

		// Skip if state hasn't changed
		if (this._vibeMode === enabled && this._vibeOrientationOverride === newOverride) {
			return;
		}

		this._vibeMode = enabled;
		this._vibeOrientationOverride = newOverride;
		this._groupElement?.classList.toggle('vibe-mode', enabled);
		this._applyVibeModeToInstances(enabled);
		this._updatePaneChromeState();

		// In vibe mode the orientation applies only to the next split. Existing branches
		// must retain their own orientation so mixed nested layouts remain stable.
		this._onPanelOrientationChanged.fire(this._vibeOrientationOverride ?? this._getOrientation());
	}

	resizePane(direction: Direction): void {
		if (!this._splitPaneContainer) {
			return;
		}

		const isHorizontalResize = direction === Direction.Left || direction === Direction.Right;

		const font = this._terminalConfigurationService.getFont(getWindow(this._groupElement));
		// TODO: Support letter spacing and line height
		const charSize = (isHorizontalResize ? font.charWidth : font.charHeight);

		if (charSize) {
			let resizeAmount = charSize * Constants.ResizePartCellCount;

			if (this.activeInstance && this._splitPaneContainer.resizePane(this.activeInstance, direction, resizeAmount)) {
				return;
			}

			const position = this._getPosition();
			const shouldShrink =
				(position === Position.LEFT && direction === Direction.Left) ||
				(position === Position.RIGHT && direction === Direction.Right) ||
				(position === Position.BOTTOM && direction === Direction.Down) ||
				(position === Position.TOP && direction === Direction.Up);

			if (shouldShrink) {
				resizeAmount *= -1;
			}

			this._layoutService.resizePart(getPartByLocation(this._terminalLocation), resizeAmount, resizeAmount);
		}
	}

	resizePanes(relativeSizes: number[]): void {
		if (!this._splitPaneContainer) {
			this._initialRelativeSizes = relativeSizes;
			return;
		}

		this._splitPaneContainer.resizePanes(relativeSizes);
	}

	private _applyVibeModeToInstances(enabled: boolean): void {
		for (const instance of this._terminalInstances) {
			instance.xterm?.applyVibeModeLayout(enabled);
		}
	}

	private _updatePaneChromeState(): void {
		if (!this._groupElement) {
			return;
		}
		const hasSplits = this._terminalInstances.length > 1;
		this._groupElement.classList.toggle('has-splits', hasSplits);
		for (const pane of this._groupElement.querySelectorAll('.terminal-split-pane')) {
			pane.classList.toggle('has-sibling-panes', hasSplits);
		}
	}
}
