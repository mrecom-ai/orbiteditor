/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { BuiltinToolName } from '../../../../../common/toolsServiceTypes.js';
import { TextShimmer } from '../../util/TextShimmer.js';

// Perfect shimmer effect for streaming tool titles

const StreamingIndicator = ({ verb }: { verb: string }) => {
	return (
		<TextShimmer
			duration={2.5}
			spread={2}
		>
			{verb}
		</TextShimmer>
	);
};

export const loadingTitleWrapper = (verb: string): React.ReactNode => {
	return <StreamingIndicator verb={verb} />;
};

export const titleOfBuiltinToolName = {
	'read_file': { done: 'Read', proposed: 'Read', running: loadingTitleWrapper('Reading') },
	'ls_dir': { done: 'Listed', proposed: 'List', running: loadingTitleWrapper('Listing') },
	'get_dir_tree': { done: 'Listed tree', proposed: 'List tree', running: loadingTitleWrapper('Listing tree') },
	'search_pathnames_only': { done: 'Searched filenames', proposed: 'Search filenames', running: loadingTitleWrapper('Searching filenames') },
	'search_for_files': { done: 'Searched', proposed: 'Search', running: loadingTitleWrapper('Searching') },
	'create_file_or_folder': { done: 'Created', proposed: 'Create', running: loadingTitleWrapper('Creating') },
	'delete_file_or_folder': { done: 'Deleted', proposed: 'Delete', running: loadingTitleWrapper('Deleting') },
	'edit_file': { done: 'Edited', proposed: 'Edit', running: loadingTitleWrapper('Editing') },
	'rewrite_file': { done: 'Rewrote', proposed: 'Rewrite', running: loadingTitleWrapper('Rewriting') },
	'run_command': { done: 'Ran', proposed: 'Run', running: loadingTitleWrapper('Running') },
	'run_persistent_command': { done: 'Ran', proposed: 'Run', running: loadingTitleWrapper('Running') },

	'open_persistent_terminal': { done: 'Opened', proposed: 'Open', running: loadingTitleWrapper('Opening') },
	'kill_persistent_terminal': { done: 'Killed', proposed: 'Kill', running: loadingTitleWrapper('Killing') },

	'browser_navigate': { done: 'Navigated', proposed: 'Navigate', running: loadingTitleWrapper('Navigating') },
	'browser_click': { done: 'Clicked', proposed: 'Click', running: loadingTitleWrapper('Clicking') },
	'browser_type': { done: 'Typed', proposed: 'Type', running: loadingTitleWrapper('Typing') },
	'browser_fill': { done: 'Filled', proposed: 'Fill', running: loadingTitleWrapper('Filling') },
	'browser_screenshot': { done: 'Captured', proposed: 'Capture', running: loadingTitleWrapper('Capturing') },
	'browser_get_content': { done: 'Got content', proposed: 'Get content', running: loadingTitleWrapper('Getting content') },
	'browser_extract_text': { done: 'Extracted text', proposed: 'Extract text', running: loadingTitleWrapper('Extracting text') },
	'browser_evaluate': { done: 'Evaluated', proposed: 'Evaluate', running: loadingTitleWrapper('Evaluating') },
	'browser_wait_for_selector': { done: 'Waited', proposed: 'Wait', running: loadingTitleWrapper('Waiting') },
	'browser_get_url': { done: 'Got URL', proposed: 'Get URL', running: loadingTitleWrapper('Getting URL') },

	'read_lint_errors': { done: 'Read errors', proposed: 'Read errors', running: loadingTitleWrapper('Reading errors') },
	'search_in_file': { done: 'Searched file', proposed: 'Search in file', running: loadingTitleWrapper('Searching file') },
	'update_todo_list': { done: 'Updated TODO list', proposed: 'Update TODO list', running: loadingTitleWrapper('Updating TODO list') },

	'browser_snapshot': { done: 'Captured snapshot', proposed: 'Capture snapshot', running: loadingTitleWrapper('Capturing snapshot') },

	// Plan tools
	'create_plan': { done: 'Created plan', proposed: 'Create plan', running: loadingTitleWrapper('Creating plan') },
	'read_plan': { done: 'Read plan', proposed: 'Read plan', running: loadingTitleWrapper('Reading plan') },
	'update_plan_section': { done: 'Updated plan', proposed: 'Update plan', running: loadingTitleWrapper('Updating plan') },
	'add_plan_todo': { done: 'Added todo', proposed: 'Add todo', running: loadingTitleWrapper('Adding todo') },
	'mark_plan_item_complete': { done: 'Completed item', proposed: 'Complete item', running: loadingTitleWrapper('Completing item') },

} as const satisfies Record<BuiltinToolName, { done: any, proposed: any, running: any }>

export const TOOL_STATUS_ICON_SIZE = 14
