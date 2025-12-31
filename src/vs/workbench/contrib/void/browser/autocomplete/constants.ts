/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { isWindows } from '../../../../../base/common/platform.js';

export const allLinebreakSymbols = ['\r\n', '\n']
export const _ln = isWindows ? allLinebreakSymbols[0] : allLinebreakSymbols[1]

export const DEBOUNCE_TIME = 200 // Reduced from 500ms for faster response
export const DEBOUNCE_TIME_FAST = 100 // Even faster when cache hit is likely
export const TIMEOUT_TIME = 60000
export const MAX_CACHE_SIZE = 20
export const MAX_PENDING_REQUESTS = 2
export const MAX_TRIM_CACHE_SIZE = 100
