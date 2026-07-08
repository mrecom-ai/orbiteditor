/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Server } from 'http'

export type OpenAiCodexCredentials = {
	accessToken: string
	refreshToken?: string
	expiresAt: number
	email?: string
	accountId?: string
	idToken?: string
}

export type PendingAuthState = {
	state: string
	codeVerifier: string
	codeChallenge: string
	redirectUri: string
	server: Server
	resolve: (credentials: OpenAiCodexCredentials) => void
	reject: (error: Error) => void
	promise: Promise<OpenAiCodexCredentials>
	timeoutId: NodeJS.Timeout
	startedAt: number
}

export type OAuthTokenResponse = {
	access_token: string
	expires_in?: number
	refresh_token?: string
	token_type?: string
	id_token?: string
}

export type IdTokenClaims = {
	sub?: string
	email?: string
	preferred_username?: string
	upn?: string
	chatgpt_account_id?: string
	account_id?: string
	org_id?: string
	organizations?: Array<{ id?: string }>
	[claim: string]: unknown
}
