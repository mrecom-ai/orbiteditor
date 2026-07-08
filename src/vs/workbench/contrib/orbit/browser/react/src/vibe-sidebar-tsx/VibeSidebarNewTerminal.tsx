/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useAccessor } from '../util/services.js';
import { useCallback } from 'react';

interface VibeSidebarNewTerminalProps {
	onContextMenu: (e: React.MouseEvent) => void;
}

export const VibeSidebarNewTerminal = ({ onContextMenu }: VibeSidebarNewTerminalProps) => {
	const accessor = useAccessor();
	const terminalService = accessor.get('ITerminalService');

	const handleNewTerminal = useCallback(() => {
		terminalService.createTerminal({ config: {} });
		terminalService.showPanel(true);
	}, [terminalService]);

	return (
		<button
			type="button"
			className="@@terminal-vibe-sidebar-new"
			title="New Terminal (right-click for profiles)"
			aria-label="New Terminal"
			onClick={handleNewTerminal}
			onContextMenu={onContextMenu}
		>
			<span className="@@codicon @@codicon-add" />
		</button>
	);
};
