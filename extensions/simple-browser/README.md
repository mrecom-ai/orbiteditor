# Simple Browser with Browser Automation

**Notice:** This extension is bundled with Visual Studio Code. It can be disabled but not uninstalled.

## Overview

Provides a simple browser preview using an iframe embedded in a webview, along with comprehensive browser automation capabilities powered by Puppeteer. This extension can be used by other extensions for showing web content and automating browser interactions.

## Features

### 1. Simple Browser
- Browse websites directly within VSCode
- Clean, minimal interface with navigation controls
- Address bar with security indicators
- Focus lock indicator

### 2. Browser Automation 🎯
- **Live UI Sync**: Watch automation happen in real-time with visual feedback
- **Automated Testing**: Automate web interactions for testing
- **Web Scraping**: Extract data from websites programmatically
- **Form Automation**: Fill and submit forms automatically
- **Screenshot Capture**: Take screenshots of web pages
- **PDF Generation**: Generate PDFs from web pages
- **JavaScript Evaluation**: Execute custom JavaScript in page context
- **Cookie Management**: Get, set, and clear cookies
- **Visual Overlays**: Beautiful animations showing automation activity

## ⚠️ Requirements for Browser Automation

Browser automation features require **Google Chrome, Microsoft Edge, or Chromium** to be installed on your system:

### Windows
- **Google Chrome** (Recommended): [Download](https://www.google.com/chrome/)
- **Microsoft Edge**: Usually pre-installed on Windows 10/11

### macOS
- **Google Chrome**: [Download](https://www.google.com/chrome/)
- **Chromium**: [Download](https://www.chromium.org/getting-involved/download-chromium/)

### Linux
```bash
# Ubuntu/Debian
sudo apt install google-chrome-stable
# or
sudo apt install chromium-browser
```

The extension automatically detects your browser installation.

## Usage

### Simple Browser
Open any URL in the simple browser:
```
Command Palette → Simple Browser: Show
```

### Browser Automation

#### Available Commands
- `Browser Automation: Create Automation Session` - Create a new browser session
- `Browser Automation: Navigate to URL` - Navigate to a URL (auto-creates session if needed)
- `Browser Automation: Go Back/Forward/Reload` - Navigation controls
- `Browser Automation: Click Element` - Click elements by CSS selector
- `Browser Automation: Type Text` - Type into input fields
- `Browser Automation: Take Screenshot` - Capture screenshots
- `Browser Automation: Get Page Content` - Extract HTML content
- `Browser Automation: View Automation Statistics` - View usage stats
- And many more...

#### Quick Start

1. Run any automation command - a session will be auto-created if needed
2. Navigate to your target URL
3. Interact with the page using automation commands
4. View statistics to monitor your automation usage

For complete documentation, see `BROWSER_AUTOMATION_GUIDE.md`.

## Troubleshooting

### "Could not find Chrome/Chromium installation"

**Solution**: Install Google Chrome, Microsoft Edge, or Chromium:
- Windows: [Download Chrome](https://www.google.com/chrome/) or use pre-installed Edge
- macOS: [Download Chrome](https://www.google.com/chrome/)
- Linux: Use your package manager (see Requirements above)

After installation, restart VSCode.

### Other Issues

1. **Commands not appearing**: Reload VSCode after installation
2. **Session creation fails**: Verify Chrome/Edge/Chromium is installed and accessible
3. **No active session error**: Should auto-create sessions now. If persists, create manually

Check the VSCode Developer Tools (Help → Toggle Developer Tools) for detailed error messages.

## Features in Detail

### Live UI Sync 🎬 **NEW!**
Watch ALL automation commands happen in real-time:
- **Visual overlays** show every automation action (22+ commands)
- **Navigation sync** - browser follows automation navigation
- **Action feedback** - clicking, typing, filling, hovering, and more
- **Data operations** - screenshots, PDFs, content extraction
- **Cookie management** - get, set, clear with visual feedback
- **Animated indicators** with smooth animations
- **Auto-dismissing** notifications that don't block your view
- **Beautiful design** that matches VSCode themes

### Auto-Session Creation ✨
No manual session management required! Sessions are automatically created when you run automation commands without an active session.

### Statistics Tracking 📊
Monitor your automation usage with detailed statistics:
- Total commands executed
- Success/failure rates
- Active sessions count
- Command execution history

### Smart Error Handling 🛡️
- Clear, actionable error messages
- Progress indicators for operations
- Helpful links to download Chrome if missing
- Automatic retry suggestions

### Cross-Platform Support 🌍
Works on Windows, macOS, and Linux with automatic browser detection.

## Programmatic Usage

Other extensions can use the automation API:

```typescript
import * as vscode from 'vscode';

// Create session and navigate
const result = await vscode.commands.executeCommand(
    'simpleBrowser.automation.navigate',
    undefined, // sessionId (auto-creates if undefined)
    'https://example.com'
);

// Click element
await vscode.commands.executeCommand(
    'simpleBrowser.automation.click',
    undefined,
    '#button-selector'
);
```

## Documentation

- **User Guide**: `BROWSER_AUTOMATION_GUIDE.md` - Comprehensive usage guide
- **UI Sync Guide**: `UI_SYNC_IMPROVEMENTS.md` - Live visual feedback features
- **Technical Details**: `FIXES_SUMMARY.md` - Architecture and technical information
- **Production Ready**: `PRODUCTION_READY.md` - Deployment checklist

## License

MIT License
