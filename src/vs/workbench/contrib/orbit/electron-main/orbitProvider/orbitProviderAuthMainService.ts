/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js'
import { Emitter } from '../../../../../base/common/event.js'
import type { IOrbitProviderAuthService, OrbitProviderAuthState } from '../../common/orbitProviderAuthService.js'
import { IGitHubAuthService as IGitHubAuthServiceDecorator, type IGitHubAuthService } from '../../common/githubAuthService.js'

export class OrbitProviderAuthMainService extends Disposable implements IOrbitProviderAuthService {
	_serviceBrand: undefined
	private readonly _onDidChangeState = new Emitter<OrbitProviderAuthState>()
	readonly onDidChangeState = this._onDidChangeState.event

	constructor(
		@IGitHubAuthServiceDecorator private readonly gitHubAuthService: IGitHubAuthService,
	) {
		super()
		this._register(this.gitHubAuthService.onDidChangeState((s) => this._onDidChangeState.fire(s)))
	}

	getState = () => this.gitHubAuthService.getState()

	getAccessToken = () => this.gitHubAuthService.getAccessToken()

	startAuthorizationFlow = () => this.gitHubAuthService.startAuthorizationFlow()

	waitForCallback = () => this.gitHubAuthService.waitForCallback()

	signOut = () => this.gitHubAuthService.signOut()
}
