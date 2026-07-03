/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { ToolApprovalType } from '../../../../../../common/toolsServiceTypes.js';
import { useAccessor, useSettingsState } from '../../../util/services.js';
import { VoidSwitch } from '../../../util/inputs.js';
import { toolApprovalTheme } from './toolApprovalTheme.js';
import { getAutoApproveLabel } from './toolApprovalLabels.js';

/**
 * "Always allow …" toggle shown in the approval card footer.
 *
 * This is the shared implementation: `Settings.tsx` re-exports it as
 * `ToolApprovalTypeSwitch` so the sidebar no longer imports from the settings
 * bundle. The toggle reads/writes `globalSettings.autoApprove[type]` via the
 * settings service — identical behavior to the old inline toggle.
 */
export const ToolApprovalAutoApproveToggle = ({
	approvalType,
	size = 'xs',
	/** Override the label; defaults to "Always allow …". */
	label,
	/** @deprecated Use `label` — kept for `ToolApprovalTypeSwitch` compatibility. */
	desc,
	/** When true, render the label text next to the switch. */
	showLabel = true,
}: {
	approvalType: ToolApprovalType,
	size?: 'xxs' | 'xs' | 'sm' | 'sm+' | 'md',
	label?: string,
	desc?: string,
	showLabel?: boolean,
}) => {
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const voidSettingsState = useSettingsState();
	const metricsService = accessor.get('IMetricsService');

	const onToggleAutoApprove = useCallback((type: ToolApprovalType, newValue: boolean) => {
		voidSettingsService.setGlobalSetting('autoApprove', {
			...voidSettingsService.state.globalSettings.autoApprove,
			[type]: newValue,
		});
		metricsService.capture('Tool Auto-Accept Toggle', { enabled: newValue });
	}, [voidSettingsService, metricsService]);

	const text = label ?? desc ?? getAutoApproveLabel(approvalType);

	return (
		<div className="flex items-center gap-1.5">
			<VoidSwitch
				size={size}
				value={voidSettingsState.globalSettings.autoApprove[approvalType] ?? false}
				onChange={(newVal) => onToggleAutoApprove(approvalType, newVal)}
			/>
			{showLabel && (
				<span
					className="text-[11px] whitespace-nowrap select-none"
					style={{ color: toolApprovalTheme.descFg }}
				>
					{text}
				</span>
			)}
		</div>
	);
};