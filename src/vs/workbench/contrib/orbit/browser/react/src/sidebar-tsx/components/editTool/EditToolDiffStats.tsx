/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

export const EditToolDiffStats = ({ additions, deletions }: { additions: number; deletions: number }) => {
	if (additions === 0 && deletions === 0) {
		return null;
	}

	return (
		<span className="flex items-center gap-1 flex-shrink-0 tabular-nums">
			{additions > 0 && (
				<span className="text-[11px] font-semibold leading-none" style={{ color: 'rgba(34, 197, 94, 0.85)' }}>+{additions}</span>
			)}
			{deletions > 0 && (
				<span className="text-[11px] font-semibold leading-none" style={{ color: 'rgba(239, 68, 68, 0.85)' }}>-{deletions}</span>
			)}
		</span>
	);
};
