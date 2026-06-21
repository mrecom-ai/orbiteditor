/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ITerminalInstance } from '../../../../../terminal/browser/terminal.js';
import { useAccessor } from '../util/services.js';
import { useCallback } from 'react';
import { getInstanceIconClass, getInstanceMetaLine, getInstanceStatusIconClass } from './vibeSidebarUtils.js';

interface VibeSidebarPaneProps {
	instance: ITerminalInstance;
	isActive: boolean;
	onFocus: () => void;
	onContextMenu: (e: React.MouseEvent, instance: ITerminalInstance) => void;
	activeItemRef: (el: HTMLDivElement | null, isActive: boolean) => void;
}

export const VibeSidebarPane = ({ instance, isActive, onFocus, onContextMenu, activeItemRef }: VibeSidebarPaneProps) => {
	const accessor = useAccessor();
	const terminalService = accessor.get('ITerminalService');

	const title = instance.title || 'Terminal';
	const meta = getInstanceMetaLine(instance);
	const iconClass = getInstanceIconClass(instance);
	const statusIcon = getInstanceStatusIconClass(instance);

	const handleClose = useCallback(async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		await terminalService.safeDisposeTerminal(instance);
	}, [instance, terminalService]);

	const handleMiddleClick = useCallback(async (e: React.MouseEvent) => {
		if (e.button !== 1) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		await terminalService.safeDisposeTerminal(instance);
	}, [instance, terminalService]);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		onContextMenu(e, instance);
	}, [instance, onContextMenu]);

	const setRef = useCallback((el: HTMLDivElement | null) => {
		activeItemRef(el, isActive);
	}, [activeItemRef, isActive]);

	return (
		<div
			ref={setRef}
			className={`@@terminal-vibe-sidebar-pane ${isActive ? '@@is-active' : ''}`}
			onClick={onFocus}
			onContextMenu={handleContextMenu}
			onAuxClick={handleMiddleClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onFocus();
				}
			}}
		>
			<span className={`@@terminal-vibe-sidebar-pane-icon ${iconClass}`} />
			<span className="@@terminal-vibe-sidebar-pane-text">
				<span className="@@terminal-vibe-sidebar-pane-label" title={title}>{title}</span>
				{meta && meta !== title && (
					<span className="@@terminal-vibe-sidebar-pane-meta" title={meta}>{meta}</span>
				)}
			</span>
			{statusIcon && (
				<span className={`@@terminal-vibe-sidebar-status ${statusIcon}`} title="Terminal status" />
			)}
			<button
				type="button"
				className="@@terminal-vibe-sidebar-pane-close @@codicon @@codicon-close"
				title="Close Pane"
				aria-label="Close Pane"
				onClick={handleClose}
			/>
		</div>
	);
};
