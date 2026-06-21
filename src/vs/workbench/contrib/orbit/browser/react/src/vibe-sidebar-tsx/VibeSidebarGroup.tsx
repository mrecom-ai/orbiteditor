/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ITerminalGroup, ITerminalInstance } from '../../../../../terminal/browser/terminal.js';
import { VibeSidebarPane } from './VibeSidebarPane.js';
import { useAccessor } from '../util/services.js';
import { useCallback, useRef } from 'react';
import { getInstanceIconClass, getInstanceMetaLine, getInstanceStatusIconClass } from './vibeSidebarUtils.js';

interface VibeSidebarGroupProps {
	group: ITerminalGroup;
	groupIndex: number;
	isActive: boolean;
	isCollapsed: boolean;
	isDragging: boolean;
	dropBefore: boolean;
	dropAfter: boolean;
	activeInstance: ITerminalInstance | undefined;
	activeItemRef: (el: HTMLDivElement | null, isActive: boolean) => void;
	onToggleCollapse: (groupIndex: number) => void;
	onFocusInstance: (instance: ITerminalInstance) => void;
	onGroupContextMenu: (e: React.MouseEvent, group: ITerminalGroup) => void;
	onPaneContextMenu: (e: React.MouseEvent, instance: ITerminalInstance) => void;
	onDragStart: (groupIndex: number) => void;
	onDragEnd: () => void;
	onDragOver: (groupIndex: number, before: boolean) => void;
	onDrop: (groupIndex: number, before: boolean) => void;
}

export const VibeSidebarGroup = ({
	group, groupIndex, isActive, isCollapsed, isDragging, dropBefore, dropAfter,
	activeInstance, activeItemRef, onToggleCollapse, onFocusInstance,
	onGroupContextMenu, onPaneContextMenu, onDragStart, onDragEnd, onDragOver, onDrop,
}: VibeSidebarGroupProps) => {
	const accessor = useAccessor();
	const terminalService = accessor.get('ITerminalService');
	const rowRef = useRef<HTMLDivElement>(null);

	const instances = group.terminalInstances;
	const hasSplits = instances.length > 1;
	const primaryInstance = group.activeInstance ?? instances[0];
	const title = group.title || primaryInstance?.title || `Terminal ${groupIndex + 1}`;
	const meta = primaryInstance ? getInstanceMetaLine(primaryInstance) : undefined;
	const statusIcon = primaryInstance ? getInstanceStatusIconClass(primaryInstance) : undefined;
	const isActiveRow = isActive && (!activeInstance || activeInstance === primaryInstance || !hasSplits);

	const handleClick = useCallback(() => {
		if (primaryInstance) {
			onFocusInstance(primaryInstance);
		}
	}, [primaryInstance, onFocusInstance]);

	const handleToggle = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		onToggleCollapse(groupIndex);
	}, [groupIndex, onToggleCollapse]);

	const handleClose = useCallback(async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		for (const instance of [...group.terminalInstances]) {
			await terminalService.safeDisposeTerminal(instance);
		}
	}, [group, terminalService]);

	const handleMiddleClick = useCallback(async (e: React.MouseEvent) => {
		if (e.button !== 1) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		for (const instance of [...group.terminalInstances]) {
			await terminalService.safeDisposeTerminal(instance);
		}
	}, [group, terminalService]);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		onGroupContextMenu(e, group);
	}, [group, onGroupContextMenu]);

	const handleDragStart = useCallback((e: React.DragEvent) => {
		onDragStart(groupIndex);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(groupIndex));
		}
	}, [groupIndex, onDragStart]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const before = e.clientY < rect.top + rect.height / 2;
		onDragOver(groupIndex, before);
	}, [groupIndex, onDragOver]);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const before = e.clientY < rect.top + rect.height / 2;
		onDrop(groupIndex, before);
	}, [groupIndex, onDrop]);

	const setRowRef = useCallback((el: HTMLDivElement | null) => {
		rowRef.current = el;
		activeItemRef(el, isActiveRow);
	}, [activeItemRef, isActiveRow]);

	return (
		<div className={`@@terminal-vibe-sidebar-group ${isDragging ? '@@is-dragging' : ''}`}>
			{dropBefore && <div className="@@terminal-vibe-sidebar-drop-indicator" />}
			<div
				ref={setRowRef}
				className={`@@terminal-vibe-sidebar-row ${isActiveRow ? '@@is-active' : ''}`}
				draggable
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onAuxClick={handleMiddleClick}
				onDragStart={handleDragStart}
				onDragEnd={onDragEnd}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				role="button"
				tabIndex={0}
				aria-expanded={hasSplits ? !isCollapsed : undefined}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleClick();
					}
				}}
			>
				{hasSplits ? (
					<span
						className={`@@terminal-vibe-sidebar-chevron ${isCollapsed ? '@@is-collapsed' : ''}`}
						onClick={handleToggle}
						role="button"
						tabIndex={-1}
						aria-label={isCollapsed ? 'Expand panes' : 'Collapse panes'}
					>
						<span className="@@codicon @@codicon-chevron-down" />
					</span>
				) : (
					<span className="@@terminal-vibe-sidebar-chevron-spacer" />
				)}
				{primaryInstance && (
					<span className={`@@terminal-vibe-sidebar-icon ${getInstanceIconClass(primaryInstance)}`} />
				)}
				<span className="@@terminal-vibe-sidebar-text">
					<span className="@@terminal-vibe-sidebar-label" title={title}>{title}</span>
					{meta && <span className="@@terminal-vibe-sidebar-meta" title={meta}>{meta}</span>}
				</span>
				{statusIcon && (
					<span className={`@@terminal-vibe-sidebar-status ${statusIcon}`} title="Terminal status" />
				)}
				{hasSplits && (
					<span className="@@terminal-vibe-sidebar-count" title={`${instances.length} panes`}>
						{instances.length}
					</span>
				)}
				<button
					type="button"
					className="@@terminal-vibe-sidebar-close @@codicon @@codicon-close"
					title="Close Terminal Group"
					aria-label="Close Terminal Group"
					onClick={handleClose}
				/>
			</div>
			{!isCollapsed && hasSplits && (
				<div className="@@terminal-vibe-sidebar-pane-list">
					{instances.map((instance) => (
						<VibeSidebarPane
							key={instance.instanceId}
							instance={instance}
							isActive={instance === activeInstance}
							onFocus={() => onFocusInstance(instance)}
							onContextMenu={onPaneContextMenu}
							activeItemRef={activeItemRef}
						/>
					))}
				</div>
			)}
			{dropAfter && <div className="@@terminal-vibe-sidebar-drop-indicator" />}
		</div>
	);
};
