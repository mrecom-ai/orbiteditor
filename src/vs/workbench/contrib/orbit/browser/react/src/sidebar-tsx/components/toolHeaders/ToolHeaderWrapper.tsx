/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { CircleEllipsis, AlertTriangle, Ban, ChevronRight } from 'lucide-react';
import { TextShimmer } from '../../../util/TextShimmer.js';
import { CollapsibleSection } from '../wrappers/CollapsibleSection.js';

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
	compact?: boolean;
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
	compact = false,
}: ToolHeaderParams) => {
	const [isOpen_, setIsOpen] = useState(false);

	const isExpanded = isOpen !== undefined ? isOpen : isOpen_;
	const isDropdown = !compact && children !== undefined;
	const isDesc1Clickable = !!desc1OnClick && !React.isValidElement(desc1);
	const isInteractive = isDropdown || !!onClick;

	const errorTooltip = isError && desc1 && typeof desc1 === 'string' ? desc1 : undefined;

	const desc1IsElement = React.isValidElement(desc1);

	const desc1Content = !desc1 || isError ? null : desc1IsElement ? (
		<span className="ml-1 min-w-0 flex-1 overflow-hidden">{desc1}</span>
	) : (
		<span
			className={`text-void-fg-4 opacity-50 ml-1 truncate text-[12px] min-w-0
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
		>{desc1}</span>
	);

	const iconTooltipProps = iconTooltip ? {
		'data-tooltip-id': 'void-tooltip',
		'data-tooltip-content': iconTooltip,
		'data-tooltip-place': 'top' as const,
	} : {};

	const handleRowClick = () => {
		if (isDropdown) {
			setIsOpen(v => !v);
		}
		if (onClick) {
			onClick();
		}
	};

	const titleContent = React.isValidElement(title) ? (
		<span className="shrink-0 text-void-fg-4 opacity-70 whitespace-nowrap overflow-hidden text-ellipsis max-w-[40%]">
			{title}
		</span>
	) : isRunning && typeof title === 'string' ? (
		<span className="shrink-0 max-w-[40%] overflow-hidden">
			<TextShimmer duration={2.5} spread={2}>
				{title}
			</TextShimmer>
		</span>
	) : (
		<span
			className="shrink-0 text-void-fg-4 opacity-70 whitespace-nowrap overflow-hidden text-ellipsis max-w-[40%]"
			data-tooltip-id='void-tooltip'
			{...(errorTooltip && {
				'data-tooltip-content': errorTooltip,
				'data-tooltip-place': 'top',
			})}
		>
			{title}
		</span>
	);

	return (<div className={`flex flex-col min-w-0 w-full ${compact ? '' : ''}`}>
		<div
			className={`
				group flex flex-row items-center gap-1
				w-full min-w-0 box-border overflow-hidden
				${isInteractive ? 'cursor-pointer' : ''}
				select-none py-0.5
				${isRejected ? 'line-through opacity-70' : ''}
				${isInteractive ? 'hover:opacity-90' : ''}
				transition-opacity duration-150 ease-out
				${className || ''}
			`}
			onClick={handleRowClick}
		>
			{isDropdown && (
				<ChevronRight
					size={10}
					strokeWidth={2.5}
					className={`
						shrink-0 text-void-fg-4/40
						transition-all duration-200 ease-out
						${isExpanded ? 'rotate-90 text-void-fg-4/60' : 'opacity-0 group-hover:opacity-100'}
					`}
					aria-hidden="true"
				/>
			)}

			{icon && (
				<span className="shrink-0 text-void-fg-4/60" {...iconTooltipProps}>
					{icon}
				</span>
			)}

			<div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
				{titleContent}
				{desc1Content}
			</div>

			{(info || isError || isRejected || desc2 || numResults !== undefined) && (
				<div className="flex items-center gap-x-1.5 shrink-0 ml-1">
					{info && <CircleEllipsis
						className='text-void-fg-4 opacity-50 shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={info}
						data-tooltip-place='top-end'
					/>}

					{isError && <AlertTriangle
						className='text-void-fg-4 opacity-80 shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={errorTooltip || 'Error running tool'}
						data-tooltip-place='top'
					/>}
					{isRejected && <Ban
						className='text-void-fg-4 opacity-70 shrink-0'
						size={11}
						data-tooltip-id='void-tooltip'
						data-tooltip-content={'Canceled'}
						data-tooltip-place='top'
					/>}
					{desc2 && <span className="text-void-fg-4 opacity-60 text-[11px] whitespace-nowrap" onClick={(e) => { e.stopPropagation(); desc2OnClick?.(); }}>
						{desc2}
					</span>}
					{numResults !== undefined && (
						<span className="text-void-fg-4 opacity-60 text-[11px] whitespace-nowrap">
							{`${numResults}${hasNextPage ? '+' : ''} result${numResults !== 1 ? 's' : ''}`}
						</span>
					)}
				</div>
			)}
		</div>

		<CollapsibleSection isOpen={isExpanded && isDropdown}>
			<div className="max-h-[300px] overflow-y-auto void-custom-scrollable pl-3">
				{children}
			</div>
		</CollapsibleSection>

		{bottomChildren}
	</div>);
});