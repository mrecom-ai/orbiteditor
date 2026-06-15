/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IProductService } from '../../../../../platform/product/common/productService.js'
import { INativeEnvironmentService } from '../../../../../platform/environment/common/environment.js'

export function getOrbitApiBaseUrl(
	productService: IProductService,
	environmentService: INativeEnvironmentService,
): string {
	if (process.env.ORBIT_API_URL) {
		return process.env.ORBIT_API_URL.replace(/\/$/, '')
	}
	// Dev builds (./scripts/code.sh) use the local backend; release builds use production.
	if (!environmentService.isBuilt) {
		return (productService.orbitApiUrlDev ?? 'http://localhost:8080').replace(/\/$/, '')
	}
	if (productService.orbitApiUrl) {
		return productService.orbitApiUrl.replace(/\/$/, '')
	}
	return 'https://api.orbiteditor.com'
}
