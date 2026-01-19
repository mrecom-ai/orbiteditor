# 1code-style Todo Tool Rendering Implementation

## Summary

This implementation adds inline todo rendering to the chat transcript, inspired by 21st-dev/1code. Todo tool calls now render with a dedicated component that distinguishes between "creation" (first call) and "update" (subsequent calls) behaviors.

## Files Modified

### 1. **New Files Created**

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/components/toolResults/TodoTool.tsx`
- **Purpose**: Main todo rendering component
- **Key Features**:
  - `TodoStatusIcon`: Displays status with appropriate icons (Check, Loader, Circle, X)
  - `TodoItemRow`: Individual todo item with status icon and text
  - `getUpdateDescription`: Helper function to generate update description text
  - `TodoListFull`: Expandable full todo list UI for creation calls
  - `ProgressCircle`: Pie-style progress visualization showing completed tasks
  - `TodoTool`: Main component that renders creation mode
  - `TodoToolWithState`: Wrapper that integrates with TodoContext and uses ToolHeaderWrapper for updates
- **Update Rendering**: Uses standard `ToolHeaderWrapper` component for consistent styling with other tools
- **Sticky Positioning**: Creation block includes dynamic sticky positioning that measures user message height and adjusts offset accordingly

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/contexts/TodoContext.tsx`
- **Purpose**: Context provider for managing todo state across chat threads
- **Key Features**:
  - Maintains todo state per thread (thread ID keyed)
  - Tracks which tool call was the "creation" call via `creationToolCallId`
  - Prevents flicker during streaming by not committing partial state
  - Registers creation element for sticky positioning
  - Cleans up old thread state to prevent memory leaks
  - **Update Counter**: Increments on each state update to trigger re-renders of all consumers
  - **useMemo**: Context value memoized with updateCounter to ensure new reference on updates

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/hooks/useStickyOffset.ts`
- **Purpose**: Hook to measure and set CSS variable for sticky positioning
- **Features**: Measures user message height and sets `--todo-sticky-offset` CSS variable
- **Note**: This file was created but ultimately the measurement logic was moved inline into TodoListFull for simplicity

### 2. **Modified Files**

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/constants/builtinToolNameToComponent.tsx`
- **Changes**:
  - Added import for `TodoToolWithState` component
  - Replaced `update_todo_list` tool's `resultWrapper` implementation
  - New implementation renders `TodoToolWithState` for running_now and success states
  - Error and rejected states still use `ToolHeaderWrapper` for consistency

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx`
- **Changes**:
  - Added import for `TodoProvider` context
  - Wrapped the entire return statement with `<TodoProvider threadId={threadId}>`
  - This provides todo state management to all child components

#### `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/components/messages/UserMessageComponent.tsx`
- **Changes**:
  - Added `data-role="user"` attribute to root div
  - This allows TodoTool to identify user messages for sticky offset calculation

## Implementation Details

### Creation vs Update Behavior

**Creation Call** (first todo tool call in a chat):
- Renders full todo list card UI
- Header shows: To-dos title, progress circle, and completion counter (e.g., "2/8")
- **Collapsed by default**: Shows only the currently running task (just like TodoStatusBar)
- **Expandable**: Click to expand and see all todo items
- **Sticky positioning**: Remains visible near top of chat area while scrolling
- Dynamic offset calculation: Measures user message height to avoid overlap
- **Auto-updates**: The creation card automatically updates in real-time to show the latest todo state

**Update Calls** (subsequent todo tool calls):
- Uses standard `ToolHeaderWrapper` component to match other tools (Read, Glob, etc.)
- Consistent styling and size with all other tool results
- **Single item changed**: Shows "Started/Finished/Created: [task name]"
- **Multiple items changed**: Shows "Finished N, Started M, Created K tasks"
- **No changes detected**: Shows "Updated TODO list (N items)"
- Each update triggers the creation card to re-render with the latest state

### Streaming Flicker Prevention

The `TodoContext` implements flicker prevention during streaming:
1. Maintains synced todo state per chat/subchat (keyed by thread ID)
2. Detects partial parsing by comparing array lengths
3. Only commits new state when array is not shrinking (partial parse detection)
4. This prevents the UI from temporarily treating updates as "creation" during streaming

### Auto-Update Mechanism for Creation Card

The creation card automatically updates to show the latest todo state:
1. `TodoContext` maintains an `updateCounter` that increments with each state update
2. When `updateCounter` changes, all consumers of the context re-render
3. The creation card (identified by `creationToolCallId`) always renders with `todoState.todos` (the latest state)
4. This ensures the creation card shows current progress even as updates come in
5. Example: Creation card shows "1/8" initially, then auto-updates to "2/8" when a todo is completed

### Sticky Positioning

The creation block uses sticky positioning with dynamic offset:
1. `TodoListFull` component includes `useEffect` hook to measure offset
2. Finds the scroll container (element with `overflow-y-auto` class)
3. Locates the most recent user message before the todo element
4. Calculates offset: distance from container top to user message bottom + padding
5. Sets CSS custom property `--computed-sticky-offset` inline
6. Updates on scroll events for dynamic positioning
7. Falls back to 8px if no user message found

## Testing the Implementation

### Manual Testing Steps

1. **Start the application** and open a chat thread

2. **Test Creation Behavior**:
   - Send a message that triggers a `TodoWrite` tool call
   - Verify the todo list appears with:
     - Full expandable UI
     - Stats in header (X/Y completed)
     - All todo items visible
     - Sticky positioning (stays at top while scrolling)

3. **Test Update Behavior**:
   - Send another message that updates the todos
   - Verify a compact summary appears showing changes
   - If one item changed: Shows "Started/Finished: [name]"
   - If multiple changed: Shows count summary with preview

4. **Test Streaming**:
   - While a todo update is streaming, verify:
     - No flicker or jumping between creation/update modes
     - Todo items appear smoothly
     - State remains stable even with partial JSON

5. **Test Sticky Positioning**:
   - Scroll the chat area with a todo list visible
   - Verify the creation block sticks to the top
   - Verify it doesn't overlap the user message area
   - Verify offset adjusts correctly on scroll

6. **Test Multiple Threads**:
   - Create todos in one thread
   - Switch to another thread
   - Switch back to first thread
   - Verify todo state is preserved correctly per thread

## Architecture Integration

### Component Hierarchy
```
SidebarChat (wrapped with TodoProvider)
└─ ScrollToBottomContainer
   └─ ChatBubble
      └─ ToolResultWrapper (for update_todo_list)
         └─ TodoToolWithState
            └─ TodoTool (creation or update mode)
               ├─ TodoListFull (creation mode, sticky)
               └─ TodoUpdateSummary (update mode, compact)
```

### State Management Flow
```
1. Tool call arrives → ChatBubble renders ToolResultWrapper
2. ToolResultWrapper → TodoToolWithState with threadId, toolCallId
3. TodoToolWithState → useTodoContext to get/update state
4. TodoContext determines if creation or update
5. TodoTool renders appropriate UI (full list or summary)
```

## Design Decisions

### Why ToolHeaderWrapper for Updates?
- Ensures consistent styling and sizing with all other tool results (Read, Glob, Edit, etc.)
- Maintains visual hierarchy and user expectations
- Reuses existing tested component instead of custom styling
- Automatic handling of loading states, errors, and theming

### Why Context Instead of Props?
- Need to track state across multiple tool calls in the same thread
- Avoids prop drilling through multiple component layers
- Provides centralized state management for all todo rendering
- Enables detection of creation vs update calls

### Why Inline CSS Variable for Sticky Offset?
- Allows dynamic calculation based on actual rendered elements
- Avoids complex CSS or fixed offsets that break on different layouts
- Self-contained in the component, no external dependencies

### Why Separate Creation and Update Rendering?
- Reduces visual noise for frequent updates
- Provides clear visibility of the full plan (creation card at top)
- Shows incremental progress (update entries) in a compact format
- Creation card auto-updates to reflect latest state from all subsequent updates
- Each update appears as a separate ToolHeaderWrapper entry showing what changed

### Why Flicker Prevention?
- Streaming JSON can be partial and cause array to shrink temporarily
- Prevents jarring UI changes while assistant is typing
- Ensures smooth, professional user experience

## Constraints Maintained

✅ **No existing features removed or refactored** (unless required)
✅ **Chat ordering, scrolling, tool rendering intact**
✅ **Existing tool data model and plumbing preserved**
✅ **No changes to other tool renderings**
✅ **Styling conventions maintained** (void-* CSS classes, tailwind)

## Future Enhancements (Not Implemented)

- Keyboard shortcuts for expanding/collapsing todo list
- Click to jump to specific todo item
- Inline editing of todo items
- Drag-and-drop reordering
- Filter/search todos
- Export todo list to file
- Integration with VS Code tasks

## Notes

- The implementation uses lucide-react icons (Check, Circle, Loader2, X) which are already in the project
- CSS classes follow the existing `void-*` naming convention
- Component structure follows the existing pattern in the codebase
- All TypeScript types are properly defined with no `any` usage
