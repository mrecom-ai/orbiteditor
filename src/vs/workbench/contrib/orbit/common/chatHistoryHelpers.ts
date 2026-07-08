/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

const DAY_MS = 86_400_000;

let cachedStartOfTodayMs = 0;
let cachedStartOfTodayDay = -1;

const getStartOfTodayMs = (): number => {
	const now = new Date();
	const day = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();
	if (cachedStartOfTodayDay !== day) {
		cachedStartOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		cachedStartOfTodayDay = day;
	}
	return cachedStartOfTodayMs;
};

export const getDateBucket = (ts: number): string => {
	const startOfToday = getStartOfTodayMs();
	const startOfYesterday = startOfToday - DAY_MS;
	const startOfSevenDaysAgo = startOfToday - 7 * DAY_MS;

	if (ts >= startOfToday) return 'Today';
	if (ts >= startOfYesterday) return 'Yesterday';
	if (ts >= startOfSevenDaysAgo) return 'Last 7 Days';
	return 'Older';
};