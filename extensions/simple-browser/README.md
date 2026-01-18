# Simple Browser Extension

**Notice:** This extension is bundled with Visual Studio Code. It can be disabled but not uninstalled.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Installation Requirements](#installation-requirements)
5. [Usage Guide](#usage-guide)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)
8. [Development](#development)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Simple Browser extension provides two core capabilities:

1. **In-Editor Browser** - A lightweight browser preview using an iframe embedded in a VSCode webview panel
2. **Browser Automation** - Comprehensive Puppeteer-based automation for web interactions, testing, and scraping

This extension serves as both a user-facing tool and a programmable API that other extensions can leverage for browser-based operations.

---

## Features

### 1. Simple Browser Preview

- **Embedded Browsing**: Browse websites directly within VSCode using an iframe-based webview
- **Navigation Controls**: Back, forward, reload, home buttons with full keyboard support
- **Smart URL Bar**:
  - Automatic protocol detection (adds `https://` if missing)
  - Search integration (non-URL inputs trigger Google search)
  - Security indicators (lock icon for HTTPS, unlock for HTTP)
- **Element Selection**: Click-to-select DOM elements for use in automation or chat context
- **Focus Lock Indicator**: Visual indicator when the iframe has focus (configurable)
- **Session Persistence**: Browser state persists when panels are hidden/shown
- **External Link Opener**: Right-click to open URLs in system browser

### 2. Browser Automation

Powered by Puppeteer with full Chrome/Chromium integration:

#### Navigation & Session Management
- **Auto-Session Creation**: Sessions automatically created when needed (no manual setup required)
- **Multi-Session Support**: Create and manage multiple concurrent browser sessions
- **Session Switching**: Switch between active sessions via quick pick
- **URL Navigation**: Navigate with configurable wait conditions (`load`, `domcontentloaded`, `networkidle0`, `networkidle2`)
- **History Navigation**: Programmatic back/forward navigation with state tracking
- **Page Reload**: Refresh current page while maintaining session state

#### Element Interaction
- **Click Elements**: CSS selector-based clicking with options for button type, click count, and delay
- **Type Text**: Type into input fields with configurable typing delay for human-like interaction
- **Fill Forms**: Instant form field population (faster than typing)
- **Hover Elements**: Trigger hover states for dropdown menus and tooltips
- **Focus Elements**: Set keyboard focus on specific elements
- **Select Options**: Select dropdown options by value or text
- **Wait for Selectors**: Wait for elements to appear/disappear with timeout controls

#### Data Extraction
- **Screenshot Capture**: Full-page or clipped screenshots in PNG/JPEG with quality control
- **PDF Generation**: Convert pages to PDF with customizable formatting options
- **HTML Content**: Extract full page HTML or specific element HTML
- **Text Extraction**: Get text content from entire page or specific selectors
- **Page Title**: Retrieve current page title
- **Accessibility Snapshot**: Get accessibility tree for screen reader testing

#### JavaScript Execution
- **Custom Scripts**: Execute arbitrary JavaScript in page context
- **Script Validation**: Safety checks prevent dangerous operations in safe mode
- **Common Snippets**: Pre-built scripts for common operations (get page info, find elements, etc.)
- **Timeout Control**: Configurable execution timeouts
- **Result Display**: Formatted output in dedicated output channel

#### Cookie Management
- **Get Cookies**: Retrieve all cookies or filter by URL
- **Set Cookies**: Set cookies with full attribute support (domain, path, secure, sameSite, etc.)
- **Clear Cookies**: Remove all cookies from current session

#### Advanced Features
- **Bidirectional Sync**: UI and automation stay in sync - navigate in UI or via commands, both update
- **Navigation Queue**: Sequential processing of navigation operations prevents race conditions
- **Session Health Monitoring**: Automatic dead session detection and recovery
- **Post-Click Navigation**: Detects and syncs navigation triggered by clicks
- **Statistics Tracking**: Monitor command execution, success rates, and session lifecycle
- **Viewport Control**: Set custom viewport sizes for responsive testing

### 3. Element Selection System

A Cursor-style element picker integrated into the browser UI:

- **Visual Overlay**: Screenshot-based selection with real-time highlighting
- **Hover Preview**: Element bounding boxes and labels update as you move cursor
- **Smart Selectors**: Generates robust CSS selectors using:
  - Test attributes (`data-testid`, `data-test-id`, etc.)
  - ARIA attributes (`aria-label`, `role`)
  - Stable class names (filters out generated/hash-based classes)
  - ID attributes
  - Unique attribute combinations
- **Element Metadata**: Captures tag name, ID, classes, attributes, text content, and HTML
- **Screenshots**: Captures individual element screenshots with padding
- **Sensitive Field Protection**: Refuses to capture password inputs and other sensitive fields
- **Chat Integration**: Selected elements can be added to chat context via `void.addBrowserElementSelection` command

---

## Architecture

### Core Components

#### 1. Extension Host (`extension.ts`)
- Extension activation and lifecycle management
- Command registration and routing
- Webview panel serialization/deserialization
- External URI opener for localhost URLs

#### 2. Browser Manager (`simpleBrowserManager.ts`)
- Manages active SimpleBrowserView instances
- Single active view pattern (one browser at a time)
- View restoration on reload
- Automation service integration

#### 3. Browser View (`simpleBrowserView.ts`)
- Webview panel management and HTML generation
- Message passing between webview and extension
- Element selection session lifecycle
- Navigation synchronization (UI ↔ Puppeteer)
- Session health monitoring with automatic recovery
- Navigation queue processing

#### 4. Browser Automation Service (`browserAutomationService.ts`)
- Session storage and lifecycle management
- Puppeteer command execution via `_browserAutomation.*` internal commands
- Statistics tracking and persistence
- UI sync coordination
- Post-click navigation monitoring

#### 5. Preview/Webview (`preview-src/index.ts`)
- Client-side navigation and UI controls
- URL parsing and validation (URL vs. search query detection)
- Security icon updates (HTTPS/HTTP indicators)
- Element selection overlay and interaction handling
- Message passing to extension host
- Fallback client-side history (when Puppeteer state unavailable)

#### 6. Command Modules
- **Navigation Commands** (`navigationCommands.ts`): Navigate, back, forward, reload
- **Interaction Commands** (`interactionCommands.ts`): Click, type, fill, hover, focus, select
- **Capture Commands** (`captureCommands.ts`): Screenshot, PDF, content extraction
- **Evaluation Commands** (`evaluationCommands.ts`): JavaScript execution, wait operations
- **Session Commands** (`sessionCommands.ts`): Create, close, list, switch sessions, stats
- **Cookie Commands** (`cookieCommands.ts`): Get, set, clear cookies

### Communication Flow

```
User Action in Webview
  ↓
postMessage to Extension Host
  ↓
SimpleBrowserView processes message
  ↓
Calls BrowserAutomationService method
  ↓
Executes vscode.commands.executeCommand('_browserAutomation.*')
  ↓
Main process Puppeteer handler executes
  ↓
Result returned to BrowserAutomationService
  ↓
Service updates stats, syncs UI
  ↓
postMessage back to webview if needed
```

### Navigation Synchronization

The extension maintains bidirectional sync between the iframe UI and Puppeteer sessions:

- **UI → Puppeteer**: User navigates in iframe → syncs to Puppeteer session
- **Puppeteer → UI**: Automation navigates → iframe URL updates to match
- **Queue System**: Navigation operations are queued to prevent race conditions
- **Health Monitoring**: Every 5 seconds, checks if Puppeteer session is alive
- **Auto-Recovery**: Dead sessions automatically recreated at current URL
- **Polling**: Every 500ms, checks if Puppeteer URL changed (syncs to UI)

---

## Installation Requirements

### Browser Automation Prerequisites

Browser automation features require **Chrome, Edge, or Chromium** to be installed:

#### Windows
- **Google Chrome** (Recommended): https://www.google.com/chrome/
- **Microsoft Edge**: Usually pre-installed on Windows 10/11

#### macOS
- **Google Chrome**: https://www.google.com/chrome/
- **Chromium**: https://www.chromium.org/getting-involved/download-chromium/

#### Linux
```bash
# Ubuntu/Debian
sudo apt install google-chrome-stable
# or
sudo apt install chromium-browser

# Fedora/RHEL
sudo dnf install google-chrome-stable
# or
sudo dnf install chromium
```

The extension automatically detects browser installations. If no browser is found, you'll see an error with download links.

### VSCode Version
Requires VSCode `^1.70.0` or higher.

---

## Usage Guide

### Opening the Simple Browser

**Command Palette:**
```
Simple Browser: Show
```
This opens the browser at Google homepage. You can then navigate to any URL.

**From Code:**
```typescript
vscode.commands.executeCommand('simpleBrowser.show', 'https://example.com');
```

**External URI Opener:**
The extension registers as an opener for localhost URLs (127.0.0.1, ::1, 0.0.0.0, etc.). When you click localhost links in VSCode, you'll see "Open in simple browser" as an option.

### Browser Automation Commands

All automation commands are available in the Command Palette under "Browser Automation:".

#### Creating Sessions

```typescript
// Auto-create session (recommended - happens automatically)
const result = await vscode.commands.executeCommand(
  'simpleBrowser.automation.navigate',
  undefined, // sessionId (undefined = auto-create)
  'https://example.com'
);

// Manual session creation
const sessionResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.createSession',
  'https://example.com'
);
const sessionId = sessionResult.data; // Use this for subsequent commands
```

#### Navigation

```typescript
// Navigate
await vscode.commands.executeCommand(
  'simpleBrowser.automation.navigate',
  sessionId,
  'https://example.com',
  { waitUntil: 'networkidle0', timeout: 30000 }
);

// Go back
await vscode.commands.executeCommand(
  'simpleBrowser.automation.back',
  sessionId
);

// Go forward
await vscode.commands.executeCommand(
  'simpleBrowser.automation.forward',
  sessionId
);

// Reload
await vscode.commands.executeCommand(
  'simpleBrowser.automation.reload',
  sessionId
);
```

#### Element Interaction

```typescript
// Click element
await vscode.commands.executeCommand(
  'simpleBrowser.automation.click',
  sessionId,
  'button#submit',
  { delay: 100 } // Optional: delay before click
);

// Type text
await vscode.commands.executeCommand(
  'simpleBrowser.automation.type',
  sessionId,
  'input#username',
  'myusername',
  { delay: 50 } // Optional: typing delay (human-like)
);

// Fill form (instant)
await vscode.commands.executeCommand(
  'simpleBrowser.automation.fill',
  sessionId,
  'input#email',
  'user@example.com'
);

// Hover
await vscode.commands.executeCommand(
  'simpleBrowser.automation.hover',
  sessionId,
  '.dropdown-trigger'
);

// Select dropdown option
await vscode.commands.executeCommand(
  'simpleBrowser.automation.select',
  sessionId,
  'select#country',
  'US'
);

// Wait for element
await vscode.commands.executeCommand(
  'simpleBrowser.automation.waitForSelector',
  sessionId,
  '.results',
  { visible: true, timeout: 10000 }
);
```

#### Data Extraction

```typescript
// Screenshot (returns base64)
const screenshotResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.screenshot',
  sessionId,
  {
    fullPage: true,
    type: 'png'
  }
);

// PDF (returns base64)
const pdfResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.pdf',
  sessionId,
  {
    format: 'A4',
    printBackground: true
  }
);

// Get HTML content
const contentResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.getContent',
  sessionId
);

// Extract text from element
const textResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.extractText',
  sessionId,
  '.article-content'
);

// Get page title
const titleResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.getTitle',
  sessionId
);
```

#### JavaScript Execution

```typescript
// Execute custom script
const result = await vscode.commands.executeCommand(
  'simpleBrowser.automation.evaluate',
  sessionId,
  'document.querySelectorAll("a").length',
  { timeout: 5000, safeMode: true }
);

// Interactive mode (shows quick pick with common snippets)
await vscode.commands.executeCommand(
  'simpleBrowser.automation.evaluate'
);
```

#### Cookie Management

```typescript
// Get cookies
const cookiesResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.getCookies',
  sessionId,
  ['https://example.com'] // Optional: filter by URLs
);

// Set cookies
await vscode.commands.executeCommand(
  'simpleBrowser.automation.setCookies',
  sessionId,
  [
    {
      name: 'session_token',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]
);

// Clear cookies
await vscode.commands.executeCommand(
  'simpleBrowser.automation.clearCookies',
  sessionId
);
```

#### Session Management

```typescript
// List sessions (shows quick pick)
await vscode.commands.executeCommand(
  'simpleBrowser.automation.listSessions'
);

// Switch session
await vscode.commands.executeCommand(
  'simpleBrowser.automation.switchSession',
  sessionId
);

// Close session
await vscode.commands.executeCommand(
  'simpleBrowser.automation.closeSession',
  sessionId
);

// Get statistics
const statsResult = await vscode.commands.executeCommand(
  'simpleBrowser.automation.getStats'
);
// Returns: { totalCommands, successfulCommands, failedCommands, sessions: { created, closed, active }, lastCommandTime }
```

### Element Selection

1. Click the **Target Icon** (🎯) in the browser toolbar
2. Move your cursor over the page screenshot - elements highlight as you hover
3. Click an element to add it to your chat selections
4. Press **Escape** to exit selection mode

Selected elements include:
- CSS selector (optimized for stability)
- Element screenshot (with padding)
- Element metadata (tag, ID, classes, attributes, text, HTML)
- Page URL

---

## API Reference

### Public Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `simpleBrowser.show` | `url?: string` | `void` | Opens browser at URL (default: Google) |
| `simpleBrowser.api.open` | `url: vscode.Uri, options?: ShowOptions` | `void` | Opens browser with options |
| `simpleBrowser.automation.createSession` | `url?: string, options?: SessionOptions` | `AutomationResult<string>` | Creates new session, returns session ID |
| `simpleBrowser.automation.closeSession` | `sessionId?: string` | `AutomationResult<void>` | Closes session |
| `simpleBrowser.automation.listSessions` | None | `AutomationResult<BrowserSession[]>` | Lists all sessions |
| `simpleBrowser.automation.switchSession` | `sessionId?: string` | `AutomationResult<void>` | Switches active session |
| `simpleBrowser.automation.navigate` | `sessionId?: string, url?: string, options?: NavigationOptions` | `AutomationResult<string>` | Navigates to URL, returns actual URL |
| `simpleBrowser.automation.back` | `sessionId?: string` | `AutomationResult<void>` | Go back in history |
| `simpleBrowser.automation.forward` | `sessionId?: string` | `AutomationResult<void>` | Go forward in history |
| `simpleBrowser.automation.reload` | `sessionId?: string` | `AutomationResult<void>` | Reload current page |
| `simpleBrowser.automation.click` | `sessionId?: string, selector?: string, options?: ClickOptions` | `AutomationResult<void>` | Click element |
| `simpleBrowser.automation.type` | `sessionId?: string, selector?: string, text?: string, options?: TypeOptions` | `AutomationResult<void>` | Type text into element |
| `simpleBrowser.automation.fill` | `sessionId?: string, selector?: string, value?: string` | `AutomationResult<void>` | Fill form field |
| `simpleBrowser.automation.hover` | `sessionId?: string, selector?: string` | `AutomationResult<void>` | Hover over element |
| `simpleBrowser.automation.focus` | `sessionId?: string, selector?: string` | `AutomationResult<void>` | Focus element |
| `simpleBrowser.automation.select` | `sessionId?: string, selector?: string, value?: string` | `AutomationResult<void>` | Select dropdown option |
| `simpleBrowser.automation.screenshot` | `sessionId?: string, options?: ScreenshotOptions` | `AutomationResult<string>` | Take screenshot (base64) |
| `simpleBrowser.automation.pdf` | `sessionId?: string, options?: PDFOptions` | `AutomationResult<string>` | Generate PDF (base64) |
| `simpleBrowser.automation.getContent` | `sessionId?: string` | `AutomationResult<string>` | Get page HTML |
| `simpleBrowser.automation.getTitle` | `sessionId?: string` | `AutomationResult<string>` | Get page title |
| `simpleBrowser.automation.extractText` | `sessionId?: string, selector?: string` | `AutomationResult<string>` | Extract element text |
| `simpleBrowser.automation.extractHTML` | `sessionId?: string, selector?: string` | `AutomationResult<string>` | Extract element HTML |
| `simpleBrowser.automation.snapshot` | `sessionId?: string, options?: { interestingOnly?: boolean }` | `AutomationResult<any>` | Get accessibility snapshot |
| `simpleBrowser.automation.evaluate` | `sessionId?: string, script?: string, options?: EvaluationOptions` | `AutomationResult<any>` | Execute JavaScript |
| `simpleBrowser.automation.waitForSelector` | `sessionId?: string, selector?: string, options?: WaitForSelectorOptions` | `AutomationResult<void>` | Wait for element |
| `simpleBrowser.automation.waitForNavigation` | `sessionId?: string, options?: NavigationOptions` | `AutomationResult<void>` | Wait for navigation |
| `simpleBrowser.automation.getCookies` | `sessionId?: string, urls?: string[]` | `AutomationResult<Cookie[]>` | Get cookies |
| `simpleBrowser.automation.setCookies` | `sessionId?: string, cookies?: Cookie[]` | `AutomationResult<void>` | Set cookies |
| `simpleBrowser.automation.clearCookies` | `sessionId?: string` | `AutomationResult<void>` | Clear cookies |
| `simpleBrowser.automation.getStats` | None | `AutomationResult<AutomationStats>` | Get automation statistics |

### Internal Commands (Do Not Call Directly)

These commands are used internally by the extension and should not be called by other extensions:

- `_browserAutomation.*` - Internal Puppeteer communication layer

### Types

#### AutomationResult<T>
```typescript
interface AutomationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

#### BrowserSession
```typescript
interface BrowserSession {
  id: string;
  url: string;
  createdAt: number;
}
```

#### SessionOptions
```typescript
interface SessionOptions {
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
}
```

#### NavigationOptions
```typescript
interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}
```

#### ScreenshotOptions
```typescript
interface ScreenshotOptions {
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  quality?: number;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

See `src/automation/automationTypes.ts` for complete type definitions.

---

## Configuration

### Settings

#### `simpleBrowser.focusLockIndicator.enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show/hide the "Focus Lock" indicator when the iframe has focus

### Programmatic Configuration

#### Viewport Size
```typescript
await vscode.commands.executeCommand(
  'simpleBrowser.automation.createSession',
  'https://example.com',
  {
    viewport: { width: 1920, height: 1080 }
  }
);
```

#### User Agent
```typescript
await vscode.commands.executeCommand(
  'simpleBrowser.automation.createSession',
  'https://example.com',
  {
    userAgent: 'Custom Bot 1.0'
  }
);
```

---

## Development

### Project Structure

```
simple-browser/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── simpleBrowserManager.ts   # View lifecycle management
│   ├── simpleBrowserView.ts      # Webview panel and messaging
│   ├── dispose.ts                # Disposable base class
│   └── automation/
│       ├── browserAutomationService.ts  # Puppeteer service
│       ├── automationTypes.ts           # Type definitions
│       ├── elementSelection.ts          # Element picker scripts
│       ├── utils.ts                     # Utilities
│       └── commands/
│           ├── navigationCommands.ts
│           ├── interactionCommands.ts
│           ├── captureCommands.ts
│           ├── evaluationCommands.ts
│           ├── evaluationHelpers.ts
│           ├── sessionCommands.ts
│           └── cookieCommands.ts
├── preview-src/
│   ├── index.ts     # Webview client-side code
│   └── events.ts    # Event utilities
├── media/
│   ├── index.js     # Compiled webview code
│   ├── main.css     # Webview styles
│   ├── codicon.css  # VSCode icons
│   └── *.svg        # UI icons
├── package.json     # Extension manifest
├── tsconfig.json    # TypeScript config
└── README.md        # This file
```

### Build Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Build webview preview
npm run build-preview

# Watch mode (auto-compile)
npm run watch

# Compile for web (browser-based VSCode)
npm run compile-web
```

### Testing

Run the extension in debug mode:
1. Open this folder in VSCode
2. Press F5 to launch Extension Development Host
3. Test commands in the Command Palette

### Key Design Patterns

#### Auto-Session Creation
All automation commands check for an active session. If none exists, they automatically create one using `ensureActiveSession()`. This eliminates manual session management for users.

#### Navigation Queue
Navigation operations are queued and processed sequentially to prevent race conditions. The queue handles:
- User-initiated navigation (from UI)
- Automation-initiated navigation (from commands)
- Back/forward/reload operations
- Session recovery

#### Bidirectional Sync
The extension maintains sync between UI and automation in both directions:
- **UI changes → Automation**: Detected via iframe monitoring, synced via navigation queue
- **Automation changes → UI**: Detected via polling, UI updated via postMessage

#### Message Passing
Webview ↔ Extension communication uses typed message passing:
```typescript
// Webview to Extension
vscode.postMessage({ type: 'navigate', url: '...' });

// Extension to Webview
webview.postMessage({ type: 'updateNavigationState', canGoBack: true, ... });
```

#### Element Selection
Uses a screenshot-based approach (similar to Cursor):
1. Capture full-page screenshot via Puppeteer
2. Display in overlay with interaction layer
3. On hover, evaluate script in page to get element at coordinates
4. On click, generate robust selector and capture element metadata
5. Send to chat via command

---

## Troubleshooting

### "Could not find Chrome/Chromium installation"

**Solution**: Install Google Chrome, Microsoft Edge, or Chromium (see [Installation Requirements](#installation-requirements)).

After installation, restart VSCode.

### Commands not appearing in Command Palette

**Solution**: Reload VSCode window (`Developer: Reload Window` from Command Palette).

### Session creation fails

**Causes**:
- Browser not installed or not accessible
- Browser already running with incompatible flags
- Insufficient permissions

**Solutions**:
1. Verify browser installation: Run `chrome --version` or `google-chrome --version` in terminal
2. Close all browser instances
3. Check VSCode developer console for detailed errors (Help → Toggle Developer Tools)

### Element selection not working

**Causes**:
- Session not created
- Page not loaded
- CORS/sandbox restrictions

**Solutions**:
1. Ensure page is fully loaded before starting selection
2. Check that automation session exists (create manually if needed)
3. Try navigating to a different URL (some sites block automation)

### Navigation sync issues

**Symptoms**: UI and automation out of sync, wrong URL displayed

**Solutions**:
1. Reload the page (click reload button or use `simpleBrowser.automation.reload`)
2. Close and reopen the browser panel
3. Session may be dead - check stats, create new session if needed

### "No active session" errors

This should rarely happen due to auto-session creation. If it does:
1. Manually create a session: `Browser Automation: Create Automation Session`
2. Verify browser installation
3. Check for error messages in developer console

### Screenshot/PDF generation fails

**Causes**:
- Page too large
- Timeout
- Permission issues

**Solutions**:
1. Reduce viewport size or use clipping for screenshots
2. Increase timeout in options
3. Ensure page is fully loaded before capture

### Performance issues

**Solutions**:
1. Close unused sessions (they consume resources)
2. Use `networkidle0` wait condition sparingly (can be slow)
3. Disable full-page screenshots if not needed
4. Check automation statistics to monitor command execution

### Developer Console Errors

To view detailed error messages:
1. Open VSCode Developer Tools: `Help → Toggle Developer Tools`
2. Check Console tab for errors
3. Filter by "simple-browser" or "automation" for relevant logs

---

## License

MIT License - See LICENSE.txt in the project root for details.

Copyright (c) Microsoft Corporation. All rights reserved.
