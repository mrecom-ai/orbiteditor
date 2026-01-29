/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

export const getBrowserElementLabel = (selection: any) => {
	const tag = selection.elementData?.tagName || 'element'
	const id = selection.elementData?.id ? `#${selection.elementData.id}` : ''
	if (id) return `${tag}${id}`
	const firstClass = selection.elementData?.classes?.[0]
	return firstClass ? `${tag}.${firstClass}` : tag
}
