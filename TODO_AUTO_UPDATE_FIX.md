# Todo Card Auto-Update Fix

## Problem
The creation card (first "To-dos" entry) was not updating to show the latest progress when subsequent todo updates occurred. For example:
- Creation card showed "1/8" progress
- Update entry showed "Started: Analyzing overall project architecture..."
- But the creation card still displayed "1/8" instead of updating to "2/8"

## Root Cause
The TodoContext was using `forceUpdate({})` to trigger re-renders, but this didn't propagate properly to all consumers because:
1. The context value object reference wasn't changing
2. Memoized functions didn't have proper dependencies
3. Components consuming the context weren't re-rendering when state updated

## Solution Implemented

### 1. Added Update Counter to TodoContext
**File**: `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/contexts/TodoContext.tsx`

**Changes**:
- Added `updateCounter: number` to `TodoContextValue` type
- Changed from `forceUpdate({})` to `setUpdateCounter(prev => prev + 1)`
- Added `updateCounter` as dependency to `getTodoState` callback
- Used `useMemo` for context value with proper dependencies

**Result**: Every state update increments the counter, causing all consumers to re-render

### 2. Made Creation Card Use Latest State
**File**: `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/components/toolResults/TodoTool.tsx`

**Changes** in `TodoToolWithState`:
```typescript
if (isCreation) {
    // Use the latest todos from context state, not the initial todos
    // This ensures the creation card updates when subsequent tool calls update the state
    const latestTodos = todoState.todos.length > 0 ? todoState.todos : todos;

    return (
        <TodoTool
            todos={latestTodos}
            isCreation={true}
            isStreaming={isStreaming}
            onMount={handleMount}
        />
    );
}
```

**Result**: Creation card always renders with the latest todos from context

## How It Works

### Flow Example

1. **First TodoWrite call** (toolCallId="abc123"):
   - Sets `creationToolCallId = "abc123"`
   - Sets initial todos `["Task 1", "Task 2", ...]`
   - Sets `updateCounter = 1`
   - Renders creation card with initial state (1/8 progress)

2. **Second TodoWrite call** (toolCallId="def456"):
   - Keeps `creationToolCallId = "abc123"` (unchanged)
   - Updates todos to new state `["Task 1 (completed)", "Task 2", ...]`
   - Increments `updateCounter` to 2
   - **This triggers re-render of ALL consumers**, including the first TodoToolWithState

3. **First TodoToolWithState re-renders**:
   - `isCreation = true` (still, because its toolCallId matches creationToolCallId)
   - `latestTodos = todoState.todos` (gets the NEW updated todos)
   - Renders creation card with updated state (2/8 progress)

4. **Second TodoToolWithState renders**:
   - `isCreation = false` (different toolCallId)
   - Renders update entry: "Finished: Task 1"

### Key Components

**TodoContext (`updateCounter` mechanism)**:
- Increments on every state update
- Causes context value to change reference (via useMemo)
- Triggers re-render of all consumers

**TodoToolWithState (creation mode)**:
- Always uses `todoState.todos` instead of props `todos`
- Re-renders when `updateCounter` changes
- Shows latest state in creation card

## Benefits

✅ **Real-time updates**: Creation card shows current progress at all times
✅ **Consistent UX**: Matches expected behavior (like a status bar)
✅ **No flicker**: State updates are atomic and don't cause visual glitches
✅ **Production-ready**: Proper React patterns with memoization and dependencies

## Testing

To verify the fix works:

1. Create a new chat and trigger TodoWrite tool
2. Observe creation card shows initial state (e.g., "1/8")
3. Complete or start a task (trigger another TodoWrite)
4. Verify creation card updates to show new state (e.g., "2/8")
5. Check that progress circle and current task also update correctly
6. Test with multiple rapid updates to ensure no flicker

## Technical Notes

- The `updateCounter` approach is preferred over `forceUpdate({})` because it provides proper React dependency tracking
- Using `useMemo` for context value ensures referential equality is maintained when appropriate
- The fallback `todoState.todos.length > 0 ? todoState.todos : todos` ensures proper initialization during creation
- All consumers re-render when counter changes, but React will bail out if props haven't changed (via React.memo)

### Smart Todo Merging (Critical Fix)

**Problem:** Update tool calls sometimes only send the changed todos, not the full list. For example:
- Creation: Sends all 9 todos
- Update: Sends only 1 changed todo
- Result: Card shows "1/1" instead of "2/9"

**Solution:** Smart merging by todo ID
```typescript
if (!isFirstCall && currentState && currentState.todos.length > 0) {
    if (todos.length < currentState.todos.length) {
        // Partial update detected - merge by ID
        const existingMap = new Map(currentState.todos.map(t => [t.id, t]));
        todos.forEach(todo => {
            existingMap.set(todo.id, todo);
        });
        finalTodos = Array.from(existingMap.values());
    } else {
        // Full update - trust the new list
        finalTodos = todos;
    }
}
```

This ensures the card always shows the correct total count (e.g., "2/9") even when updates only send partial data.
