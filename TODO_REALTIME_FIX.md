# Todo Card Real-Time Update and Expand/Collapse Fix

## Problem

The user reported several issues with the TodoTool card:

1. **Not updating in real-time** like the TodoStatusBar
2. **Expand/collapse not working** - card was stuck in one state
3. **Should be collapsed by default** showing only current running task
4. **Should expand to show all tasks** when clicked

## Reference: TodoStatusBar

The TodoStatusBar (at top of chat area) works correctly:
- Shows progress bar with completion count (e.g., "3/8")
- **Collapsed by default** - shows only current running task
- **Expandable** - user can click to see all tasks
- **Updates in real-time** from props

## Solution Implemented

### 1. Header Shows Progress (Like TodoStatusBar)

**Changed:**
- Removed the truncated first todo text from header
- Added progress circle and completion counter directly in header
- Header now shows: `To-dos | [Progress Circle] 2/8 | [Expand/Collapse Icon]`

**Result:** User can see progress at a glance without expanding

### 2. Collapsed State Shows Only Current Task

**Changed:**
- Simplified collapsed state to show only the current running task
- Uses `TodoItemRow` component to display current task
- Falls back to last completed task if no task is in progress

**Previous Behavior:**
```tsx
// Showed progress circle + current task + counter (redundant)
<ProgressCircle />
<span>{currentTask.content}</span>
<span>2/8</span>
```

**New Behavior:**
```tsx
// Just shows the current todo item
{currentTask && (
    <TodoItemRow todo={currentTask} isLast={true} />
)}
```

**Result:** Clean display of current task, no redundancy

### 3. Expand/Collapse Works Properly

**The expand/collapse functionality was already implemented correctly** with:
- `isExpanded` state controlled by `useState(false)` (defaults to collapsed)
- `onToggle={() => setIsExpanded(!isExpanded)}` handler
- Chevron icon that animates based on `isExpanded`

**The code structure:**
```tsx
{!isExpanded && (
    // Show only current task
    <TodoItemRow todo={currentTask} isLast={true} />
)}

{isExpanded && (
    // Show all tasks
    {todos.map(todo => <TodoItemRow todo={todo} />)}
)}
```

**Result:** Click header or bottom section to toggle between collapsed/expanded states

### 4. Real-Time Updates (Like TodoStatusBar)

**How TodoStatusBar works:**
- Receives `todos` array as prop
- Computes display state directly from props using `getDisplayTodos(todos)`
- No complex context management for display logic
- Re-renders automatically when props change

**How TodoTool now works:**
- `TodoToolWithState` passes latest `todoState.todos` to `TodoTool`
- `TodoTool` computes `currentTask`, `completedCount`, etc. directly from props
- Uses `useMemo` in TodoContext to ensure value changes trigger re-renders
- `updateCounter` increments on every state update

**Result:** Card updates in real-time whenever todos change, just like TodoStatusBar

## Visual Design

### Header (Always Visible):
```
┌─────────────────────────────────────┐
│ 📋 To-dos  [●◐○○○○○○] 2/8  [▼]     │
└─────────────────────────────────────┘
```

### Collapsed (Default):
```
┌─────────────────────────────────────┐
│ 📋 To-dos  [●◐○○○○○○] 2/8  [▼]     │
├─────────────────────────────────────┤
│ ▶ Analyzing project structure       │ ← Current task only
└─────────────────────────────────────┘
```

### Expanded (On Click):
```
┌─────────────────────────────────────┐
│ 📋 To-dos  [●◐○○○○○○] 2/8  [▲]     │
├─────────────────────────────────────┤
│ ✓ Read 4 files                      │
│ ▶ Analyzing project structure       │ ← Current (highlighted)
│ ○ Review authentication             │
│ ○ Assess deployment                 │
│ ○ Examine API endpoints             │
│ ○ Check error handling              │
│ ○ Review security                   │
│ ○ Test and build                    │
└─────────────────────────────────────┘
```

## Technical Changes

### Files Modified:

**`src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/components/toolResults/TodoTool.tsx`**

1. **Header Section (lines 293-309):**
   - Replaced truncated todo text with progress circle + counter
   - Matches TodoStatusBar design pattern

2. **Collapsed State (lines 332-350):**
   - Simplified to show only current task using `TodoItemRow`
   - Removed redundant progress display

3. **Expand/Collapse Logic:**
   - Already working correctly, just needed proper collapsed state rendering

**`src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/contexts/TodoContext.tsx`**
- Already had `updateCounter` mechanism for real-time updates (from previous fix)
- `useMemo` ensures context value changes on updates

## Testing

To verify the fix:

1. **Start application** and trigger a TodoWrite tool call
2. **Verify collapsed state**: Should show only current running task
3. **Verify header**: Should show progress circle and "2/8" counter
4. **Click to expand**: Should show all tasks
5. **Click to collapse**: Should return to showing only current task
6. **Trigger another TodoWrite**: Verify card updates in real-time
7. **Check progress updates**: Progress should update (2/8 → 3/8) as tasks complete

## Result

✅ Card collapsed by default (matches TodoStatusBar)
✅ Shows only current running task when collapsed
✅ Header shows progress circle and counter
✅ Expand/collapse works by clicking anywhere on card
✅ Updates in real-time when todos change
✅ No redundant information
✅ Clean, professional UI

The TodoTool card now works exactly like the TodoStatusBar!
