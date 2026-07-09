# Changelog

All notable changes to Orbit Editor are documented here.

## 0.1.2

### 🌐 A browser your agent can actually use

Orbit now has a real, built-in browser that the AI agent drives for you — no setup, no separate steps.

- **It opens itself when the agent needs it.** Ask the agent to "open cursor.com" or "go to a site and check something," and a browser tab appears, loads the page, and the agent takes over from there. If nothing is open yet, Orbit opens it automatically — you never have to open the browser first.
- **No interruptions.** The agent can open pages and work in the browser without stopping to ask for permission every step, so tasks flow start to finish.
- **The agent can see and act on the page.** It reads what's on screen and can navigate, click, type, fill forms, scroll, and capture screenshots — across multiple tabs — to get things done.
- **You can jump in anytime.** When the agent is driving a tab, a **Take Control** button lets you grab the wheel instantly.
- **Stays signed in.** Tabs keep your logins between sessions, so you're not re-authenticating every time.

### 🐛 Fixes

- **Browser tabs now render reliably.** Fixed a black screen that could appear when opening a browser tab — pages now show up right away.
- **Smoother agent hand-off to the browser.** Opening a page from the agent is now instant and dependable instead of occasionally stalling.
- **Cleaner chat input.** Removed the extra label from the chat toolbar for a tidier, simpler input area.

### macOS install

- **Recommended (no Gatekeeper warning):**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/ashish200729/orbiteditor/main/install.sh | bash
  ```
- **Or download the `.dmg`** from the release, drag Orbit to Applications, then run once:
  ```bash
  xattr -cr /Applications/Orbit.app
  ```
  (Orbit isn't notarized by Apple yet, so a browser-downloaded `.dmg` shows a one-time "unverified developer" prompt; the command above clears it.)

## 0.1.1

- Integrated browser and earlier improvements.

## 0.1.0

- Initial public beta of Orbit Editor for macOS (Apple Silicon and Intel).
