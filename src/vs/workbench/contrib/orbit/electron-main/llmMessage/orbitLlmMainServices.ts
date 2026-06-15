/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IProductService } from '../../../../../platform/product/common/productService.js'
import { INativeEnvironmentService } from '../../../../../platform/environment/common/environment.js'
import { IMetricsService } from '../../common/metricsService.js'

let _productService: IProductService | undefined
let _environmentService: INativeEnvironmentService | undefined
let _metricsService: IMetricsService | undefined

export const initOrbitLlmMainServices = (
	productService: IProductService,
	environmentService: INativeEnvironmentService,
	metricsService: IMetricsService,
) => {
	_productService = productService
	_environmentService = environmentService
	_metricsService = metricsService
}

export const getOrbitLlmMainServices = () => {
	if (!_productService || !_environmentService || !_metricsService) {
		throw new Error('Orbit LLM main services not initialized')
	}
	return {
		productService: _productService,
		environmentService: _environmentService,
		metricsService: _metricsService,
	}
}
