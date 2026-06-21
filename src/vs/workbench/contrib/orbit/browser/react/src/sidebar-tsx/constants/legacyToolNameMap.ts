/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { BuiltinToolName } from '../../../../../common/toolsServiceTypes.js';

/** Maps legacy tool names from older chat threads to current builtin tool renderers. */
export const LEGACY_TOOL_NAME_MAP: Record<string, BuiltinToolName> = {
	'edit_file': 'StrReplace',
	'rewrite_file': 'Write',
	'create_file_or_folder': 'Write',
};

export const resolveLegacyToolName = (toolName: string): string => {
	return LEGACY_TOOL_NAME_MAP[toolName] ?? toolName;
};
