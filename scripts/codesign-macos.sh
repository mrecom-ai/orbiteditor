#!/usr/bin/env bash
# Code-sign a built Orbit.app bundle.
#
# Without MACOS_CODESIGN_IDENTITY set: ad-hoc signs the bundle (free, no Apple
# Developer account needed). This is enough to stop macOS Gatekeeper's fatal
# "<App> is damaged and can't be opened" dialog on Apple Silicon, but the app
# will still show the milder "Apple could not verify this app is free from
# malware" prompt on first launch until it is signed with a real Developer ID
# and notarized by Apple.
#
# With MACOS_CODESIGN_IDENTITY set (a "Developer ID Application: ..." identity
# string from `security find-identity -v -p codesigning`): signs with hardened
# runtime + timestamp + entitlements, ready for notarization.
#
# Usage: ./scripts/codesign-macos.sh /path/to/Orbit.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:?Usage: codesign-macos.sh /path/to/Orbit.app}"
ENTITLEMENTS="${ROOT}/build/entitlements/orbit-darwin.entitlements.plist"

if [[ ! -d "$APP" ]]; then
	echo "codesign-macos.sh: no such app bundle: $APP" >&2
	exit 1
fi

if [[ -n "${MACOS_CODESIGN_IDENTITY:-}" ]]; then
	echo "Signing ${APP} with identity: ${MACOS_CODESIGN_IDENTITY}"
	codesign --force --deep --options runtime --timestamp \
		--entitlements "$ENTITLEMENTS" \
		--sign "$MACOS_CODESIGN_IDENTITY" \
		"$APP"
else
	echo "WARNING: No MACOS_CODESIGN_IDENTITY set — ad-hoc signing only." >&2
	echo "WARNING: App will show 'unidentified developer' on first launch until a real Developer ID + notarization is configured." >&2
	codesign --force --deep --sign - "$APP"
fi

echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP"
echo "Codesign OK: ${APP}"
