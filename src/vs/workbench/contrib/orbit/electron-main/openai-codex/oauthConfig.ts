/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const OPENAI_CODEX_OAUTH_CONFIG = {
	authorizationEndpoint: 'https://auth.openai.com/oauth/authorize',
	tokenEndpoint: 'https://auth.openai.com/oauth/token',
	clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
	scopes: 'openid profile email offline_access',
	callbackHost: 'localhost',
	callbackPort: 1455,
	callbackPath: '/auth/callback',
	authTimeoutMs: 5 * 60 * 1000,
	storageKey: 'openai-codex-oauth-credentials',
	originatorHeader: 'roo-code',
	codexSimplifiedFlow: 'true',
} as const
