/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Simplified - not used in the simple plan editor
export interface TodoItem {
	id: string;
	content: string;
	status: 'pending' | 'in_progress' | 'completed';
}

export const DraggableTodoList = () => null;
