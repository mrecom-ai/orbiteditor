/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * Invisible spacer below the active turn that reserves room so the anchored user message can be
 * pinned to the top while the assistant response streams in below it.
 *
 * The height is owned imperatively by {@link ChatScrollContainer} (via the `data-turn-anchor-spacer`
 * attribute) — NOT by React — so frequent streaming re-renders never clobber the adaptively-sized
 * height.
 */
export const TurnAnchorSpacer = () => {
	return (
		<div
			aria-hidden
			data-turn-anchor-spacer
			className="flex-shrink-0 w-full pointer-events-none"
		/>
	);
};
