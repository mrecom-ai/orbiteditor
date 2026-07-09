# Dependency security notes (Orbit Editor)

Last reviewed: 2026-07-09

## What we fixed in this pass

Root `npm audit` went from **84** findings (3 critical / 32 high) to **37** (0 critical / 12 high) after:

1. `npm audit fix` (no `--force`)
2. Pinning `@vscode/gulp-electron` to `1.36.0` (audit had pulled `1.42.1`, which breaks gulp via ESM `require` of `@electron/get`)
3. Raising direct ranges for `@modelcontextprotocol/sdk` (`^1.29.0`) and `mermaid` (`^11.16.0`)
4. Adding `overrides` for `form-data`, `jws`, and `zod` (`^3.25.76` — required so MCP SDK + `zod-to-json-schema` can resolve `zod/v3`)

Locked runtime versions after the pass:

| Package | Version | Notes |
|---------|---------|--------|
| `@modelcontextprotocol/sdk` | 1.29.0 | Past advisory range `<=1.25.3` |
| `mermaid` | 11.16.0 | Past prior 11.x injection advisories in audit |
| `form-data` | 4.0.6 | Via override |
| `jws` | 4.0.1 | Via override |
| `zod` | 3.25.76 | Via override (MCP compatibility) |
| `electron` | **34.3.2** | Intentionally unchanged |

## Accepted remaining risk

These remain on purpose for this pass:

| Area | Why left alone |
|------|----------------|
| **`electron@34.3.2`** | Major Chromium/native-module upgrade; separate project |
| **gulp / braces / micromatch / chokidar** | Build-tool chain; force upgrades break VS Code gulp pipeline |
| **`serialize-javascript` via mocha / copy-webpack-plugin** | No non-breaking fix available per audit |
| **`tar` via `@vscode/sqlite3` / `gulp-untar`** | Needs `--force` / breaking downgrades |
| **`next` (devDependency)** | Not the desktop app runtime |
| **`axios@1.18.1` under `posthog-node`** | Not currently flagged in root audit after this pass; still transitive |

Nested trees (`build/`, `remote/`, `extensions/`) were not force-upgraded.

## How to develop safely after install

```bash
cd orbiteditor
nvm use                 # Node 20.18.2 from .nvmrc
npm install
npm run buildreact      # required before first compile
npm run watch           # or Cmd+Shift+B
```

Launch Developer Mode. If your shell has `ELECTRON_RUN_AS_NODE=1` (common in some agent/CI environments), unset it or Electron will fail loading the `electron` module:

```bash
env -u ELECTRON_RUN_AS_NODE ./scripts/code.sh \
  --user-data-dir ./.tmp/user-data \
  --extensions-dir ./.tmp/extensions
```

## Re-audit

```bash
npm audit
```

Do **not** run `npm audit fix --force` on this tree without a full compile + launch smoke test afterward.
