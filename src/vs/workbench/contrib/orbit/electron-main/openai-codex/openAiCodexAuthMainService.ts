/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js'
import { Emitter } from '../../../../../base/common/event.js'
import { ILogService } from '../../../../../platform/log/common/log.js'
import { IEncryptionMainService } from '../../../../../platform/encryption/common/encryptionService.js'
import { IApplicationStorageMainService } from '../../../../../platform/storage/electron-main/storageMainService.js'
import { IOpenAiCodexAuthService, OpenAiCodexAuthState } from '../../common/openAiCodexAuthService.js'
import { initOpenAiCodexOAuthManager } from './oauthManager.js'

export class OpenAiCodexAuthMainService extends Disposable implements IOpenAiCodexAuthService {
	_serviceBrand: undefined
	private readonly manager

	private readonly _onDidChangeState = new Emitter<OpenAiCodexAuthState>()
	readonly onDidChangeState = this._onDidChangeState.event

	constructor(
		@IApplicationStorageMainService private readonly storageService: IApplicationStorageMainService,
		@IEncryptionMainService private readonly encryptionService: IEncryptionMainService,
		@ILogService private readonly logService: ILogService,
	) {
		super()
		this.manager = initOpenAiCodexOAuthManager({
			storageService: this.storageService,
			encryptionService: this.encryptionService,
			logService: this.logService,
		})
		this._register(this.manager.onDidChangeState((state) => {
			this._onDidChangeState.fire(state)
		}))
	}

	async getState(): Promise<OpenAiCodexAuthState> {
		return this.manager.getState()
	}

	async startAuthorizationFlow(): Promise<{ authUrl: string }> {
		const authUrl = await this.manager.startAuthorizationFlow()
		return { authUrl }
	}

	async waitForCallback(): Promise<OpenAiCodexAuthState> {
		return this.manager.waitForCallback()
	}

	async signOut(): Promise<void> {
		await this.manager.clearCredentials()
	}
}
