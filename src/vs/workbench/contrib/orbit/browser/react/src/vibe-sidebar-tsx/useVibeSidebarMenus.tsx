/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from 'react';
import { IMenu, MenuId } from '../../../../../../../platform/actions/common/actions.js';
import { ITerminalGroup, ITerminalInstance } from '../../../../../terminal/browser/terminal.js';
import { useAccessor } from '../util/services.js';
import { flattenMenuActions } from './vibeSidebarUtils.js';

export const useVibeSidebarMenus = () => {
	const accessor = useAccessor();
	const tabMenuRef = useRef<IMenu | null>(null);
	const instanceMenuRef = useRef<IMenu | null>(null);
	const emptyMenuRef = useRef<IMenu | null>(null);
	const newTerminalMenuRef = useRef<IMenu | null>(null);

	useEffect(() => {
		const menuService = accessor.get('IMenuService');
		const contextKeyService = accessor.get('IContextKeyService');
		const tabMenu = menuService.createMenu(MenuId.TerminalTabContext, contextKeyService);
		const instanceMenu = menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService);
		const emptyMenu = menuService.createMenu(MenuId.TerminalTabEmptyAreaContext, contextKeyService);
		const newTerminalMenu = menuService.createMenu(MenuId.TerminalNewDropdownContext, contextKeyService);
		tabMenuRef.current = tabMenu;
		instanceMenuRef.current = instanceMenu;
		emptyMenuRef.current = emptyMenu;
		newTerminalMenuRef.current = newTerminalMenu;
		return () => {
			tabMenu.dispose();
			instanceMenu.dispose();
			emptyMenu.dispose();
			newTerminalMenu.dispose();
			tabMenuRef.current = null;
			instanceMenuRef.current = null;
			emptyMenuRef.current = null;
			newTerminalMenuRef.current = null;
		};
	}, [accessor]);

	const showGroupContextMenu = useCallback((e: React.MouseEvent, group: ITerminalGroup) => {
		e.preventDefault();
		e.stopPropagation();
		const terminalGroupService = accessor.get('ITerminalGroupService');
		const contextMenuService = accessor.get('IContextMenuService');
		const targetInstance = group.activeInstance || group.terminalInstances[0];
		if (targetInstance) {
			terminalGroupService.setActiveInstance(targetInstance);
		}
		const menu = tabMenuRef.current;
		if (!menu) {
			return;
		}
		contextMenuService.showContextMenu({
			getAnchor: () => ({ x: e.clientX, y: e.clientY }),
			getActions: () => flattenMenuActions(menu.getActions()),
		});
	}, [accessor]);

	const showPaneContextMenu = useCallback((e: React.MouseEvent, instance: ITerminalInstance) => {
		e.preventDefault();
		e.stopPropagation();
		const terminalGroupService = accessor.get('ITerminalGroupService');
		const contextMenuService = accessor.get('IContextMenuService');
		terminalGroupService.setActiveInstance(instance);
		const menu = instanceMenuRef.current;
		if (!menu) {
			return;
		}
		contextMenuService.showContextMenu({
			getAnchor: () => ({ x: e.clientX, y: e.clientY }),
			getActions: () => flattenMenuActions(menu.getActions()),
		});
	}, [accessor]);

	const showEmptyContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		const contextMenuService = accessor.get('IContextMenuService');
		const menu = emptyMenuRef.current;
		if (!menu) {
			return;
		}
		contextMenuService.showContextMenu({
			getAnchor: () => ({ x: e.clientX, y: e.clientY }),
			getActions: () => flattenMenuActions(menu.getActions()),
		});
	}, [accessor]);

	const showNewTerminalContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const contextMenuService = accessor.get('IContextMenuService');
		const menu = newTerminalMenuRef.current;
		if (!menu) {
			return;
		}
		contextMenuService.showContextMenu({
			getAnchor: () => ({ x: e.clientX, y: e.clientY }),
			getActions: () => flattenMenuActions(menu.getActions()),
		});
	}, [accessor]);

	return { showGroupContextMenu, showPaneContextMenu, showEmptyContextMenu, showNewTerminalContextMenu };
};
