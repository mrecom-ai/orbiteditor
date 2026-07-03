#!/usr/bin/env bash
# Notarize + staple a built Orbit DMG with Apple.
#
# No-ops (with a log message) unless real Apple notarization credentials are
# present, so it's safe to call from every build path today even without an
# Apple Developer account — it activates automatically once these env vars
# (or GitHub Actions secrets of the same name) are set:
#   APPLE_ID                    Apple ID email used for the Developer account
#   APPLE_TEAM_ID                Apple Developer Team ID
#   APPLE_APP_SPECIFIC_PASSWORD  App-specific password for notarytool
#
# Usage: ./scripts/notarize-macos.sh /path/to/Orbit.dmg
set -euo pipefail

DMG="${1:?Usage: notarize-macos.sh /path/to/Orbit.dmg}"

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_TEAM_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
	echo "notarize-macos.sh: APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD not set — skipping notarization."
	echo "notarize-macos.sh: the DMG is ad-hoc signed only; see docs/BUILD_MACOS.md to enable real notarization."
	exit 0
fi

if [[ ! -f "$DMG" ]]; then
	echo "notarize-macos.sh: no such file: $DMG" >&2
	exit 1
fi

echo "Submitting ${DMG} to Apple notary service..."
xcrun notarytool submit "$DMG" \
	--apple-id "$APPLE_ID" \
	--team-id "$APPLE_TEAM_ID" \
	--password "$APPLE_APP_SPECIFIC_PASSWORD" \
	--wait

echo "Stapling notarization ticket..."
xcrun stapler staple "$DMG"

echo "Notarization OK: ${DMG}"
