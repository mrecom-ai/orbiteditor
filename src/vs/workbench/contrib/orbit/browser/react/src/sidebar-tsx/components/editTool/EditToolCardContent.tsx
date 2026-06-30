/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { VoidDiffEditor } from '../../../util/inputs.js';
import { ChatMarkdownRender } from '../../../markdown/ChatMarkdownRender.js';
import { UnifiedDiffView } from './UnifiedDiffView.js';
import { EditToolExpandableContent } from './EditToolExpandableContent.js';
import { StreamingCodeView } from './StreamingCodeView.js';
import { EditToolContentType } from './editToolDisplayData.js';

export const EditToolCardContent = ({ uri, code, type, oldString, newString, isRunning }: {
	uri: URI | undefined,
	code: string,
	type: EditToolContentType,
	oldString?: string,
	newString?: string,
	isRunning?: boolean,
}) => {
	const dependencyKey = `${type}:${code.length}:${oldString?.length ?? 0}:${newString?.length ?? 0}:${isRunning}`;

	const hasDisplayableContent = type === 'rewrite'
		? newString !== undefined
		: !!(code && code.trim().length > 0) || (type === 'strReplace' && oldString !== undefined && oldString.length > 0);

	if (!hasDisplayableContent) {
		if (isRunning) {
			return (
				<div className="px-3 py-3 text-void-fg-4/60 text-[10px] animate-pulse">
					Applying changes...
				</div>
			);
		}
		return null;
	}

	const renderContent = (maxHeight: number | undefined) => {
		if (type === 'strReplace' && oldString !== undefined && newString !== undefined) {
			return (
				<UnifiedDiffView
					uri={uri}
					oldString={oldString}
					newString={newString}
					maxHeight={maxHeight}
					isComplete={!isRunning}
				/>
			);
		}

		if (type === 'rewrite' && newString !== undefined) {
			if (newString.length === 0) {
				return <StreamingCodeView content="" isStreaming={false} emptyLabel="Empty file" />;
			}
			return (
				<UnifiedDiffView
					uri={uri}
					oldString=""
					newString={newString}
					maxHeight={maxHeight}
					isComplete={!isRunning}
				/>
			);
		}

		if (type === 'legacy-diff' && uri) {
			return (
				<div style={{
					maxWidth: '100%',
					overflowX: 'auto',
					scrollBehavior: 'smooth'
				}}>
					<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
				</div>
			);
		}

		return (
			<ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />
		);
	};

	return (
		<div className='!select-text cursor-auto'>
			<EditToolExpandableContent
				dependencyKey={dependencyKey}
				defaultExpandState="expanded"
			>
				{(maxHeight) => renderContent(maxHeight)}
			</EditToolExpandableContent>
		</div>
	);
}
