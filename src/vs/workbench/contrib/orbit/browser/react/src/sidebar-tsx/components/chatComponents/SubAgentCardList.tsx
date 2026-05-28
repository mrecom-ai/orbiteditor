/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { SubAgentStageViewModel } from '../../../../../../common/subAgentTypes.js'
import { SubAgentCard } from './SubAgentCard.js'

export const SubAgentCardList = React.memo(({ stage }: { stage: SubAgentStageViewModel }) => {
	if (!stage) return null

	const childPriority = (state: SubAgentStageViewModel['children'][number]['state'] | undefined) => {
		if (!state) return 9
		switch (state) {
			case 'running_tool': return 0
			case 'running_llm': return 1
			case 'summarizing': return 2
			case 'queued': return 3
			case 'failed': return 4
			case 'timed_out': return 5
			case 'killed': return 6
			case 'canceled': return 7
			case 'completed': return 8
			default: return 9
		}
	}

	const sortedChildren = [...stage.children].sort((a, b) => childPriority(a.state) - childPriority(b.state))
	if (sortedChildren.length === 0) return null

	return (
		<div className='sa-stage'>
			<div className='sa-list' role='list'>
				{sortedChildren.map(child => (
					<SubAgentCard key={child.childId} child={child} />
				))}
			</div>
		</div>
	)
})
