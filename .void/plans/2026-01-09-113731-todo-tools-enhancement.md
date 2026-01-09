---
title: Todo Tools Enhancement
created: 2026-01-09T06:07:31.974Z
updated: 2026-01-09T06:07:31.974Z
status: planning
model: claude-sonnet-4-0
---

# Todo Tools Enhancement Plan

## Current State Analysis

The current todo implementation has several components:
- **TodoListDisplay.tsx** - Displays todos with progress bar but no interactivity  
- **TodoStatusBar.tsx** - Compact status view with expand/collapse
- **update_todo_list tool** - AI can create/update todo lists via markdown
- **parseMarkdownChecklist()** - Parses markdown checklist format
- **ChatThreadService** - Stores todoList per thread with updateTodoStatus method

## Key Issues Identified

- **No User Interaction** - Users can't click to toggle todo status
- **Limited UI Feedback** - No hover states, animations, or visual feedback
- **Incomplete LLM Integration** - AI can create todos but can't mark them complete
- **Status Sync Gaps** - Manual status changes don't update the markdown representation
- **No Undo/Redo** - No way to revert todo state changes
- **Missing Context Actions** - No ability to edit, delete, or reorder todos

## Implementation Approach

### Phase 1: Core Interactivity
- Add click handlers to TodoListDisplay for status toggling
- Implement updateTodoStatus calls to ChatThreadService
- Add hover states and smooth animations
- Update both components to support onClick props

### Phase 2: Enhanced UI/UX  
- Add edit-in-place functionality for todo content
- Implement drag-and-drop reordering (using existing DraggableTodoList as reference)
- Add context menus for todo actions (edit, delete, duplicate)
- Improve visual feedback with better icons and states

### Phase 3: LLM Integration
- Create new AI tools: `mark_todo_complete`, `add_todo_item`, `edit_todo_item` 
- Enable AI to manage todos during task execution
- Add automatic status updates when AI completes related tasks
- Sync todo status changes back to markdown representation

### Phase 4: Persistence & History
- Add undo/redo functionality for todo changes
- Implement todo change history tracking  
- Add export/import functionality for todo lists
- Enable todo templates and quick creation

## Files to Modify

**React Components:**
- `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/TodoListDisplay.tsx`
- `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/TodoStatusBar.tsx` 
- `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx`

**Service Layer:**
- `src/vs/workbench/contrib/void/browser/chatThreadService.ts`
- `src/vs/workbench/contrib/void/browser/toolsService.ts`
- `src/vs/workbench/contrib/void/common/chatThreadServiceTypes.ts`

**Tool Integration:**  
- `src/vs/workbench/contrib/void/common/toolsServiceTypes.ts`
- `src/vs/workbench/contrib/void/common/prompt/prompts.ts`

## Risk Considerations

- **State Synchronization** - Ensure UI changes properly sync with service layer
- **Performance** - Large todo lists might impact rendering performance  
- **LLM Context** - Adding too many todo tools could bloat the system prompt
- **User Expectations** - Need to maintain consistency with existing Void patterns

## Testing Strategy

- Unit tests for todo parsing and validation logic
- Integration tests for AI tool usage scenarios  
- Manual testing of click interactions and animations
- Performance testing with large todo lists (100+ items)
- Cross-thread todo behavior verification