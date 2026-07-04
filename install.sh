#!/usr/bin/env bash
# Install Orbit on macOS via curl/script instead of a browser-downloaded DMG.
#
# Why: macOS only tags a file with the com.apple.quarantine xattr when it is
# downloaded through a browser (Safari/Chrome/etc). Gatekeeper's "Apple could
# not verify this app is free of malware" prompt fires off that tag. A file
# fetched with curl never gets tagged, so installing this way skips the
# prompt entirely — no Apple Developer ID / notarization required.
#
# Usage:
#   ./scripts/install-macos.sh                  # fetch latest release per update/latest.json
#   LOCAL_DMG=./Orbit-0.1.0-darwin-arm64.dmg ./scripts/install-macos.sh   # test with a local DMG, no download
set -euo pipefail

ARCH="$(uname -m)"
case "$ARCH" in
	arm64) PLATFORM_KEY="darwin-arm64" ;;
	x86_64) PLATFORM_KEY="darwin-x64" ;;
	*) echo "install-macos.sh: unsupported arch: $ARCH" >&2; exit 1 ;;
esac

MANIFEST_URL="${MANIFEST_URL:-https://raw.githubusercontent.com/ashish200729/orbiteditor/main/update/latest.json}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ -n "${LOCAL_DMG:-}" ]]; then
	echo "Using local DMG (no network fetch, no quarantine involved): ${LOCAL_DMG}"
	DMG_PATH="$LOCAL_DMG"
	if [[ ! -f "$DMG_PATH" ]]; then
		echo "install-macos.sh: no such file: $DMG_PATH" >&2
		exit 1
	fi
else
	echo "Fetching manifest: ${MANIFEST_URL}"
	curl -fsSL "$MANIFEST_URL" -o "${WORKDIR}/latest.json"

	URL="$(node -p "require('${WORKDIR}/latest.json').assets['${PLATFORM_KEY}'].url")"
	SHA256_EXPECTED="$(node -p "require('${WORKDIR}/latest.json').assets['${PLATFORM_KEY}'].sha256")"
	VERSION="$(node -p "require('${WORKDIR}/latest.json').version")"

	if [[ -z "$URL" || "$URL" == "undefined" ]]; then
		echo "install-macos.sh: no asset for ${PLATFORM_KEY} in manifest" >&2
		exit 1
	fi

	DMG_PATH="${WORKDIR}/orbit.dmg"
	echo "Downloading Orbit ${VERSION} (${PLATFORM_KEY}) via curl..."
	curl -fsSL "$URL" -o "$DMG_PATH"

	echo "Verifying checksum..."
	SHA256_ACTUAL="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
	if [[ "$SHA256_ACTUAL" != "$SHA256_EXPECTED" ]]; then
		echo "install-macos.sh: checksum mismatch — expected ${SHA256_EXPECTED}, got ${SHA256_ACTUAL}" >&2
		exit 1
	fi
	echo "Checksum OK."
fi

echo "Mounting DMG..."
MOUNT_POINT="${WORKDIR}/mnt"
mkdir -p "$MOUNT_POINT"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

APP_SRC="${MOUNT_POINT}/Orbit.app"
if [[ ! -d "$APP_SRC" ]]; then
	hdiutil detach "$MOUNT_POINT" -quiet || true
	echo "install-macos.sh: Orbit.app not found inside DMG" >&2
	exit 1
fi

echo "Installing to /Applications..."
rm -rf "/Applications/Orbit.app"
cp -R "$APP_SRC" "/Applications/Orbit.app"

hdiutil detach "$MOUNT_POINT" -quiet

# Belt-and-suspenders: strip quarantine in case it snuck in anyway.
xattr -cr "/Applications/Orbit.app"

echo "Verifying no quarantine flag..."
if xattr -p com.apple.quarantine "/Applications/Orbit.app" >/dev/null 2>&1; then
	echo "WARNING: quarantine flag still present — Gatekeeper prompt may still appear." >&2
else
	echo "No quarantine flag — should launch with no Gatekeeper prompt."
fi

echo "Done. Launch: open /Applications/Orbit.app"
