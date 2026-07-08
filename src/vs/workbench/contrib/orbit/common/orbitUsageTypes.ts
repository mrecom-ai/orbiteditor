/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type OrbitModelUsageBreakdown = {
	model: string
	llmRequests: number
	inputTokens: number
	outputTokens: number
}

export type OrbitUsagePeriodStats = {
	totalRequests: number
	totalLlmRequests: number
	totalInputTokens: number
	totalOutputTokens: number
	byModel: OrbitModelUsageBreakdown[]
}

export type OrbitUsageStats = {
	totalRequests: number
	totalLlmRequests: number
	totalInputTokens: number
	totalOutputTokens: number
	lastRequestAt: string | null
	byModel: OrbitModelUsageBreakdown[]
	last30Days: OrbitUsagePeriodStats
	limits: {
		plan: string
		monthlyTokens: number | null
	}
	remaining30Days: {
		tokens: number | null
	}
}
