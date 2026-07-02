#!/usr/bin/env bash
# Build Orbit for macOS locally (no manifest update, no GitHub release).
# Usage: ./scripts/build-macos-local.sh [arm64|x64] [--dmg]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCH="${1:-arm64}"
MAKE_DMG=false
if [[ "${2:-}" == "--dmg" ]]; then
	MAKE_DMG=true
fi

echo "Orbit macOS local build: darwin-${ARCH}"

npm run buildreact
NODE_OPTIONS="--max-old-space-size=8192" npm run gulp -- "vscode-darwin-${ARCH}-min"

APP_DIR="../Orbit-darwin-${ARCH}"
if [[ ! -d "$APP_DIR" ]]; then
	echo "Expected app bundle at $APP_DIR"
	exit 1
fi

echo "Built: ${APP_DIR}/Orbit.app"

if [[ "$MAKE_DMG" == true ]]; then
	VERSION="$(node -p "require('./product.json').orbitVersion")"
	if ! command -v create-dmg >/dev/null 2>&1; then
		echo "create-dmg not found. Install with: brew install create-dmg"
		exit 1
	fi
	create-dmg \
		--volname "Orbit" \
		--window-pos 200 120 \
		--window-size 800 400 \
		--icon-size 100 \
		--app-drop-link 600 185 \
		"Orbit-${VERSION}-darwin-${ARCH}.dmg" \
		"$APP_DIR"
	echo "DMG: Orbit-${VERSION}-darwin-${ARCH}.dmg"
fi

echo "Done. To publish: ./scripts/release-local.sh ${VERSION:-$(node -p "require('./product.json').orbitVersion")} darwin-${ARCH}"