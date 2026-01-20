/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const BottomChildren = ({ children, title }: { children: React.ReactNode, title: string }) => {
	const [isOpen, setIsOpen] = useState(false);
	if (!children) return null;
	return (
		<div className="w-full px-2 mt-1">
			<div
				className={`flex items-center cursor-pointer select-none transition-colors duration-150 pl-0 py-1 rounded group`}
				onClick={() => setIsOpen(o => !o)}
				style={{ background: 'none' }}
			>
				<ChevronRight
					className={`mr-1.5 h-3 w-3 flex-shrink-0 transition-transform duration-200 ease-out text-void-fg-4/60 group-hover:text-void-fg-3/70 ${isOpen ? 'rotate-90' : ''}`}
					strokeWidth={2.5}
				/>
				<span className="font-medium text-void-fg-3/70 group-hover:text-void-fg-3/85 text-[11px] transition-colors duration-150">
					{title}
				</span>
			</div>
			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'max-h-0 opacity-0'} text-xs pl-4`}
			>
				<div 
					className="overflow-x-auto text-void-fg-3 opacity-80 px-2 py-1"
					style={{
						borderLeft: '2px solid rgba(var(--vscode-void-fg-4-rgb, 128, 128, 128), 0.25)'
					}}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
