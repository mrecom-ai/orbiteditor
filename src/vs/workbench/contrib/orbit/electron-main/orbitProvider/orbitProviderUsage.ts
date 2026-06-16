/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { OrbitUsageStats } from '../../common/orbitUsageTypes.js'
import { getGitHubOAuthManager } from '../github/oauthManager.js'
import { getOrbitApiBaseUrl } from '../llmMessage/orbitApiUrl.js'
import { getOrbitLlmMainServices } from '../llmMessage/orbitLlmMainServices.js'

export async function fetchOrbitUsageStats(): Promise<OrbitUsageStats> {
	const { productService, environmentService } = getOrbitLlmMainServices()
	const manager = getGitHubOAuthManager()
	const token = await manager.getAccessToken()
	const baseUrl = getOrbitApiBaseUrl(productService, environmentService)
	const res = await fetch(`${baseUrl}/api/usage`, {
		headers: { authorization: `Bearer ${token}` },
	})
	if (res.status === 401) {
		await manager.clearCredentials()
		throw new Error('Please sign in with GitHub.')
	}
	if (!res.ok) {
		throw new Error(`Failed to load usage (${res.status})`)
	}
	return await res.json() as OrbitUsageStats
}
