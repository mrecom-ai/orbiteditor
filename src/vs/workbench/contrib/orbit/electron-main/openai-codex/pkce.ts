/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createHash, randomBytes } from 'crypto'

const base64UrlEncode = (buffer: Buffer) => {
	return buffer
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
}

export const generateCodeVerifier = () => {
	return base64UrlEncode(randomBytes(32))
}

export const generateCodeChallenge = (verifier: string) => {
	const hash = createHash('sha256').update(verifier).digest()
	return base64UrlEncode(hash)
}

export const generateState = () => {
	return randomBytes(16).toString('hex')
}
