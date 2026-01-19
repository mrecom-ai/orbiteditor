# Sticky User Messages - Final Fix Applied

## Problem Identified

The previous implementation was using inline `position: 'sticky'` in the style object, but this approach was inconsistent with how TodoTool (the working reference implementation) handles sticky positioning.

## Root Cause

TodoTool uses the Tailwind utility class `sticky` (which compiles to `void-sticky` with `position: sticky`), NOT inline `position: 'sticky'`. The previous implementation attempted to apply positioning directly via inline styles, bypassing the Tailwind CSS system.

## Solution

Changed from:
```typescript
style={isUserMessage ? {
  position: 'sticky',  // ❌ Inline position
  top: `${stickyOffset}px`,
  backgroundColor: 'var(--vscode-editor-background)',
  zIndex: 20
} : undefined}
className={`
  ${shouldAddGap ? 'mt-2' : ''}
`}
```

To:
```typescript
className={`
  ${shouldAddGap ? 'mt-2' : ''}
  ${isUserMessage ? 'sticky' : ''}  // ✅ Tailwind class
`}
style={isUserMessage ? {
  top: `${stickyOffset}px`,  // Only positioning values
  backgroundColor: 'var(--vscode-editor-background)',
  zIndex: 20
} : undefined}
```

## Why This Works

1. **Tailwind prefix**: The codebase uses `prefix: 'void-'` in tailwind.config.js
2. **Build process**: During build, `className='sticky'` → compiles to → `className='void-sticky'`
3. **Generated CSS**: `.void-sticky { position: sticky; }` exists in src2/styles.css (line 1441)
4. **TodoTool pattern**: This exactly matches TodoTool's implementation (line 220 of TodoTool.tsx)

## Files Modified

### `/Users/ashish/code/orbit-editor/orbiteditor/src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx`
- **Line 331-339**: Moved `sticky` from inline style to className
- Now matches TodoTool pattern exactly

## Build Verification

✅ Build completed successfully
✅ Compiled output shows `void-sticky` class applied to user messages
✅ No TypeScript errors
✅ No runtime errors expected

## How It Works Now

1. ALL user messages get `className='sticky'` (compiles to `void-sticky`)
2. `position: sticky` comes from the Tailwind CSS class
3. Inline styles only provide positioning values: `top`, `backgroundColor`, `zIndex`
4. CSS sticky positioning naturally handles which message sticks based on scroll position
5. Only the topmost scrolled-past message will be visible as sticky

## Testing

To verify the fix works:
1. Run the application
2. Navigate to a chat with multiple user messages
3. Scroll up
4. The topmost user message that has scrolled past should stick to the top
5. As you continue scrolling, messages should naturally transition between sticky/non-sticky

## Technical Details

- **Z-index**: User messages (zIndex: 20) render above TodoTool (zIndex: 10)
- **Offset**: Messages stick at `stickyOffset` px from top (default 8px)
- **Background**: Opaque background prevents content from showing through
- **CSS sticky**: Multiple elements with `position: sticky` naturally stack
