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

	# Ad-hoc sign the Electron bundle INNER → OUTER. `codesign --deep` is
	# unreliable here: it can skip or mis-order the nested Helper apps and
	# frameworks, producing a seal that verifies locally but breaks the moment
	# the bundle is copied onto another Mac — which brings back the fatal
	# "Orbit.app is damaged and can't be opened" dialog. Signing each nested
	# code item explicitly, deepest first, yields a seal that survives the
	# DMG/copy round-trip.
	adhoc() { codesign --force --sign - "$@"; }

	# 1. Loose Mach-O: dynamic libs and native node addons, anywhere in the bundle.
	while IFS= read -r -d '' f; do
		adhoc "$f"
	done < <(find "$APP/Contents" -type f \( -name '*.dylib' -o -name '*.node' \) -print0)

	# 2. Nested helper .app bundles (Orbit Helper (GPU/Renderer/Plugin), crashpad, etc.):
	#    sign their inner executable(s) first, then the helper bundle itself.
	while IFS= read -r -d '' helper; do
		if [[ -d "$helper/Contents/MacOS" ]]; then
			while IFS= read -r -d '' bin; do
				adhoc "$bin"
			done < <(find "$helper/Contents/MacOS" -type f -perm -u+x -print0)
		fi
		adhoc "$helper"
	done < <(find "$APP/Contents/Frameworks" -maxdepth 1 -type d -name '*.app' -print0 2>/dev/null)

	# 3. Frameworks.
	while IFS= read -r -d '' fw; do
		adhoc "$fw"
	done < <(find "$APP/Contents/Frameworks" -maxdepth 1 -type d -name '*.framework' -print0 2>/dev/null)

	# 4. Outer app last, with the same entitlements used for real signing.
	codesign --force --sign - --entitlements "$ENTITLEMENTS" "$APP"
fi

echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP"

# Informational only: ad-hoc signatures are ALWAYS "rejected" by Gatekeeper's
# assessment (they have no verifiable publisher). That's expected and does not
# mean the seal is broken — the --verify above is the check that matters.
echo "Gatekeeper assessment (ad-hoc is expected to be 'rejected'):"
spctl -a -vv "$APP" || true

echo "Codesign OK: ${APP}"
