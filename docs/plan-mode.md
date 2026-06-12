# Plan Mode - Implementation Documentation

## Overview

Plan Mode is a specialized chat mode in Orbit that enables AI assistants to create comprehensive implementation plans before executing code changes. It follows a structured workflow: **RESEARCH → CLARIFY → DESIGN → DOCUMENT → PRESENT**.

Plan Mode bridges the gap between Normal mode (chat-only) and Agent mode (full execution), allowing users to review and approve implementation strategies before any code is modified.

### Ephemeral Draft Workflow (Cursor parity)

`create_plan` no longer writes to disk immediately. Instead:

1. **Draft** — The plan is stored in `thread.planDraft` (in-memory, per chat thread).
2. **Plan Card** — Chat renders a `PlanCard` with filename header, overview, truncated to-do preview, **View Plan**, model selector, and **Build**.
3. **Review** — **View Plan** opens a virtual draft editor (`void-plan-draft://{threadId}`) where users can edit markdown and interact with the checklist panel.
4. **Save** — **Save to workspace** (overflow menu on the card, or toolbar in the editor) writes to `.void/plans/` and links the file to the thread.
5. **Build** — **Build** saves if needed, switches to Agent mode, syncs todos to the thread, and starts implementation with the selected Chat model.

Bidirectional sync keeps `planDraft`, thread todos, and saved plan file checklist aligned during plan-mode editing.

---

## Architecture

### Mode System

Orbit has three chat modes defined in `orbitSettingsTypes.ts`:

```typescript
export type ChatMode = 'agent' | 'plan' | 'normal'
```

| Mode | Purpose | File Read | File Edit | Terminal | Plan Tools | MCP Tools |
|------|---------|-----------|-----------|----------|------------|-----------|
| Normal | Quick questions & chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| Plan | Research & planning | ✅ | ❌ | ❌ | ✅ | ❌ |
| Agent | Full implementation | ✅ | ✅ | ✅ | ❌ | ✅ |

### Key Files

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/orbit/common/orbitSettingsTypes.ts` | ChatMode type definition |
| `src/vs/workbench/contrib/orbit/common/planTemplate.ts` | Plan file creation/parsing utilities |
| `src/vs/workbench/contrib/orbit/common/planDraftHelpers.ts` | Ephemeral draft, virtual URI, checklist sync |
| `src/vs/workbench/contrib/orbit/common/toolsServiceTypes.ts` | Plan tool parameter & result types |
| `src/vs/workbench/contrib/orbit/common/prompt/prompts.ts` | Tool definitions & system prompts |
| `src/vs/workbench/contrib/orbit/browser/toolsService.ts` | Plan tool implementations |
| `src/vs/workbench/contrib/orbit/browser/planDraftActions.ts` | Save / Build command actions |
| `src/vs/workbench/contrib/orbit/browser/planEditorCommands.ts` | `orbit.plan.*` commands |
| `src/vs/workbench/contrib/orbit/browser/planTodoSyncService.ts` | Thread ↔ plan file todo sync |
| `src/vs/workbench/contrib/orbit/browser/react/src/sidebar-tsx/components/toolResults/PlanCard.tsx` | Chat plan card UI |
| `src/vs/workbench/contrib/orbit/browser/react/src/plan-editor-tsx/PlanEditor.tsx` | Full plan editor |
| `src/vs/workbench/contrib/orbit/browser/react/src/plan-editor-tsx/PlanChecklistPanel.tsx` | Interactive checklist panel |
| `src/vs/workbench/contrib/orbit/browser/react/src/sidebar-tsx/SidebarChat.tsx` | Mode selector (Shift+Tab: normal → plan → agent) |
| `src/vs/workbench/contrib/orbit/browser/react/src/styles.css` | Plan card & checklist CSS |

---

## Plan File Structure

Plans are stored as Markdown files with YAML frontmatter in `.void/plans/` directory.

### Filename Format
```
YYYY-MM-DD-HHMMSS-slug.md
```
Example: `2025-01-05-143022-user-authentication.md`

### File Template

```markdown
---
title: Feature Name
created: 2025-01-05T14:30:00.000Z
updated: 2025-01-05T14:30:00.000Z
status: planning
model: claude-sonnet-4.5
---

# Implementation Plan: Feature Name

## Overview
High-level description of what the plan accomplishes (2-4 sentences).

## Files to Modify
- `src/path/to/file1.ts`
- `src/path/to/file2.ts`

## Implementation Steps
1. First step description
2. Second step description
3. Third step description

## Implementation Checklist
- [ ] Granular task 1
- [ ] Granular task 2
- [x] Completed task

## Testing Strategy
Description of how to test the implementation.

## Notes & Considerations
Trade-offs, architectural decisions, and additional context.
```

### Status Values
- `planning` - Initial state, plan being developed
- `approved` - User has approved the plan
- `in-progress` - Execution has started
- `completed` - All tasks finished

---

## Plan Tools (LLM-exposed)

Plan mode exposes read-only exploration tools plus `create_plan`, `update_todo_list`, and plan-file `StrReplace`/`Write` (guarded to linked plan paths only). Legacy section tools (`read_plan`, `update_plan_section`, `add_plan_todo`, `mark_plan_item_complete`) are **not** re-exposed to the LLM.

### `create_plan`

Creates an ephemeral plan draft on the active thread. Does **not** write to disk.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Short plan title |
| `overview` | string | No | Brief description (2-4 sentences) |
| `plan` | string | Yes | Full plan markdown body |
| `todos` | object[] | No | Structured todos (`id`, `content`); checklist in `plan` body is authoritative after creation |

**Returns:**
```typescript
{ isDraft: true, planName: string, overview: string, todos: PlanTodoItem[] }
```

Thread todos are seeded from the full draft content (checklist markdown), not only `params.todos`.

### Plan-file edits in plan mode

When a plan is saved/linked, `StrReplace` and `Write` on the `.void/plans/*.md` file update disk and sync checklist todos back to the thread. Draft-only edits (before save) mutate `thread.planDraft` in memory via `_applyPlanDraftEdit`.

### User commands

| Command | Description |
|---------|-------------|
| `orbit.plan.openDraft` | Open virtual draft editor for thread |
| `orbit.plan.saveToWorkspace` | Write draft to `.void/plans/` and link to thread |
| `orbit.plan.buildFromDraft` | Save if needed, switch to Agent, stream build message |

---

## Plan Template Module

Located at: `src/vs/workbench/contrib/orbit/common/planTemplate.ts`

### Exported Functions

```typescript
// Create new plan content
function createPlanContent(opts: CreatePlanOptions): string

// Parse plan file into structured data
function parsePlanFile(content: string): ParsedPlan

// Update a specific section
function updatePlanSection(currentContent: string, sectionName: PlanSection, newContent: string): string

// Add TODO to checklist
function addTodoToChecklist(currentContent: string, todoText: string, category?: string): { content: string; todoCount: number }

// Mark TODO as complete
function markTodoComplete(currentContent: string, itemIndex: number): { content: string; completedItem: string }

// Generate filename with timestamp
function generatePlanFileName(planName?: string): string

// Validate section name
function isValidSectionName(name: string): name is PlanSection

// Count TODO items
function countTodoItems(content: string): { total: number; completed: number; pending: number }
```

### Types

```typescript
type PlanStatus = 'planning' | 'approved' | 'in-progress' | 'completed'

type PlanSection = 'overview' | 'files' | 'steps' | 'checklist' | 'testing' | 'notes'

interface PlanMetadata {
  title: string
  created: string
  updated: string
  status: PlanStatus
  model?: string
}

interface ParsedPlan {
  metadata: PlanMetadata
  sections: Record<PlanSection, string>
  rawContent: string
}
```

---

## Tools Service Integration

Located at: `src/vs/workbench/contrib/orbit/browser/toolsService.ts`

### Draft & sync

```typescript
// create_plan → thread.planDraft (no disk write)
// StrReplace/Write on linked plan → disk + syncPlanChecklistToThreadTodos
// Draft StrReplace → _applyPlanDraftEdit → setThreadPlanDraft + setThreadTodoList
```

Plan tools are registered in validators, executors, and formatters on `ToolsService`.

---

## System Prompt Integration

Located at: `src/vs/workbench/contrib/orbit/common/prompt/prompts.ts`

### Available Tools by Mode

```typescript
// Read-only tools (all modes)
const readOnlyToolNames = [
  'Read', 'Glob', 'Grep', 'read_lint_errors'
]

// Plan mode tools (Shell excluded)
const planModeToolNames = [
  ...readOnlyToolNames,
  'update_todo_list',
  'create_plan',
  'StrReplace', 'Write',  // plan file only, guarded
]
```

### Workflow Prompt

Plan mode uses the following workflow in system prompts:

```
PLAN mode mental model: RESEARCH → CLARIFY → DESIGN → DOCUMENT → PRESENT

- RESEARCH: run parallel searches/reads to understand the codebase
- CLARIFY: ask critical questions if requirements are ambiguous BEFORE creating a plan
- DESIGN: create a structured implementation plan using create_plan
- DOCUMENT: populate the plan with sections using update_plan_section and add_plan_todo
- PRESENT: summarize the plan and guide the user to review and approve
```

---

## UI Integration

### Mode selector

Shift+Tab cycles **normal → plan → agent** (matches dropdown order). Plan mode shows a planning status pill on user messages while the agent is running.

### Plan Card (`PlanCard.tsx`)

Rendered after `create_plan` in chat:

```
┌─────────────────────────────────────────────┐
│ 📄 user-auth.plan.md              [⋯] [⌄]  │
├─────────────────────────────────────────────┤
│ # Plan Title                                │
│ Overview paragraph                          │
│ ┌─────────────────────────────────────────┐ │
│ │ 11 To-dos                               │ │
│ │ ○ Task 1 … ○ Task 3 … … 8 more          │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ View Plan          [model ▾] [Build]        │
└─────────────────────────────────────────────┘
```

- Header shows proposed or saved filename (`getProposedPlanFileName`)
- **Save to workspace** is in the ⋯ overflow menu (not the primary footer row)
- **ModelDropdown** (Chat feature) sets the model used when Build streams the agent turn
- Card subscribes to `onDidChangeThreadPlanDraft` for live updates

### Plan editor (`PlanEditor.tsx` + `PlanChecklistPanel.tsx`)

- Breadcrumb: `Plans > {filename.plan.md}` (tab label via `PlanEditorInput.getName()`)
- Toolbar: Save to workspace (draft), ModelDropdown + Build
- Markdown preview + interactive checklist panel (toggle status, add todos)
- Debounced sync: draft → `setThreadPlanDraft`; saved file → `onSave`

---

## CSS Styling

Located at: `src/vs/workbench/contrib/orbit/browser/react/src/styles.css`

### Plan Card Classes

| Class | Purpose |
|-------|---------|
| `.plan-card` | Base card container with hover effects |
| `.plan-card-header` | Gradient header with icon and title |
| `.plan-card-title` | Bold plan name text |
| `.plan-card-icon` | Status icon container |
| `.plan-card-body` | Content area padding |
| `.plan-card-overview` | Overview text with line clamp |
| `.plan-card-file-link` | Clickable file link with hover state |
| `.plan-card-error` | Error message styling |

### Status Badge Classes

```css
.plan-status-badge       /* Base badge styling */
.plan-status-planning    /* Blue - planning state */
.plan-status-approved    /* Green - approved state */
.plan-status-in-progress /* Yellow - in progress */
.plan-status-completed   /* Green - completed state */
```

### Checklist Classes

```css
.plan-checklist          /* Container for checklist items */
.plan-checklist-item     /* Individual item styling */
.plan-checklist-item.completed  /* Strikethrough for done items */
.plan-checklist-item.pending    /* Normal text for pending items */
```

### Animation Classes

```css
.plan-spinner  /* Rotating animation for loading states */
```

### Example Card Styling

```css
.plan-card {
  @apply rounded-lg border border-void-border bg-void-bg-2 overflow-hidden;
  transition: all 0.2s ease;
}

.plan-card:hover {
  border-color: var(--void-border-1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.plan-card-header {
  @apply flex items-center gap-2 px-3 py-2.5 border-b border-void-border;
  background: linear-gradient(to bottom, var(--void-bg-1), var(--void-bg-2));
}
```

---

## Typical Workflow

1. **User selects Plan mode** (or Shift+Tab until Plan)
2. **User describes feature**; AI researches with read-only tools
3. **AI asks clarifying questions** via `AskQuestion` if needed
4. **AI calls `create_plan`** → ephemeral draft + Plan Card in chat
5. **User clicks View Plan** → draft editor with checklist panel
6. **User edits** markdown/todos; changes sync to thread draft and card
7. **User saves** via ⋯ menu or editor toolbar → `.void/plans/{slug}.plan.md`
8. **User clicks Build** (card or editor) → Agent mode, todos synced, implementation starts
9. **During agent execution**, thread todos sync one-way to the saved plan file

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "No workspace folder open" | No folder opened in IDE | Open a folder first |
| "No active plan" | Trying to read/update without creating | Use `create_plan` first |
| "Invalid section name" | Wrong section parameter | Use valid section: overview, files, steps, checklist, testing, notes |
| "TODO item #N not found" | Invalid item index | Check number of unchecked items |

---

## Enhanced Plan File Styling

**Status:** ✅ Implemented (January 2025)

Plan files now feature enhanced markdown styling in the editor, providing a polished, professional appearance similar to Cursor AI while maintaining clean markdown aesthetics.

### Architecture

The styling system uses a dual-layer approach:

1. **TextMate Grammar Layer** - Syntax highlighting via token scopes
2. **Editor Decorations Layer** - Runtime decorations for dynamic visual effects

```
Plan File (.void/plans/*.md)
    ↓
TextMate Grammar (Syntax) + Editor Decorations (Visual)
    ↓
Themed, Styled Editor Display
```

### Implementation Details

#### 1. TextMate Grammar Extension

**Location:** `extensions/void-plan-markdown/`

**Files:**
- `package.json` - Extension manifest
- `syntaxes/plan-markdown.tmLanguage.json` - Grammar definition
- `language-configuration.json` - Language configuration

**Scope Patterns:**
- `meta.frontmatter.plan.markdown` - YAML frontmatter block
- `entity.name.section.plan.markdown` - Plan section headers (## Overview, etc.)
- `markup.list.checkbox.checked/unchecked.plan.markdown` - Checklist items
- `markup.underline.link.filepath.plan.markdown` - File path links in backticks
- `keyword.other.plan-status.markdown` - Status values (planning, approved, etc.)

#### 2. Theme Color System

**Location:** `src/vs/platform/theme/common/colors/planColors.ts`

**19 New Color Identifiers:**

| Color ID | Purpose | Dark Default | Light Default |
|----------|---------|--------------|---------------|
| `plan.frontmatter.background` | Frontmatter block background | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.03)` |
| `plan.frontmatter.border` | Frontmatter left border | `rgba(100,150,255,0.4)` | `rgba(0,102,204,0.3)` |
| `plan.frontmatter.keyForeground` | YAML key color | `#9CDCFE` | `#0066CC` |
| `plan.frontmatter.valueForeground` | YAML value color | `#CE9178` | `#A31515` |
| `plan.section.heading.foreground` | Section header text | `#4FC1FF` | `#0066CC` |
| `plan.section.heading.background` | Section header background | `rgba(79,193,255,0.1)` | `rgba(0,102,204,0.05)` |
| `plan.checklist.checked.foreground` | Completed item color | `#4CAF50` | `#2E7D32` |
| `plan.checklist.unchecked.foreground` | Pending item color | `#FFA726` | `#F57C00` |
| `plan.checklist.checkbox.completed` | Checkmark color | `#4CAF50` | `#2E7D32` |
| `plan.checklist.checkbox.pending` | Empty checkbox color | `#FFA726` | `#F57C00` |
| `plan.status.planning` | Planning badge color | `#2196F3` | `#1976D2` |
| `plan.status.approved` | Approved badge color | `#4CAF50` | `#2E7D32` |
| `plan.status.inProgress` | In-progress badge color | `#FFA726` | `#F57C00` |
| `plan.status.completed` | Completed badge color | `#66BB6A` | `#388E3C` |
| `plan.filepath.foreground` | File path text | `#D4D4D4` | `#333333` |
| `plan.filepath.background` | File path background | `rgba(100,150,255,0.15)` | `rgba(0,102,204,0.1)` |
| `plan.filepath.border` | File path border | `rgba(100,150,255,0.3)` | `rgba(0,102,204,0.2)` |

All colors are fully themeable and work in dark, light, and high-contrast themes.

#### 3. Editor Decorator Contribution

**Location:** `src/vs/workbench/contrib/void/browser/planMarkdownDecorator.ts`

**Features:**
- Automatic detection of plan files (by path or frontmatter content)
- Debounced updates (300ms) for performance
- Theme-aware decoration updates
- Five decoration types:
  1. **Frontmatter Block** - Background + left border accent
  2. **Section Headers** - Icon prefixes + gradient background
  3. **Checklist Items** - Checkmarks, strikethrough, color-coding
  4. **File Paths** - Pill-style badges with hover effects
  5. **Status Badges** - Inline colored badges after status field

**CSS Styling:** `src/vs/workbench/contrib/void/browser/planMarkdownDecorator.css`

**Section Icons:**
- 📋 Overview
- 📁 Files to Modify
- 🔨 Implementation Steps
- ✓ Implementation Checklist
- 🧪 Testing Strategy
- 📝 Notes & Considerations

#### 4. File Detection Logic

Plan files are detected by:
1. **Path matching:** Files in `.void/plans/*.md` directory
2. **Content matching:** Markdown files with plan frontmatter (contains `status:` field with plan status values)

This ensures styling only applies to plan files, with no impact on regular markdown files.

#### 5. Theme Integration

**Modified Files:**
- `src/vs/platform/theme/common/colorRegistry.ts` - Exported plan colors
- `src/vs/workbench/services/themes/common/colorThemeSchema.ts` - Added plan token scopes
- `extensions/theme-defaults/themes/dark_modern.json` - Default dark theme colors
- `extensions/theme-defaults/themes/light_modern.json` - Default light theme colors

#### 6. Enhanced Plan Template

**Modified:** `src/vs/workbench/contrib/void/common/planTemplate.ts`

Added better spacing between sections for improved readability and visual hierarchy.

### Visual Design

**Typography:**
- Section headers: Bold, accent colored
- Frontmatter: Monospace for values, regular for keys
- Checklist: Regular weight for pending, lighter with strikethrough for completed
- File paths: Monospace code font

**Color Scheme (Dark Theme):**
- Frontmatter: Subtle rgba background with blue left border
- Sections: Linear gradient backgrounds with cyan tones
- Completed items: Green (#4CAF50)
- Pending items: Amber (#FFA726)
- Status badges: Semantic colors (blue/green/amber)

**Visual Effects:**
- Smooth transitions on hover
- Icon prefixes for visual anchoring
- Rounded corners for modern feel
- Proper spacing and breathing room

### Performance

- Decorations update on document change events with 300ms debounce
- Only applies to plan files (no overhead on regular markdown)
- Efficient range-based decoration system
- Cleans up decorations on file close

### Testing

**Sample Files:**
- `.void/plans/sample-test-plan.md` - Comprehensive test file with all elements
- `.void/plans/IMPLEMENTATION_COMPLETE.md` - Implementation documentation

**Test Coverage:**
- Frontmatter detection and styling
- All section types with icons
- Mixed checklist items (completed/pending)
- File path links with various extensions
- Status badge rendering
- Theme switching
- Performance with typical plan files

### Files Created

1. `extensions/void-plan-markdown/package.json`
2. `extensions/void-plan-markdown/language-configuration.json`
3. `extensions/void-plan-markdown/syntaxes/plan-markdown.tmLanguage.json`
4. `src/vs/platform/theme/common/colors/planColors.ts`
5. `src/vs/workbench/contrib/void/browser/planMarkdownDecorator.ts`
6. `src/vs/workbench/contrib/void/browser/planMarkdownDecorator.css`

### Files Modified

1. `src/vs/platform/theme/common/colorRegistry.ts` - Added planColors export
2. `src/vs/workbench/services/themes/common/colorThemeSchema.ts` - Added plan token scopes
3. `src/vs/workbench/contrib/void/browser/void.contribution.ts` - Registered decorator contribution
4. `src/vs/workbench/contrib/void/common/planTemplate.ts` - Enhanced spacing
5. `extensions/theme-defaults/themes/dark_modern.json` - Added plan color values
6. `extensions/theme-defaults/themes/light_modern.json` - Added plan color values

---

## Future Enhancements

- [ ] **Build in New Agent** — selected todos only (Phase E / v2)
- [ ] `referencedBy` YAML frontmatter tracking multiple agent threads
- [ ] Plan export icon on card header
- [ ] Multiple active plans per thread
- [ ] Plan templates for common tasks
- [ ] Plan diff view
- [ ] Export to issue trackers (JIRA, GitHub, etc.)

---

## Related Documentation

- [Tool System](./tools.md) - How tools work in Void
- [Chat Modes](./chat-modes.md) - Overview of all chat modes
- [MCP Integration](./mcp.md) - Model Context Protocol tools
