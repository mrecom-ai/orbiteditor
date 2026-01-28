/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { ButtonHTMLAttributes } from 'react';
import { IconArrowUp } from '../icons/IconArrowUp.js';
import { DEFAULT_BUTTON_SIZE } from './constants.js';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const ButtonSubmit = ({ className, disabled, ...props }: ButtonProps & Required<Pick<ButtonProps, 'disabled'>>) => {

	return <button
		type='button'
		className={`rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center
			transition-all duration-200
			${disabled ? 'bg-void-fg-4/30 cursor-default opacity-50' : 'bg-void-fg-1 hover:bg-void-fg-2 cursor-pointer'}
			${className}
		`}
		data-tooltip-id='void-tooltip'
		data-tooltip-content={'Send'}
		data-tooltip-place='top'
		{...props}
	>
		<IconArrowUp size={DEFAULT_BUTTON_SIZE} className="stroke-[2] p-[3px] text-void-bg-3" />
	</button>
}
