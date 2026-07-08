/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IAction } from '../../../../../../../base/common/actions.js';
import Severity from '../../../../../../../base/common/severity.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { ITerminalInstance } from '../../../../../terminal/browser/terminal.js';

export const getInstanceIconClass = (instance: ITerminalInstance): string => {
	const icon = instance.icon;
	if (icon && ThemeIcon.isThemeIcon(icon)) {
		return `@@codicon @@codicon-${icon.id}`;
	}
	return '@@codicon @@codicon-terminal';
};

export const getInstanceMetaLine = (instance: ITerminalInstance): string | undefined => {
	const description = instance.description?.trim();
	if (description) {
		return description;
	}
	const cwd = instance.cwd?.trim();
	if (cwd) {
		const parts = cwd.split(/[/\\]/);
		return parts[parts.length - 1] || cwd;
	}
	return undefined;
};

export const getInstanceStatusIconClass = (instance: ITerminalInstance): string | undefined => {
	const status = instance.statusList?.primary;
	if (!status || status.severity <= Severity.Ignore) {
		return undefined;
	}
	const icon = status.icon;
	if (icon && ThemeIcon.isThemeIcon(icon)) {
		return `@@codicon @@codicon-${icon.id}`;
	}
	return undefined;
};

export const flattenMenuActions = (groups: [string, IAction[]][]): IAction[] => {
	return groups.flatMap(group => group[1]);
};
