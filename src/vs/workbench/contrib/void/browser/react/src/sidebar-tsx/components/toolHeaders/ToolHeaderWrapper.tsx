/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { CircleEllipsis, AlertTriangle, Ban } from 'lucide-react';
import { TextShimmer } from '../../../util/TextShimmer.js';

export type ToolHeaderParams = {
	icon?: React.ReactNode;
	iconTooltip?: string;
	title: React.ReactNode;
	desc1: React.ReactNode;
	desc1OnClick?: () => void;
	desc2?: React.ReactNode;
	isError?: boolean;
	info?: string;
	desc1Info?: string;
	isRejected?: boolean;
	numResults?: number;
	hasNextPage?: boolean;
	children?: React.ReactNode;
	bottomChildren?: React.ReactNode;
	onClick?: () => void;
	desc2OnClick?: () => void;
	isOpen?: boolean;
	className?: string;
	isRunning?: boolean;
}

export const ToolHeaderWrapper = React.memo(({
	icon,
	iconTooltip,
	title,
	desc1,
	desc1OnClick,
	desc1Info,
	desc2,
	numResults,
	hasNextPage,
	children,
	info,
	bottomChildren,
	isError,
	onClick,
	desc2OnClick,
	isOpen,
	isRejected,
	className,
	isRunning = false,
}: ToolHeaderParams) => {
	const [isOpen_, setIsOpen] = useState(false);

	const isExpanded = isOpen !== undefined ? isOpen : isOpen_;
	const isDropdown = children !== undefined;
	const isDesc1Clickable = !!desc1OnClick;

	// Build tooltip content if error exists
	const errorTooltip = isError && desc1 ? String(desc1) : undefined;

	const desc1HTML = <span
		className={`text-void-fg-3 opacity-50 ml-1 truncate text-[12px]
			${isDesc1Clickable ? 'cursor-pointer hover:opacity-80 transition-opacity duration-150' : ''}
		`}
		onClick={(e) => {
			if (desc1OnClick) {
				e.stopPropagation();
				desc1OnClick();
			}
		}}
		{...desc1Info ? {
			'data-tooltip-id': 'void-tooltip',
			'data-tooltip-content': desc1Info,
			'data-tooltip-place': 'top',
			'data-tooltip-delay-show': 1000,
		} : {}}
	>{desc1}</span>;

	const iconTooltipProps = iconTooltip ? {
		'data-tooltip-id': 'void-tooltip',
		'data-tooltip-content': iconTooltip,
		'data-tooltip-place': 'top' as const,
	} : {};

	return (<div className='flex flex-col'>
		<div
			className={`
				flex flex-row items-center gap-1
				full-width box-border overflow-hidden
				${isDropdown || onClick ? 'cursor-pointer' : ''}
				select-none
				${isRejected ? 'line-through opacity-70' : ''}
				${className || ''}
			`}
			onClick={() => {
				if (isDropdown) { setIsOpen(v => !v); }
				if (onClick) { onClick(); }
			}}
		>
			<div className='flex gap-1 overflow-hidden min-w-0 flex-[0_1_auto]'>
				<div className={`
					flex items-center gap-1 overflow-hidden min-w-0
					text-void-fg-3 text-[12px]
					transition-opacity duration-100 ease-in
					${isRejected ? 'line-through opacity-70' : ''}
				`}>
					{/* Check if title is already a React element (e.g., TextShimmer from getTitle) */}
					{React.isValidElement(title) ? (
						<span className="flex-shrink-0 text-void-fg-3 opacity-70 whitespace-nowrap overflow-hidden text-ellipsis">
							{title}
						</span>
					) : isRunning && typeof title === 'string' ? (
						<TextShimmer duration={2.5} spread={2}>
							{title}
						</TextShimmer>
					) : (
						<span
							className="flex-shrink-0 text-void-fg-3 opacity-70 whitespace-nowrap overflow-hidden text-ellipsis"
							data-tooltip-id='void-tooltip'
							{...(errorTooltip && {
								'data-tooltip-content': errorTooltip,
								'data-tooltip-place': 'top',
							})}
						>
							{title}
						</span>
					)}
					{desc1 && !isError && desc1HTML}
				</div>
			</div>

			{/* Right side items */}
			{(info || isError || isRejected || desc2 || numResults !== undefined) && (
				<div className="flex items-center gap-x-1.5 flex-shrink-0 ml-auto">
					{info && <CircleEllipsis
						className='text-void-fg-4 opacity-50 flex-shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={info}
						data-tooltip-place='top-end'
					/>}

					{isError && <AlertTriangle
						className='text-void-fg-3 opacity-80 flex-shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={errorTooltip || 'Error running tool'}
						data-tooltip-place='top'
					/>}
					{isRejected && <Ban
						className='text-void-fg-4 opacity-70 flex-shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={'Canceled'}
						data-tooltip-place='top'
					/>}
					{desc2 && <span className="text-void-fg-4 opacity-60 text-[11px]" onClick={(e) => { e.stopPropagation(); desc2OnClick?.(); }}>
						{desc2}
					</span>}
					{numResults !== undefined && (
						<span className="text-void-fg-4 opacity-60 text-[11px] ml-auto">
							{`${numResults}${hasNextPage ? '+' : ''} result${numResults !== 1 ? 's' : ''}`}
						</span>
					)}
				</div>
			)}
		</div>

		{/* children */}
		<div
			className={`
				overflow-hidden transition-all duration-200 ease-in-out
				${isExpanded ? 'opacity-100 max-h-[300px]' : 'max-h-0 opacity-0'}
				pl-0
			`}
		>
			{children}
		</div>

		{bottomChildren}
	</div>);
});
