/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js'
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js'
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js'
import { INotificationActions, INotificationService, Severity } from '../../../../platform/notification/common/notification.js'
import { IOpenerService } from '../../../../platform/opener/common/opener.js'
import { IOpenAiCodexAuthService } from '../common/openAiCodexAuthService.js'
import { VOID_OPENAI_CODEX_SIGN_IN_ACTION_ID, VOID_OPENAI_CODEX_SIGN_OUT_ACTION_ID } from './actionIDs.js'

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPENAI_CODEX_SIGN_IN_ACTION_ID,
			title: 'Sign in to OpenAI Codex',
			f1: false,
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const authService = accessor.get(IOpenAiCodexAuthService)
		const openerService = accessor.get(IOpenerService)
		const notificationService = accessor.get(INotificationService)
		const clipboardService = accessor.get(IClipboardService)

		try {
			const { authUrl } = await authService.startAuthorizationFlow()
			const actions: INotificationActions = {
				primary: [
					{
						id: 'void.openAiCodex.copySignInUrl',
						label: 'Copy URL',
						tooltip: '',
						class: undefined,
						enabled: true,
						run: () => clipboardService.writeText(authUrl),
					},
					{
						id: 'void.openAiCodex.openSignInUrl',
						label: 'Open URL',
						tooltip: '',
						class: undefined,
						enabled: true,
						run: () => openerService.open(authUrl, { openExternal: true }),
					},
				],
			}
			notificationService.notify({
				severity: Severity.Info,
				message: `OpenAI Codex sign-in URL:\n${authUrl}`,
				sticky: true,
				actions,
			})
			await openerService.open(authUrl, { openExternal: true })
			const state = await authService.waitForCallback()
			if (state.isAuthenticated) {
				notificationService.info(`Signed in to OpenAI Codex${state.email ? ` as ${state.email}` : ''}.`)
			}
		}
		catch (error) {
			const message = error instanceof Error ? error.message : `${error}`
			const lower = message.toLowerCase()
			if (lower.includes('cancel') || lower.includes('access_denied') || lower.includes('cancelled')) {
				return // User cancelled, don't show error
			}
			if (lower.includes('timeout')) {
				notificationService.error('Sign-in timed out. Please try again.')
				return
			}
			notificationService.error(message)
		}
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPENAI_CODEX_SIGN_OUT_ACTION_ID,
			title: 'Sign out of OpenAI Codex',
			f1: false,
		})
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const authService = accessor.get(IOpenAiCodexAuthService)
		const notificationService = accessor.get(INotificationService)

		try {
			await authService.signOut()
			notificationService.info('Signed out of OpenAI Codex.')
		}
		catch (error) {
			const message = error instanceof Error ? error.message : `${error}`
			notificationService.error(message)
		}
	}
})
