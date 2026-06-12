/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const TodoPlanningStatus: React.FC<{ label?: string }> = ({ label = 'Planning…' }) => (
	<div className="mt-1 px-2 py-0.5 text-[10px] text-void-fg-3 flex items-center gap-1.5">
		<span className="inline-block w-1.5 h-1.5 rounded-full bg-void-accent animate-pulse" />
		<span>{label}</span>
	</div>
);