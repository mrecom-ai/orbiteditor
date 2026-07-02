#!/usr/bin/env bash
# Build and publish an Orbit release locally, then refresh update/latest.json.
#
# Usage:
#   ./scripts/release-local.sh                    # build darwin-arm64 from product.json version
#   ./scripts/release-local.sh 0.1.0 darwin-arm64 # explicit version + platform
#   SKIP_GH_RELEASE=1 ./scripts/release-local.sh  # skip GitHub release upload
#
# After publishing:
#   git add update/latest.json && git commit -m "Release v0.1.0" && git push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
	VERSION="$(node -p "require('./product.json').orbitVersion")"
fi

TAG="v${VERSION#v}"
PLATFORM="${2:-darwin-arm64}"

echo "Orbit local release: version=${VERSION} tag=${TAG} platform=${PLATFORM}"

npm run buildreact

release_darwin() {
	local arch="$1"
	NODE_OPTIONS="--max-old-space-size=8192" npm run gulp -- "vscode-darwin-${arch}-min"
	local app_dir="../Orbit-darwin-${arch}"
	if [[ ! -d "$app_dir" ]]; then
		echo "Expected app bundle at $app_dir"
		exit 1
	fi
	if command -v create-dmg >/dev/null 2>&1; then
		create-dmg \
			--volname "Orbit" \
			--window-pos 200 120 \
			--window-size 800 400 \
			--icon-size 100 \
			--app-drop-link 600 185 \
			"Orbit-${VERSION}-darwin-${arch}.dmg" \
			"$app_dir"
	else
		echo "create-dmg not installed; skipping DMG for ${arch}"
	fi
}

case "$PLATFORM" in
	darwin-arm64) release_darwin arm64 ;;
	darwin-x64) release_darwin x64 ;;
	win32-x64)
		NODE_OPTIONS="--max-old-space-size=8192" npm run gulp -- vscode-win32-x64-min
		npm run gulp -- vscode-win32-x64-inno-updater
		;;
	linux-x64)
		NODE_OPTIONS="--max-old-space-size=8192" npm run gulp -- vscode-linux-x64-min
		(cd scripts/appimage && chmod +x create_appimage.sh && ./create_appimage.sh)
		;;
	*)
		echo "Unknown platform: $PLATFORM"
		echo "Supported: darwin-arm64, darwin-x64, win32-x64, linux-x64"
		exit 1
		;;
esac

node <<'NODE' "$VERSION" "$TAG"
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
const tag = process.argv[3];
const root = process.cwd();
const manifestPath = path.join(root, 'update', 'latest.json');
const base = `https://github.com/ashish200729/orbiteditor/releases/download/${tag}`;

const manifest = {
	version,
	releasedAt: new Date().toISOString().slice(0, 10),
	assets: {
		'darwin-arm64': { url: `${base}/Orbit-${version}-darwin-arm64.dmg` },
		'darwin-x64': { url: `${base}/Orbit-${version}-darwin-x64.dmg` },
		'win32-x64': { url: `${base}/Orbit-${version}-win32-x64-setup.exe` },
		'linux-x64': { url: `${base}/Orbit-${version}-linux-x64.AppImage` },
	},
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
console.log(`Updated ${manifestPath}`);
NODE

if [[ "${SKIP_GH_RELEASE:-}" == "1" ]]; then
	echo "SKIP_GH_RELEASE=1 — skipped GitHub release upload."
elif command -v gh >/dev/null 2>&1; then
	FILES=()
	while IFS= read -r file; do
		FILES+=("$file")
	done < <(find "$ROOT" -maxdepth 1 \( -name 'Orbit-*.dmg' -o -name 'Orbit-*.exe' -o -name 'Orbit-*.AppImage' \) -print 2>/dev/null)

	if [[ ${#FILES[@]} -gt 0 ]]; then
		gh release create "$TAG" "${FILES[@]}" --title "Orbit ${VERSION}" --notes "Orbit ${VERSION} — fresh launch"
		echo "Created GitHub release ${TAG}"
	else
		echo "No release artifacts found in repo root; update/latest.json was still refreshed."
	fi
else
	echo "gh CLI not found; skipped GitHub release upload."
fi

echo ""
echo "Done."
echo "  1. Verify artifacts and GitHub release (if created)"
echo "  2. git add update/latest.json product.json && git commit -m \"Release ${TAG}\""
echo "  3. git push origin main && git push origin ${TAG}"