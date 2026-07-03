/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { app } from 'electron';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

export function resolveMacAppBundlePath(): string {
	// process.execPath → …/Orbit.app/Contents/MacOS/Electron
	return path.resolve(path.dirname(process.execPath), '..', '..');
}

export function resolveMacInstallTarget(appName: string, currentBundlePath: string): string {
	const standard = path.join('/Applications', appName);
	if (currentBundlePath.startsWith('/Applications/')) {
		return standard;
	}

	try {
		fs.accessSync('/Applications', fs.constants.W_OK);
		return standard;
	} catch {
		return path.join(app.getPath('home'), 'Applications', appName);
	}
}

export function spawnMacDmgInstaller(opts: {
	dmgPath: string;
	appName: string;
	installTarget: string;
	currentPid: number;
	logPath: string;
}): void {
	const scriptPath = path.join(tmpdir(), `orbit-install-${Date.now()}.sh`);
	const mountPoint = path.join(tmpdir(), `orbit-mount-${Date.now()}`);

	const script = `#!/bin/bash
set -euo pipefail
LOG="${opts.logPath}"
DMG="${opts.dmgPath}"
TARGET="${opts.installTarget}"
STAGE="${opts.installTarget}.orbit-staging"
APP_NAME="${opts.appName}"
MOUNT="${mountPoint}"
PID=${opts.currentPid}

log() { echo "$(date -Iseconds) $*" >> "$LOG"; }

log "Waiting for Orbit (pid=$PID) to exit"
for _ in $(seq 1 120); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.5
done
for _ in $(seq 1 60); do
  pgrep -f "\${APP_NAME}/Contents/MacOS" >/dev/null || break
  sleep 0.5
done

log "Mounting $DMG at $MOUNT"
mkdir -p "$MOUNT"
cleanup() {
  hdiutil detach "$MOUNT" -quiet 2>/dev/null || true
  rmdir "$MOUNT" 2>/dev/null || true
}
trap cleanup EXIT
hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT" "$DMG" >/dev/null

SRC="$MOUNT/$APP_NAME"
if [[ ! -d "$SRC" ]]; then
  log "ERROR: $SRC not found on DMG"
  exit 1
fi

log "Copying to staging $STAGE"
rm -rf "$STAGE"
ditto "$SRC" "$STAGE"
xattr -dr com.apple.quarantine "$STAGE" 2>/dev/null || true

log "Replacing $TARGET"
rm -rf "$TARGET"
mv "$STAGE" "$TARGET"

log "Relaunching $TARGET"
open -n "$TARGET"

log "Done"
rm -f "$0"
`;

	fs.mkdirSync(path.dirname(opts.logPath), { recursive: true });
	fs.writeFileSync(scriptPath, script, { mode: 0o755 });

	const child = spawn('/bin/bash', [scriptPath], {
		detached: true,
		stdio: 'ignore',
	});
	child.unref();
}