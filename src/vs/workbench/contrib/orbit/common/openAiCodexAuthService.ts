/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js'
import { Emitter, Event } from '../../../../base/common/event.js'
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js'
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js'

export type OpenAiCodexAuthState = {
	isAuthenticated: boolean
	email?: string
	accountId?: string
}

export interface IOpenAiCodexAuthService {
	readonly _serviceBrand: undefined
	getState(): Promise<OpenAiCodexAuthState>
	startAuthorizationFlow(): Promise<{ authUrl: string }>
	waitForCallback(): Promise<OpenAiCodexAuthState>
	signOut(): Promise<void>
	readonly onDidChangeState: Event<OpenAiCodexAuthState>
}

export const IOpenAiCodexAuthService = createDecorator<IOpenAiCodexAuthService>('OpenAiCodexAuthService')

export class OpenAiCodexAuthService extends Disposable implements IOpenAiCodexAuthService {
	readonly _serviceBrand: undefined
	private readonly mainService: IOpenAiCodexAuthService
	private readonly _onDidChangeState = new Emitter<OpenAiCodexAuthState>()
	readonly onDidChangeState = this._onDidChangeState.event
	state: OpenAiCodexAuthState = { isAuthenticated: false }

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super()
		this.mainService = ProxyChannel.toService<IOpenAiCodexAuthService>(mainProcessService.getChannel('void-channel-openai-codex-auth'))
		this._register(this.mainService.onDidChangeState((state) => {
			this.state = state
			this._onDidChangeState.fire(state)
		}))
		void this.initialize()
	}

	private async initialize() {
		try {
			this.state = await this.mainService.getState()
			this._onDidChangeState.fire(this.state)
		}
		catch {
			this.state = { isAuthenticated: false }
		}
	}

	getState = async (): Promise<OpenAiCodexAuthState> => {
		return this.mainService.getState()
	}

	startAuthorizationFlow = async (): Promise<{ authUrl: string }> => {
		return this.mainService.startAuthorizationFlow()
	}

	waitForCallback = async (): Promise<OpenAiCodexAuthState> => {
		const state = await this.mainService.waitForCallback()
		this.state = state
		this._onDidChangeState.fire(state)
		return state
	}

	signOut = async (): Promise<void> => {
		await this.mainService.signOut()
	}
}

registerSingleton(IOpenAiCodexAuthService, OpenAiCodexAuthService, InstantiationType.Eager)
