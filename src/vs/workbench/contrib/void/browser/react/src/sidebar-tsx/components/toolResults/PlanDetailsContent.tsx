/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { ListTodo, FileText } from 'lucide-react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { ToolChildrenWrapper } from '../toolWrappers/ToolChildrenWrapper.js';

export const PlanDetailsContent = ({
	overview,
	todos,
	sections,
	planPath,
	commandService
}: {
	overview: string
	todos: Array<{ id: string; content: string; status?: string }>
	sections: string[]
	planPath?: string
	commandService: any
}) => {
	return (
		<ToolChildrenWrapper>
			<div className="py-2 px-3 space-y-3">
				{/* Overview Section */}
				{overview && (
					<div>
						<div className="text-void-fg-2 text-[11px] font-medium mb-1.5">
							Overview
						</div>
						<div className="text-void-fg-1 text-[12px] leading-[1.5]">
							{overview}
						</div>
					</div>
				)}

				{/* Todos Preview */}
				{todos.length > 0 && (
					<div>
						<div className="flex items-center gap-1.5 text-void-fg-2 text-[11px] font-medium mb-1.5">
							<ListTodo size={12} className="text-void-fg-3" />
							<span>Tasks ({todos.length})</span>
						</div>
						<div className="space-y-1">
							{todos.slice(0, 3).map((todo, i) => (
								<div key={i} className="flex items-start gap-2 text-[11px]">
									<span className="text-void-fg-3 mt-0.5">□</span>
									<span className="text-void-fg-1 leading-[1.5]">{todo.content}</span>
								</div>
							))}
							{todos.length > 3 && (
								<div className="text-void-fg-3 text-[11px] italic pl-4">
									+{todos.length - 3} more task{todos.length - 3 !== 1 ? 's' : ''}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Sections List */}
				{sections.length > 0 && (
					<div>
						<div className="text-void-fg-2 text-[11px] font-medium mb-1.5">
							Sections
						</div>
						<div className="text-void-fg-1 text-[11px]">
							{sections.join(' • ')}
						</div>
					</div>
				)}

				{/* Open Plan Button */}
				{planPath && (
					<button
						onClick={() => {
							commandService.executeCommand('vscode.open', URI.file(planPath))
						}}
						className="
							mt-1 px-3 py-1.5
							bg-void-bg-1 hover:bg-void-bg-2
							border border-void-border-2
							rounded text-[11px] text-void-fg-1
							transition-colors cursor-pointer
							flex items-center gap-2
							w-full
						"
						aria-label={`Open plan file ${planPath.split(/[/\\]/).pop()}`}
					>
						<FileText size={12} />
						<span>Open Plan File</span>
					</button>
				)}
			</div>
		</ToolChildrenWrapper>
	)
}
