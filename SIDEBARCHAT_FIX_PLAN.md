# SidebarChat.tsx Bug Fix Plan

## Issues Identified

### 1. **Approval Buttons Not Showing for edit_file/rewrite_file**

**Root Cause**: 
- In `EditToolCardHeader` component (line ~2747), approval buttons are only rendered when:
  ```jsx
  {!isRunning && params?.uri && content && (
    // approval buttons
  )}
  ```
- However, when a tool is in `tool_request` state, `isRunning` is set to `true` (line 1043):
  ```jsx
  const isRunning = toolMessage.type === 'running_now' || toolMessage.type === 'tool_request'
  ```
- This creates a logical contradiction: approval buttons should show for `tool_request`, but the button container only renders when `!isRunning`

**Impact**: Users never see approval buttons for edit_file/rewrite_file tools, making it impossible to approve/reject these operations.

**Fix Required**:
- Add a separate rendering path for `tool_request` state that shows:
  1. The tool header with file information
  2. The approval buttons (Approve/Cancel)
  3. The auto-approval toggle
- The approval buttons should be shown INSTEAD of the copy/jump buttons that appear after successful execution

### 2. **Stream Tool Sometimes Not Working**

**Root Cause Analysis**:

#### Issue 2a: State Transition Handling
- When a tool transitions from `tool_request` → `running_now` → `success`, the component may not properly handle the state changes
- The `EditTool` component treats both `tool_request` and `running_now` as `isRunning=true`, which can cause UI state confusion

#### Issue 2b: Content Rendering Logic
- In `EditTool` (line 1047), content is only shown when `hasContent` is true:
  ```jsx
  const hasContent = !!(content && content.trim().length > 0)
  ```
- During streaming, content might not be passed down properly from the streaming state
- The `content` parameter comes from the ResultWrapper but isn't connected to live streaming state

#### Issue 2c: Component Re-rendering
- The `EditTool` component uses `React.memo`, which might prevent re-renders during streaming
- The streaming content flows through a different path (`StreamingTool` component) than the committed tools (`EditTool`)
- When a streaming tool commits, there may be a rendering gap

#### Issue 2d: Key Stability
- In the message rendering loop (line ~5197), the key for streaming tools is:
  ```jsx
  const toolKey = tool.name
    ? `streaming-${tool.name}-${tool.rawParams?.uri || i}`
    : `streaming-unknown-${i}`
  ```
- If `rawParams.uri` changes during streaming, React will unmount/remount the component

## Detailed Fixes

### Fix 1: Add Approval Button Rendering for edit_file/rewrite_file

**Location**: `EditToolCardHeader` component (~line 2680-2790)

**Changes**:
1. Extract approval button logic to separate conditional
2. Add check for `toolMessage.type === 'tool_request'`
3. Render approval buttons with proper styling when in tool_request state
4. Keep existing copy/jump buttons for successful completions

**Implementation**:
```jsx
// In EditToolCardHeader, after the left side (title + file name):

{/* Right: Action buttons */}
<div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
  {/* Show approval buttons when awaiting approval */}
  {toolMessage.type === 'tool_request' && (
    <ToolRequestAcceptRejectButtons 
      toolName={toolMessage.name} 
      toolId={toolMessage.id} 
      threadId={threadId} 
    />
  )}
  
  {/* Show copy/jump buttons after successful execution */}
  {toolMessage.type === 'success' && params?.uri && content && (
    <EditToolHeaderButtons
      applyBoxId={getApplyBoxId({ threadId, messageIdx, tokenIdx: 'N/A' })}
      uri={params.uri}
      codeStr={content}
      toolName={toolMessage.name}
      threadId={threadId}
    />
  )}
</div>
```

### Fix 2: Improve Streaming State Management

**Location 1**: `EditTool` component (~line 1041-1120)

**Changes**:
1. Separate `isRunning` into `isAwaiting` and `isExecuting` states
2. Fix content display logic to handle streaming properly
3. Add better state transition handling

**Implementation**:
```jsx
const EditTool = React.memo(({ toolMessage, threadId, messageIdx, content }: ...) => {
  const accessor = useAccessor()
  
  // More granular state tracking
  const isAwaiting = toolMessage.type === 'tool_request'
  const isExecuting = toolMessage.type === 'running_now'
  const isRunning = isAwaiting || isExecuting
  const isRejected = toolMessage.type === 'rejected'
  const isError = toolMessage.type === 'tool_error'
  const isSuccess = toolMessage.type === 'success'
  
  // ... rest of component
```

**Location 2**: Streaming Tool Transition

**Problem**: When streaming completes and becomes a committed message, there's no smooth transition

**Changes**:
1. Add a unique identifier that persists across state transitions
2. Use the tool's `id` field (if available) as part of the key
3. Ensure the streaming → committed transition doesn't cause a visual "pop"

**Implementation**: Update message key generation
```jsx
// In previousMessagesHTML useMemo (line ~5121):
return (
  <div key={`msg-${i}-${group.message.role}-${(group.message as any).id || ''}`}>
    // ... ChatBubble
  </div>
)
```

### Fix 3: Improve EditToolCardHeader Rendering Logic

**Location**: `EditToolCardHeader` component

**Changes**:
1. Show different visual states clearly: awaiting, running, success, error
2. Don't show chevron/collapse when awaiting approval (no content yet)
3. Add visual indicator for awaiting approval state

**Implementation**:
```jsx
const EditToolCardHeader = ({ toolMessage, isRunning, threadId, messageIdx, content, isExpanded, onToggleExpand, hasContent }) => {
  const accessor = useAccessor()
  const title = getTitle(toolMessage)
  
  const isAwaiting = toolMessage.type === 'tool_request'
  const isExecuting = toolMessage.type === 'running_now'
  const isCompleted = toolMessage.type === 'success' || toolMessage.type === 'tool_error' || toolMessage.type === 'rejected'
  
  // ... rest of logic

  return (
    <div className={`...`} onClick={hasContent ? onToggleExpand : undefined}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Only show chevron when there's content to expand */}
        {hasContent && !isAwaiting && (
          <ChevronRight className={`... ${isExpanded ? 'rotate-90' : ''}`} size={13} />
        )}
        
        {/* Status icon */}
        {isAwaiting && <CirclePlus size={14} className='text-void-fg-3 flex-shrink-0' />}
        
        {/* Title with shimmer only when executing */}
        <span className={`... ${isExecuting && !hasContent ? 'shimmer-text' : ''}`}>
          {title}
        </span>
        
        {/* File name */}
        {desc1 && ...}
      </div>
      
      {/* Action buttons - FIXED LOGIC */}
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Approval buttons for pending requests */}
        {isAwaiting && (
          <ToolRequestAcceptRejectButtons 
            toolName={toolMessage.name} 
            toolId={toolMessage.id} 
            threadId={threadId} 
          />
        )}
        
        {/* Copy/apply buttons for completed executions */}
        {isCompleted && !isAwaiting && params?.uri && content && (
          <EditToolHeaderButtons ... />
        )}
      </div>
    </div>
  )
}
```

### Fix 4: Improve Error Handling and Edge Cases

**Changes**:
1. Handle case where `params` is undefined during early streaming
2. Add null checks for `toolMessage.id`
3. Handle rapid state transitions gracefully
4. Add console warnings for debugging

**Implementation**: Add defensive checks throughout
```jsx
// In ToolRequestAcceptRejectButtons
const toolId = toolMessage.id
if (!toolId) {
  console.warn('ToolRequestAcceptRejectButtons: Missing tool ID')
  return null
}
```

## Testing Checklist

After implementing fixes, verify:

### Approval Buttons
- [ ] Approval buttons show immediately when edit_file/rewrite_file is requested
- [ ] Approve button correctly approves and starts execution
- [ ] Cancel button correctly rejects the tool
- [ ] Auto-approval toggle shows and works correctly
- [ ] Buttons are disabled when another tool is pending (isDifferentPending check)
- [ ] Buttons show for both edit_file and rewrite_file

### Streaming Tools
- [ ] Streaming indicator appears immediately when tool starts generating
- [ ] File name appears as soon as it's available in the stream
- [ ] Code content streams in smoothly without flickering
- [ ] Shimmer animation shows while waiting for content
- [ ] Transition from streaming → committed is smooth (no visual pop)
- [ ] Multiple rapid tool calls don't cause rendering issues
- [ ] Error states display correctly

### Edge Cases
- [ ] Very long file names truncate properly
- [ ] Tools with no content show minimal UI
- [ ] Rapid approve/cancel doesn't cause state confusion
- [ ] Component handles missing params gracefully
- [ ] Works correctly in parallel tool groups
- [ ] Checkpoint/restore doesn't break approval state

## Implementation Priority

1. **HIGH**: Fix approval buttons for edit_file/rewrite_file (Fix 1)
2. **HIGH**: Fix EditToolCardHeader rendering logic (Fix 3)
3. **MEDIUM**: Improve streaming state management (Fix 2)
4. **MEDIUM**: Add error handling (Fix 4)

## Files to Modify

- `/src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx`
  - `EditToolCardHeader` component (~line 2680)
  - `EditTool` component (~line 1041)
  - Message key generation (~line 5121)

## Risks and Considerations

1. **Backward Compatibility**: Changes to component state management could affect other parts of the chat UI
2. **Performance**: Adding more conditional rendering may impact performance with many tools
3. **State Synchronization**: Need to ensure approval button state stays in sync with stream state
4. **CSS Classes**: Existing Tailwind classes might conflict with new styling

## Success Criteria

✅ Approval buttons consistently show for all edit_file/rewrite_file tool requests
✅ Users can approve/reject tools without any UI confusion
✅ Streaming tools display smoothly from start to finish
✅ No console errors or warnings during normal operation
✅ All existing tests continue to pass
