#!/usr/bin/env bash
# Build Orbit-<version>-darwin-<arch>.dmg from a built Orbit.app.
#
# Tries create-dmg first (styled, with icon layout). create-dmg's Finder
# AppleScript styling step is known to fail on some Macs (missing Automation
# permission for the calling terminal, or a Finder window race) — when that
# happens this falls back to a plain, unstyled DMG built directly with
# hdiutil, which is always reliable and just as valid for distribution.
#
# Usage: ./scripts/make-dmg.sh /path/to/Orbit.app Orbit-0.1.1-darwin-arm64.dmg
set -euo pipefail

APP="${1:?Usage: make-dmg.sh /path/to/Orbit.app output.dmg}"
DMG_NAME="${2:?Usage: make-dmg.sh /path/to/Orbit.app output.dmg}"

if [[ ! -d "$APP" ]]; then
	echo "make-dmg.sh: no such path: $APP" >&2
	exit 1
fi

# Callers pass either the .app bundle itself or its parent build directory
# (e.g. "../Orbit-darwin-arm64", which contains Orbit.app one level down).
# Resolve to the actual bundle so the DMG never ends up with the app nested
# inside an extra folder — auto-update's installer expects Orbit.app at the
# DMG's top level, right next to the Applications symlink.
if [[ "$APP" != *.app ]]; then
	RESOLVED_APP="$(find "$APP" -maxdepth 1 -name '*.app' -print -quit)"
	if [[ -z "$RESOLVED_APP" ]]; then
		echo "make-dmg.sh: no .app bundle found inside $APP" >&2
		exit 1
	fi
	APP="$RESOLVED_APP"
fi

rm -f "$DMG_NAME"

if command -v create-dmg >/dev/null 2>&1; then
	if create-dmg \
		--volname "Orbit" \
		--window-pos 200 120 \
		--window-size 800 400 \
		--icon-size 100 \
		--app-drop-link 600 185 \
		"$DMG_NAME" \
		"$APP"; then
		echo "make-dmg.sh: DMG created with create-dmg styling"
		exit 0
	fi
	echo "make-dmg.sh: create-dmg failed (often a Finder/Automation permission issue) — falling back to a plain DMG" >&2
fi

STAGE_PARENT="$(mktemp -d)"
STAGE="${STAGE_PARENT}/dmg-stage"
mkdir -p "$STAGE"
ditto "$APP" "$STAGE/$(basename "$APP")"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "Orbit" -srcfolder "$STAGE" -ov -format UDZO "$DMG_NAME"
rm -rf "$STAGE_PARENT"
echo "make-dmg.sh: plain DMG created (no custom icon layout)"
