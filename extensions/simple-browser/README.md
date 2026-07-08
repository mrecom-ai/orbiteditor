# Simple Browser Extension

**Notice:** This extension is bundled with Visual Studio Code. It can be disabled but not uninstalled.

## Overview

The Simple Browser extension is now a **thin launcher** for the integrated native browser that ships with the Orbit workbench.

The actual browser — full native Chrome rendering, navigation, and the in-page element picker — is implemented in the workbench as a `WebContentsView`-backed editor pane (see `src/vs/workbench/contrib/browserView/`). This extension exists only so that:

- existing keybindings and command-palette entries (`Simple Browser: Show`) keep working,
- the `simpleBrowser.api.open` API keeps working for other extensions,
- and the external-URI-opener integration for `localhost` links keeps working.

## Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `simpleBrowser.show` | `url?: string` | Opens the integrated native browser at `url` (defaults to Google). |
| `simpleBrowser.api.open` | `url: vscode.Uri, options?: ShowOptions` | Opens the integrated native browser at `url`. |

Both commands delegate to the workbench-internal `_browserView.openEditor` command.

## Features

The integrated native browser supports:

- **Full native rendering** — pages render in an embedded `WebContentsView`, not a sandboxed iframe.
- **Navigation** — back, forward, reload, home, and a URL bar with protocol auto-detection (bare terms become Google searches).
- **Find in page** — `Cmd/Ctrl+F` opens a find bar; `Enter`/`Shift+Enter` cycle matches; `Esc` closes.
- **Page zoom** — `Cmd/Ctrl + +` / `Cmd/Ctrl + -` / `Cmd/Ctrl + 0` (reset), plus zoom buttons in the toolbar.
- **Keyboard shortcuts** — `Alt+Left`/`Alt+Right` (back/forward), `Cmd/Ctrl+R` (reload), `Cmd/Ctrl+L` (focus address bar).
- **Element picker** — click the target icon in the toolbar to hover-highlight and pick a DOM element. The picked element (selector, metadata, screenshot) is dispatched to the chat via `void.addBrowserElementSelection`.
- **Favicons** — site favicons are shown in the address bar and persisted with the tab.
- **Connection security** — the address bar shows a lock icon for HTTPS and a warning icon for HTTP.
- **Google sign-in fallback** — when Google blocks OAuth in the embedded view, the sign-in page opens in a real top-level window sharing the same session, then the embedded tab reloads authenticated.
- **Shared session** — all browser tabs share one persistent Electron session (`persist:orbit-browser`), like a regular browser profile, so logins/cookies survive restarts and carry across tabs.
- **External opener** — "Open in external browser" button for handing a URL to the system browser.
- **Context menu** — right-click in the page for link/image/text/edit actions plus "Inspect Element".

## Internal Commands

These `_browserView.*` commands are exposed for keybinding/integration (prefixed `_` = internal):

| Command | Action |
|---------|--------|
| `_browserView.openEditor` | Open a URL in the integrated browser. |
| `_browserView.findInPage` | Open the find bar. |
| `_browserView.closeFindInPage` | Close the find bar. |
| `_browserView.zoomIn` / `_browserView.zoomOut` / `_browserView.zoomReset` | Page zoom. |
| `_browserView.goBack` / `_browserView.goForward` / `_browserView.reload` | Navigation. |
| `_browserView.focusAddressBar` | Focus the address bar. |

## Configuration

This extension no longer contributes any configuration settings. The previous
`simpleBrowser.focusLockIndicator.enabled` setting is obsolete and has been removed.

## Development

```
simple-browser/
├── src/
│   └── extension.ts      # Thin launcher: forwards to _browserView.openEditor
├── media/
│   └── icon.png          # Extension icon
├── package.json
├── tsconfig.json
└── README.md
```

Compile with the standard gulp extension pipeline:

```bash
node ../../node_modules/gulp/bin/gulp.js --gulpfile ../../build/gulpfile.extensions.js compile-extension:simple-browser ./tsconfig.json
```

There is no webview/preview bundle to build anymore — the browser UI lives in the workbench.

## License

MIT License — See LICENSE.txt in the project root for details.

Copyright (c) Microsoft Corporation. All rights reserved.
