/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/** Minimum visible height for edit tool card content areas */
export const EDIT_TOOL_MIN_VIEWPORT_PX = 44;

/**
 * The max height used for the code/diff viewport for executing/running_now
 * and success states (post-generation).
 *
 * Keeping this constant across those two states is what eliminates the
 * "jump": previously the streaming phase used 168px and the expanded phase
 * used 200px, so the running_now → success transition reflowed the whole
 * chat. With one value shared by those two phases, the height is stable
 * across that particular transition.
 */
export const EDIT_TOOL_VIEWPORT_MAX_PX = 200;

/**
 * Max height for the viewport while the LLM is actively generating code
 * (StreamingTool, `isStreaming` true). Deliberately larger than
 * EDIT_TOOL_VIEWPORT_MAX_PX so a user can actually read the code as it's
 * written instead of it being trimmed to ~10 lines. This intentionally
 * differs from the post-stream height — the StreamingTool → EditTool handoff
 * already remounts a different component tree, so a height change at that
 * boundary is a one-time snap rather than a reflow of already-settled chat.
 */
export const EDIT_TOOL_STREAMING_VIEWPORT_MAX_PX = 400;

/**
 * Minimum visible height for the code/diff viewport while the LLM is actively
 * generating code (`isStreaming` true).
 *
 * This is the fix for the "streaming code is a 1px sliver" bug: the streaming
 * container is shrink-to-fit (grows with content up to
 * EDIT_TOOL_STREAMING_VIEWPORT_MAX_PX, then scrolls), so with only the tiny
 * EDIT_TOOL_MIN_VIEWPORT_PX floor the first chunks rendered a cramped ~3-line
 * window — the user couldn't actually watch the code stream in. Pinning a
 * generous floor guarantees a readable code panel from the very first chunk.
 *
 * Deliberately equal to EDIT_TOOL_VIEWPORT_MAX_PX (the post-stream expanded
 * height): for a short edit the streaming window and the settled window are the
 * same size, so the StreamingTool → EditTool handoff is seamless (no snap). A
 * long stream grows past this to EDIT_TOOL_STREAMING_VIEWPORT_MAX_PX and then
 * scrolls, so nothing is ever clipped to a sliver.
 */
export const EDIT_TOOL_STREAMING_VIEWPORT_MIN_PX = EDIT_TOOL_VIEWPORT_MAX_PX;

/** Compact preview — ~6 lines */
const COLLAPSED_MAX_HEIGHT = 96;

export const EDIT_TOOL_HEIGHTS = {
	collapsed: COLLAPSED_MAX_HEIGHT,
	expanded: EDIT_TOOL_VIEWPORT_MAX_PX,
	streaming: EDIT_TOOL_STREAMING_VIEWPORT_MAX_PX,
} as const;