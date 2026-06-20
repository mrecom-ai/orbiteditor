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
		<span className="flex items-center gap-1 flex-shrink-0">
			{additions > 0 && (
				<span className="text-green-500 text-[12px] font-medium">+{additions}</span>
			)}
			{deletions > 0 && (
				<span className="text-red-500 text-[12px] font-medium">-{deletions}</span>
			)}
		</span>
	);
};
