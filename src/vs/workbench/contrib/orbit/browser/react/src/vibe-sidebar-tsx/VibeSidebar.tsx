/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useTerminalVibeState, useAccessor } from '../util/services.js';
import './vibe-sidebar.css';
import { VibeSidebarGroup } from './VibeSidebarGroup.js';
import { VibeSidebarNewTerminal } from './VibeSidebarNewTerminal.js';
import { useVibeSidebarMenus } from './useVibeSidebarMenus.js';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ITerminalGroup } from '../../../../../terminal/browser/terminal.js';

type DropIndicator = { index: number; before: boolean } | null;

export const VibeSidebar = () => {
	const { groups, activeGroup, activeInstance } = useTerminalVibeState();
	const accessor = useAccessor();
	const terminalGroupService = accessor.get('ITerminalGroupService');
	const terminalService = accessor.get('ITerminalService');
	const { showGroupContextMenu, showPaneContextMenu, showEmptyContextMenu, showNewTerminalContextMenu } = useVibeSidebarMenus();

	const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement | null>(null);

	const toggleGroupCollapse = useCallback((groupIndex: number) => {
		setCollapsedGroups(prev => {
			const next = new Set(prev);
			if (next.has(groupIndex)) {
				next.delete(groupIndex);
			} else {
				next.add(groupIndex);
			}
			return next;
		});
	}, []);

	const focusInstance = useCallback((instance: Parameters<typeof terminalGroupService.setActiveInstance>[0]) => {
		terminalGroupService.setActiveInstance(instance);
		terminalService.showPanel(true);
	}, [terminalGroupService, terminalService]);

	// Auto-expand the active group when it has split panes
	useEffect(() => {
		if (!activeGroup) {
			return;
		}
		const index = groups.indexOf(activeGroup);
		if (index < 0 || activeGroup.terminalInstances.length <= 1) {
			return;
		}
		setCollapsedGroups(prev => {
			if (!prev.has(index)) {
				return prev;
			}
			const next = new Set(prev);
			next.delete(index);
			return next;
		});
	}, [activeGroup, groups]);

	// Keep the active row visible while navigating
	useEffect(() => {
		activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [activeInstance, activeGroup]);

	const handleDragStart = useCallback((groupIndex: number) => {
		setDragIndex(groupIndex);
	}, []);

	const handleDragEnd = useCallback(() => {
		setDragIndex(null);
		setDropIndicator(null);
	}, []);

	const handleDragOver = useCallback((groupIndex: number, before: boolean) => {
		if (dragIndex === null || dragIndex === groupIndex) {
			setDropIndicator(null);
			return;
		}
		setDropIndicator({ index: groupIndex, before });
	}, [dragIndex]);

	const handleDrop = useCallback((targetIndex: number, before: boolean) => {
		if (dragIndex === null) {
			return;
		}
		const currentGroups = terminalGroupService.groups;
		const draggedGroup = currentGroups[dragIndex];
		const targetGroup = currentGroups[targetIndex];
		if (!draggedGroup || !targetGroup || dragIndex === targetIndex) {
			handleDragEnd();
			return;
		}
		const draggedInstance = draggedGroup.terminalInstances[0];
		const targetInstance = targetGroup.terminalInstances[0];
		if (draggedInstance && targetInstance) {
			terminalGroupService.moveGroup(draggedInstance, targetInstance);
		}
		handleDragEnd();
	}, [dragIndex, terminalGroupService, handleDragEnd]);

	const handleListDragOver = useCallback((e: React.DragEvent) => {
		if (dragIndex !== null) {
			e.preventDefault();
		}
	}, [dragIndex]);

	const handleCreateTerminal = useCallback(() => {
		terminalService.createTerminal({ config: {} });
		terminalService.showPanel(true);
	}, [terminalService]);

	const setActiveItemRef = useCallback((el: HTMLDivElement | null, isActiveItem: boolean) => {
		if (isActiveItem) {
			activeItemRef.current = el;
		}
	}, []);

	return (
		<div className="@@terminal-vibe-sidebar-root">
			<div className="@@terminal-vibe-sidebar-header">
				<span className="@@terminal-vibe-sidebar-header-title">Terminals</span>
				<VibeSidebarNewTerminal onContextMenu={showNewTerminalContextMenu} />
			</div>
			<div
				ref={listRef}
				className="@@terminal-vibe-sidebar-list"
				onContextMenu={groups.length === 0 ? showEmptyContextMenu : undefined}
				onDragOver={handleListDragOver}
			>
				{groups.length === 0 ? (
					<div
						className="@@terminal-vibe-sidebar-empty"
						onContextMenu={showEmptyContextMenu}
					>
						<span className="@@terminal-vibe-sidebar-empty-icon @@codicon @@codicon-terminal" />
						<span className="@@terminal-vibe-sidebar-empty-title">No open terminals</span>
						<span className="@@terminal-vibe-sidebar-empty-hint">Create one to get started</span>
						<button
							type="button"
							className="@@terminal-vibe-sidebar-empty-action"
							onClick={handleCreateTerminal}
						>
							New Terminal
						</button>
					</div>
				) : (
					groups.map((group: ITerminalGroup, index: number) => (
						<VibeSidebarGroup
							key={group.terminalInstances[0]?.instanceId ?? index}
							group={group}
							groupIndex={index}
							isActive={group === activeGroup}
							isCollapsed={collapsedGroups.has(index)}
							isDragging={dragIndex === index}
							dropBefore={dropIndicator?.index === index && dropIndicator.before}
							dropAfter={dropIndicator?.index === index && !dropIndicator.before}
							activeInstance={activeInstance}
							activeItemRef={setActiveItemRef}
							onToggleCollapse={toggleGroupCollapse}
							onFocusInstance={focusInstance}
							onGroupContextMenu={showGroupContextMenu}
							onPaneContextMenu={showPaneContextMenu}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
						/>
					))
				)}
			</div>
		</div>
	);
};
