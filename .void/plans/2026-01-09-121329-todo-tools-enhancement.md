---
title: Todo Tools Enhancement
created: 2026-01-09T06:43:29.984Z
updated: 2026-01-09T06:43:29.984Z
status: planning
model: claude-sonnet-4-0
---

# Todo Tools Enhancement Implementation

## Current State Analysis

The Void editor already has a functional todo system with:
- **Current tool**: `update_todo_list` with basic validation and merge support
- **UI Components**: `TodoStatusBar.tsx`, `TodoListDisplay.tsx` in sidebar
- **Type System**: `TodoItem` with id, content, and status fields
- **Integration**: Chat thread service manages todo state per conversation

## Enhancement Goals

Align the current implementation with Cursor AI's TodoWrite specification:

### 1. Tool Definition Refinement

**Current vs Target:**
- ✅ Already has required parameters: `todos` (array), `merge` (boolean)  
- ✅ Status types match: pending, in_progress, completed, cancelled
- ⚠️ **Enhance**: Tool description needs to match Cursor AI specification exactly
- ⚠️ **Enhance**: Parameter descriptions need refinement

### 2. Validation & Business Logic Improvements

**Current Status:**
- ✅ Basic validation exists (unique IDs, content length, one in_progress)
- ⚠️ **Add**: Enhanced merge behavior validation
- ⚠️ **Add**: Better error messages matching Cursor specification
- ⚠️ **Add**: Improved task breakdown guidance

**New Validations Needed:**
- Task complexity assessment (3+ step detection)
- Better duplicate detection across merge scenarios
- Content quality validation (actionable task detection)

### 3. UI/UX Enhancements

**Current Components:**
- `TodoStatusBar`: Compact progress view with expansion
- `TodoListDisplay`: Full list view with progress bar

**Enhancement Areas:**
- **Drag & Drop**: Enable reordering for better task management
- **Quick Actions**: Add/edit/delete todos directly from UI  
- **Status Transitions**: Click-to-change status workflow
- **Visual Polish**: Better icons, animations, and state indicators
- **Smart Suggestions**: Auto-generate todo IDs, suggest improvements

### 4. Integration Improvements

**Current Integration:**
- ✅ Chat thread service manages todo state
- ✅ Metrics tracking for todo operations  
- ✅ Plan editor integration

**Enhancement Opportunities:**
- **Persistence**: Ensure todos survive editor restart
- **Export/Import**: Allow todo list sharing between sessions
- **Plan Sync**: Better integration with plan mode todos
- **Notifications**: Subtle reminders for long-pending tasks

## Key Files to Modify

- **`src/vs/workbench/contrib/void/common/prompt/prompts.ts`** - Update tool description to match Cursor spec exactly
- **`src/vs/workbench/contrib/void/browser/toolsService.ts`** - Enhance validation logic and error messages
- **`src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/TodoStatusBar.tsx`** - Add interactive features
- **`src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/TodoListDisplay.tsx`** - Enhance with drag/drop and quick actions
- **`src/vs/workbench/contrib/void/browser/chatThreadService.ts`** - Improve merge logic and persistence
- **`src/vs/workbench/contrib/void/common/chatThreadServiceTypes.ts`** - Add new type definitions if needed

## Implementation Strategy

### Phase 1: Tool Specification Alignment
1. Update tool description in `prompts.ts` to exactly match Cursor AI specification
2. Enhance parameter validation with better error messages
3. Improve merge behavior documentation and implementation

### Phase 2: Enhanced UI Components  
1. Add interactive features to `TodoStatusBar` (click to expand, quick status changes)
2. Enhance `TodoListDisplay` with drag & drop reordering
3. Add quick action buttons (add, edit, delete todos)
4. Implement smooth animations and visual feedback

### Phase 3: Advanced Features
1. Smart todo ID generation and validation
2. Task complexity assessment and suggestions
3. Better persistence and state management
4. Integration with existing plan mode workflows

### Phase 4: Production Polish
1. Comprehensive testing of all scenarios
2. Accessibility improvements
3. Performance optimization
4. Documentation updates

## Technical Considerations

- **Backward Compatibility**: Maintain existing todo data format
- **Performance**: Ensure UI remains responsive with large todo lists
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **State Management**: Clean separation between UI state and data state
- **Error Handling**: Graceful degradation for edge cases

## Testing Strategy

- **Unit Tests**: Validation logic, merge behavior, type checking
- **Integration Tests**: Tool execution, UI interactions, persistence  
- **User Testing**: Workflow validation with realistic scenarios
- **Performance Tests**: Large todo lists, rapid updates, memory usage