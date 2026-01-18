/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { FeatureName } from '../../../../../../common/voidSettingsTypes.js';
import { StagingSelectionItem } from '../../../../../../common/chatThreadServiceTypes.js';
import { ModelDropdown } from '../../../void-settings-tsx/ModelDropdown.js';
import { IconX } from '../icons/IconX.js';
import { ButtonStop } from '../buttons/ButtonStop.js';
import { ButtonSubmit } from '../buttons/ButtonSubmit.js';
import { ChatModeDropdown } from './ChatModeDropdown.js';
import { SelectedFiles } from '../files/SelectedFiles.js';

interface VoidChatAreaProps {
	// Required
	children: React.ReactNode; // This will be the input component

	// Form controls
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled?: boolean;
	divRef?: React.RefObject<HTMLDivElement | null>;

	// UI customization
	className?: string;
	showModelDropdown?: boolean;
	showSelections?: boolean;
	showProspectiveSelections?: boolean;
	loadingIcon?: React.ReactNode;

	selections?: StagingSelectionItem[]
	setSelections?: (s: StagingSelectionItem[]) => void
	// selections?: any[];
	// onSelectionsChange?: (selections: any[]) => void;

	onClickAnywhere?: () => void;
	// Optional close button
	onClose?: () => void;
	// Optional image button in bottom row
	imageButton?: React.ReactNode;
	// Drag and drop handlers for images
	onDragEnter?: (e: React.DragEvent) => void;
	onDragOver?: (e: React.DragEvent) => void;
	onDragLeave?: (e: React.DragEvent) => void;
	onDrop?: (e: React.DragEvent) => void;
	isDragOver?: boolean;

	featureName: FeatureName;
}

export const VoidChatArea: React.FC<VoidChatAreaProps> = ({
	children,
	onSubmit,
	onAbort,
	onClose,
	onClickAnywhere,
	divRef,
	isStreaming = false,
	isDisabled = false,
	className = '',
	showModelDropdown = true,
	showSelections = false,
	showProspectiveSelections = false,
	selections,
	setSelections,
	featureName,
	loadingIcon,
	imageButton,
	onDragEnter,
	onDragOver,
	onDragLeave,
	onDrop,
	isDragOver = false,
}) => {
	return (
		<div
			ref={divRef}
			className={`
				flex flex-col p-2 relative input text-left shrink-0
				rounded-md
				bg-[var(--vscode-input-background)]
				text-[var(--vscode-input-foreground)]
				transition-all duration-200
				border ${isDragOver ? 'border-void-border-1 border-2 border-dashed bg-void-bg-2-alt/50 ring-2 ring-void-border-1/30' : 'border-void-border-3'} focus-within:border-void-border-1 hover:border-void-border-1
				max-h-[25vh] overflow-hidden
				${className}
			`}
			onClick={(e) => {
				onClickAnywhere?.()
			}}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{/* Scrollable content */}
			<div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 grow">
				{/* Selections section */}
				{showSelections && selections && setSelections && (
					<SelectedFiles
						type='staging'
						selections={selections}
						setSelections={setSelections}
						showProspectiveSelections={showProspectiveSelections}
					/>
				)}
				{/* Input section */}
				<div className="relative w-full">
					{children}
					{/* Close button (X) if onClose is provided */}
					{onClose && (
						<button
							type="button"
							className='absolute -top-1 -right-1 cursor-pointer z-10 p-0.5 hover:bg-white/10 rounded transition-colors'
							onClick={onClose}
							aria-label="Close"
						>
							<IconX
								size={12}
								className="stroke-[2] opacity-80 text-void-fg-3 hover:brightness-95"
							/>
						</button>
					)}
				</div>
			</div>
			{/* Bottom row - stays fixed while content scrolls */}
			<div className='flex flex-row justify-between items-end gap-2 shrink-0 pt-2 flex-nowrap'>
				{showModelDropdown && (
					<div className="flex items-center gap-x-2 gap-y-1 text-nowrap min-w-0 overflow-hidden">
						{featureName === 'Chat' && (
					<ChatModeDropdown
						className="
							flex items-center gap-1
							px-2 py-1
							rounded-full
							bg-[#3a3a3a]
							text-xs text-white/80
							cursor-pointer select-none
							hover:bg-[#404040]
							transition-colors
							min-w-0
							shrink
							overflow-hidden whitespace-nowrap text-ellipsis
						"
					/>
						)}
					<ModelDropdown
						featureName={featureName}
						className="w-[140px] sm:w-[180px] min-w-[100px] text-sm leading-5 px-2 shrink grow"
					/>
					</div>
				)}
				<div className="flex items-center gap-2 ml-auto">
					{imageButton}
					{isStreaming && loadingIcon}
					{isStreaming ? (
						<ButtonStop onClick={onAbort} />
					) : (
						<ButtonSubmit
							onClick={onSubmit}
							disabled={isDisabled}
							className="bg-[#ffffff] disabled:text-white/50"
						/>
					)}
				</div>
			</div>
		</div>
	);
};
