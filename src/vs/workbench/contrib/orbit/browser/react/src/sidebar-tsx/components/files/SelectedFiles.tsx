/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { File, Folder, Text, Globe } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { StagingSelectionItem } from '../../../../../../common/chatThreadServiceTypes.js';
import { useAccessor, useActiveURI } from '../../../util/services.js';
import { getRelative, getBasename, voidOpenFileFn } from '../../utils/fileUtils.js';
import { getBrowserElementLabel } from '../../utils/browserUtils.js';
import { IconX } from '../icons/IconX.js';

const BrowserElementScreenshotPreview = ({ screenshotBase64 }: { screenshotBase64: string }) => {
	const [imageError, setImageError] = React.useState(false);

	if (imageError || !screenshotBase64) {
		return (
			<div className='w-16 h-16 flex items-center justify-center rounded border border-void-border-3 bg-void-bg-2 text-void-text-3 text-xs'>
				No preview
			</div>
		);
	}

	return (
		<img
			className='w-16 h-16 object-contain rounded border border-void-border-3 shadow-sm bg-white/5'
			src={`data:image/png;base64,${screenshotBase64}`}
			alt='Selected element'
			loading='lazy'
			onError={() => setImageError(true)}
			style={{ imageRendering: 'auto' }}
		/>
	)
}

export const SelectedFiles = (
	{ type, selections, setSelections, showProspectiveSelections, messageIdx, }:
		| { type: 'past', selections: StagingSelectionItem[]; setSelections?: undefined, showProspectiveSelections?: undefined, messageIdx: number, }
		| { type: 'staging', selections: StagingSelectionItem[]; setSelections: ((newSelections: StagingSelectionItem[]) => void), showProspectiveSelections?: boolean, messageIdx?: number }
) => {

	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const modelReferenceService = accessor.get('IVoidModelService')




	// state for tracking prospective files
	const { uri: currentURI } = useActiveURI()
	const [recentUris, setRecentUris] = useState<URI[]>([])
	const maxRecentUris = 10
	const maxProspectiveFiles = 3
	useEffect(() => { // handle recent files
		if (!currentURI) return
		setRecentUris(prev => {
			const withoutCurrent = prev.filter(uri => uri.fsPath !== currentURI.fsPath) // remove duplicates
			const withCurrent = [currentURI, ...withoutCurrent]
			return withCurrent.slice(0, maxRecentUris)
		})
	}, [currentURI])
	const [prospectiveSelections, setProspectiveSelections] = useState<StagingSelectionItem[]>([])


	// handle prospective files
	useEffect(() => {
		const computeRecents = async () => {
			const prospectiveURIs = recentUris
				.filter(uri => !selections.find(s => s.type === 'File' && s.uri.fsPath === uri.fsPath))
				.slice(0, maxProspectiveFiles)

			const answer: StagingSelectionItem[] = []
			for (const uri of prospectiveURIs) {
				answer.push({
					type: 'File',
					uri: uri,
					language: (await modelReferenceService.getModelSafe(uri)).model?.getLanguageId() || 'plaintext',
					state: { wasAddedAsCurrentFile: false },
				})
			}
			return answer
		}

		// add a prospective file if type === 'staging' and if the user is in a file, and if the file is not selected yet
		if (type === 'staging' && showProspectiveSelections) {
			computeRecents().then((a) => setProspectiveSelections(a))
		}
		else {
			setProspectiveSelections([])
		}
	}, [recentUris, selections, type, showProspectiveSelections])


	const allSelections = [...selections, ...prospectiveSelections]

	if (allSelections.length === 0) {
		return null
	}

	return (
		<div className='flex items-center flex-wrap text-left relative gap-x-0.5 gap-y-1 pb-0.5'>

			{allSelections.map((selection, i) => {

				const isThisSelectionProspective = i > selections.length - 1

			const thisKey = selection.type === 'CodeSelection' ? `${selection.type}-${selection.uri.fsPath}-${selection.range[0]}-${selection.range[1]}`
				: selection.type === 'File' ? `${selection.type}-${selection.uri.fsPath}`
					: selection.type === 'Folder' ? `${selection.type}-${selection.uri.fsPath}`
						: selection.type === 'BrowserElement' ? `${selection.type}-${selection.pageUrl}-${selection.selector}`
							: `unknown-${i}`

				const SelectionIcon = (
					selection.type === 'File' ? File
						: selection.type === 'Folder' ? Folder
							: selection.type === 'CodeSelection' ? Text
								: selection.type === 'BrowserElement' ? Globe
									: (undefined as never)
				)

				return <div // container for summarybox and code
					key={thisKey}
					className={`flex flex-col space-y-[1px]`}
				>
					{/* tooltip for file path */}
					<span className="truncate overflow-hidden text-ellipsis"
						data-tooltip-id='void-tooltip'
						data-tooltip-content={selection.type === 'BrowserElement'
							? `${selection.pageUrl}${selection.selector ? ` • ${selection.selector}` : ''}`
							: getRelative(selection.uri, accessor)}
						data-tooltip-place='top'
						data-tooltip-delay-show={3000}
					>
						{/* summarybox */}
						<div
							className={`
								flex items-center gap-1 relative
								px-1
								w-fit h-fit
								select-none
								text-xs text-nowrap
								border rounded-sm
								${isThisSelectionProspective ? 'bg-void-bg-1 text-void-fg-3 opacity-80' : 'bg-void-bg-1 hover:brightness-95 text-void-fg-1'}
								${isThisSelectionProspective
									? 'border-void-border-2'
									: 'border-void-border-1'
								}
								hover:border-void-border-1
								transition-all duration-150
							`}
							onClick={() => {
								if (type !== 'staging') return; // (never)
								if (isThisSelectionProspective) { // add prospective selection to selections
									setSelections([...selections, selection])
								}
								else if (selection.type === 'File') { // open files
									voidOpenFileFn(selection.uri, accessor);

									const wasAddedAsCurrentFile = selection.state.wasAddedAsCurrentFile
									if (wasAddedAsCurrentFile) {
										// make it so the file is added permanently, not just as the current file
										const newSelection: StagingSelectionItem = { ...selection, state: { ...selection.state, wasAddedAsCurrentFile: false } }
										setSelections([
											...selections.slice(0, i),
											newSelection,
											...selections.slice(i + 1)
										])
									}
								}
								else if (selection.type === 'CodeSelection') {
									voidOpenFileFn(selection.uri, accessor, selection.range);
								}
								else if (selection.type === 'Folder') {
									// TODO!!! reveal in tree
								}
								else if (selection.type === 'BrowserElement') {
									commandService.executeCommand('simpleBrowser.show', selection.pageUrl).then(() => { }, () => { })
								}
							}}
						>
							{<SelectionIcon size={10} />}

							{ // file name and range
								(selection.type === 'BrowserElement'
									? getBrowserElementLabel(selection)
									: getBasename(selection.uri.fsPath)
									+ (selection.type === 'CodeSelection' ? ` (${selection.range[0]}-${selection.range[1]})` : '')
								)
							}

							{selection.type === 'File' && selection.state.wasAddedAsCurrentFile && messageIdx === undefined && currentURI?.fsPath === selection.uri.fsPath ?
								<span className={`text-[8px] 'void-opacity-60 text-void-fg-4`}>
									{`(Current File)`}
								</span>
								: null
							}

							{type === 'staging' && !isThisSelectionProspective ? // X button
								<div // box for making it easier to click
									className='cursor-pointer z-1 self-stretch flex items-center justify-center'
									onClick={(e) => {
										e.stopPropagation(); // don't open/close selection
										if (type !== 'staging') return;
										setSelections([...selections.slice(0, i), ...selections.slice(i + 1)])
									}}
								>
									<IconX
										className='stroke-[2]'
										size={10}
									/>
								</div>
								: <></>
							}
						</div>
					</span>

					{selection.type === 'BrowserElement' && selection.screenshot ? (
						<BrowserElementScreenshotPreview screenshotBase64={selection.screenshot} />
					) : null}
				</div>

			})}


		</div>

	)
}
