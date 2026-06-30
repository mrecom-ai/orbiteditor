/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { FileCode2 } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { VsCodeFileIcon } from '../../utils/fileIcons.js';
import { EditToolDiffStats } from './EditToolDiffStats.js';
import { EditToolCardHeaderShell } from './EditToolCardHeaderShell.js';

export const EditToolStreamingHeader = ({
	uri,
	displayFilename,
	additions,
	deletions,
	showFileIcon,
}: {
	uri?: URI;
	displayFilename: string;
	additions: number;
	deletions: number;
	showFileIcon: boolean;
}) => (
	<EditToolCardHeaderShell>
		{showFileIcon ? (
			<VsCodeFileIcon
				uri={uri}
				filename={displayFilename}
				size={14}
				className="edit-tool-card-header-icon"
			/>
		) : (
			// Neutral code icon before the file path resolves, so the streaming
			// header reads as an intentional edit card rather than a bare label.
			<FileCode2
				size={14}
				strokeWidth={2}
				className="edit-tool-card-header-icon text-void-fg-4/55 flex-shrink-0"
			/>
		)}
		<TextShimmer
			className="edit-tool-card-header-filename text-void-fg-4/90 text-[11px] font-medium"
			duration={1.5}
		>
			{displayFilename}
		</TextShimmer>
		<EditToolDiffStats additions={additions} deletions={deletions} />
	</EditToolCardHeaderShell>
);