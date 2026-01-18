/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { ButtonHTMLAttributes } from 'react';
import { IconSquare } from '../icons/IconSquare.js';
import { DEFAULT_BUTTON_SIZE } from './constants.js';

export const ButtonStop = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
	return <button
		className={`rounded-full w-5 h-5 flex-shrink-0 cursor-pointer flex items-center justify-center
			bg-white hover:bg-white/90
			transition-all duration-200
			${className}
		`}
		type='button'
		data-tooltip-id='void-tooltip'
		data-tooltip-content='Stop'
		data-tooltip-place='top'
		{...props}
	>
		<IconSquare size={DEFAULT_BUTTON_SIZE} className="stroke-[3] p-[6px]" />
	</button>
}
