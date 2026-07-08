/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Strip well-known sensitive keys from a payload before logging or
 * transmitting it to telemetry (Phase 2.9 / H8 fix). Operates recursively
 * and returns a structurally similar object/array with sensitive values
 * replaced by '[REDACTED]'.
 *
 * Sensitive keys (case-insensitive substring match):
 *   - apikey, api_key
 *   - authorization
 *   - auth, auth_token, authtoken, accesstoken, access_token, refreshtoken, refresh_token
 *   - password, secret, token
 *   - requestbody, responsebody (full HTTP request/response payloads may contain credentials)
 *
 * The function is intentionally conservative: it will redact anything that
 * *contains* a sensitive substring (e.g. `anthropicApiKey` matches `apikey`).
 * The trade-off is occasional over-redaction vs. accidental secret leakage.
 *
 * This helper does not attempt to detect secrets in arbitrary string values
 * (e.g. an apiKey embedded in a long prompt). Callers should pass only
 * structured error/channel objects whose fields are known to be addressable.
 */

const REDACTED = '[REDACTED]';

const SENSITIVE_SUBSTRINGS = [
	'apikey',
	'api_key',
	'authorization',
	'auth_token',
	'authtoken',
	'accesstoken',
	'access_token',
	'refreshtoken',
	'refresh_token',
	'password',
	'secret',
	'token',
	'requestbody',
	'responsebody',
] as const;

function isSensitiveKey(key: string): boolean {
	const lower = key.toLowerCase();
	return SENSITIVE_SUBSTRINGS.some(s => lower.includes(s));
}

/**
 * Deep-clone a value while redacting sensitive fields. The result is safe
 * to log via `JSON.stringify(safeForLog(x))` or to send to telemetry.
 */
export function safeForLog<T>(value: T): T {
	return _walk(value, new WeakSet()) as T;
}

function _walk(value: unknown, seen: WeakSet<object>): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value !== 'object') {
		return value;
	}
	// Avoid infinite recursion on circular structures.
	if (seen.has(value as object)) {
		return '[Circular]';
	}
	seen.add(value as object);

	if (Array.isArray(value)) {
		return value.map(item => _walk(item, seen));
	}

	// Plain object: redact sensitive keys.
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (isSensitiveKey(k)) {
			out[k] = REDACTED;
		} else {
			out[k] = _walk(v, seen);
		}
	}
	return out;
}
