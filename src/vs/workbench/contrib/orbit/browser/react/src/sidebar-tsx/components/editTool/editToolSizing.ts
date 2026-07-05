/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/** Minimum visible height for edit tool card content areas */
export const EDIT_TOOL_MIN_VIEWPORT_PX = 44;

/**
 * The single max height used for the code/diff viewport across EVERY lifecycle
 * state (LLM-generation streaming, executing/running_now, and success).
 *
 * Keeping this constant across states is what eliminates the "jump": previously
 * the streaming phase used 168px and the expanded phase used 200px, so the
 * running_now → success transition (and the StreamingTool → EditTool handoff)
 * flipped `isStreaming`, flipped `maxHeight`, and reflowed the whole chat. With
 * one value, the height is stable regardless of which phase the tool is in.
 */
export const EDIT_TOOL_VIEWPORT_MAX_PX = 200;

/** Compact preview — ~6 lines */
const COLLAPSED_MAX_HEIGHT = 96;

export const EDIT_TOOL_HEIGHTS = {
	collapsed: COLLAPSED_MAX_HEIGHT,
	expanded: EDIT_TOOL_VIEWPORT_MAX_PX,
	streaming: EDIT_TOOL_VIEWPORT_MAX_PX,
} as const;