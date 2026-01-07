# Plan Editor Implementation

This document describes the Plan Editor feature implementation, including the custom webview editor, approval workflow, and native editor features.

## Overview

The Plan Editor provides a rich, interactive interface for viewing and editing implementation plans stored in `.void/plans/*.md` files. It replaces the default text editor with a structured view that supports:

- Visual progress tracking with charts
- Drag-and-drop todo reordering
- Inline editing of sections
- Status management and approval workflow
- Native editor features (links, CodeLens, folding, outline)

## Architecture

### File Structure

```
src/vs/workbench/contrib/void/browser/
├── planCustomEditor.ts          # EditorPane registration
├── planEditorInput.ts           # EditorInput for plan files
├── planManagerService.ts        # Plan CRUD operations
├── planApprovalActions.ts       # Approval workflow commands
├── planLanguageFeatures.ts      # Native editor features
├── planExecutionTracker.ts      # Execution tracking
├── backgroundAgentService.ts    # Background agent with guardrail
└── react/
    └── src/plan-editor-tsx/
        ├── index.tsx            # Mount function export
        ├── PlanEditor.tsx       # Main React component
        ├── ProgressCharts.tsx   # SVG progress visualization
        └── DraggableTodoList.tsx # Drag-and-drop todos
```

### Component Hierarchy

```
PlanEditorPane (VSCode EditorPane)
└── PlanEditor (React)
    ├── StatusSelector
    ├── ProgressCharts
    │   ├── DonutChart
    │   ├── StatusBreakdownBar
    │   └── StatCards
    ├── SectionPanel (Overview, Files, Steps, Testing, Notes)
    └── DraggableTodoList
        └── TodoItemRow
```

## CSS Scoping System

### How It Works

The project uses a custom CSS scoping system with Tailwind CSS:

1. **Source files** (`src/`) use standard Tailwind classes + `@@void-scope` placeholder
2. **scope-tailwind** transforms `src/` → `src2/`:
   - Replaces `@@void-scope` with `void-scope`
   - Prefixes all Tailwind classes with `void-` (e.g., `flex` → `void-flex`)
3. **tsup** bundles `src2/` → `out/` with CSS injected into JS

### Required Pattern for React Components

Every React component that uses Tailwind CSS must follow this pattern:

```tsx
import { useIsDark } from '../util/services.js';
import '../styles.css';

export const MyComponent = (props) => {
  const isDark = useIsDark();

  return (
    <div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
      <div className="bg-void-bg-1 text-void-fg-1">
        {/* Component content */}
      </div>
    </div>
  );
};
```

### Custom CSS Variables

The following CSS variables are available via `styles.css`:

| Variable | VSCode Mapping |
|----------|----------------|
| `--void-bg-1` | `--vscode-input-background` |
| `--void-bg-2` | `--vscode-sideBar-background` |
| `--void-bg-3` | `--vscode-editor-background` |
| `--void-fg-1` | `--vscode-editor-foreground` |
| `--void-fg-2` | `--vscode-input-foreground` |
| `--void-fg-3` | `--vscode-input-placeholderForeground` |
| `--void-border-1` | `--vscode-commandCenter-activeBorder` |
| `--void-border-2` | `--vscode-commandCenter-border` |

## Custom Editor Registration

### PlanEditorInput (`planEditorInput.ts`)

Extends `EditorInput` to provide:

- Plan file content loading and parsing
- Dirty state management
- Save/revert functionality

```typescript
export class PlanEditorInput extends EditorInput {
  static readonly ID = 'workbench.input.void.planEditor';

  async loadPlan(): Promise<ParsedPlan>;
  async savePlan(): Promise<boolean>;
  updateContent(content: string): void;
  getTodoStats(): { total, completed, pending };
}
```

### PlanEditorPane (`planCustomEditor.ts`)

Extends `EditorPane` to:

- Create container for React mounting
- Handle input changes
- Manage React component lifecycle

```typescript
export class PlanEditorPane extends EditorPane {
  static readonly ID = 'workbench.editor.voidPlanEditor';

  protected createEditor(parent: HTMLElement): void;
  async setInput(input: EditorInput, ...): Promise<void>;
  layout(dimension: Dimension): void;
}
```

### Editor Resolver

Registered with `IEditorResolverService` to handle `.void/plans/*.md` files:

```typescript
editorResolverService.registerEditor(
  '**/.void/plans/*.md',
  {
    id: PlanEditorPane.ID,
    label: 'Plan Editor',
    priority: RegisteredEditorPriority.exclusive,
  },
  {},
  {
    createEditorInput: (editorInput) => ({
      editor: instantiationService.createInstance(PlanEditorInput, resource),
    }),
  }
);
```

## Approval Workflow

### Plan Status Flow

```
planning → pending_review → approved → in-progress → paused → completed
                         ↘ rejected
```

### Commands

| Command ID | Action | Keybinding |
|------------|--------|------------|
| `void.plan.approve` | Approve plan | - |
| `void.plan.reject` | Reject plan | - |
| `void.plan.startExecution` | Start execution | `Ctrl+Shift+E` |
| `void.plan.pause` | Pause execution | - |
| `void.plan.resume` | Resume execution | - |
| `void.plan.complete` | Mark complete | - |
| `void.plan.open` | Open active plan | `Ctrl+Shift+P` |

### Context Keys

- `voidPlanStatus`: Current plan status ('planning', 'approved', etc.)
- `voidHasActivePlan`: Boolean indicating if a plan is active

### Guardrail: Block Agent Without Approval

The `BackgroundAgentService` blocks agent execution if a plan exists but isn't approved:

```typescript
startBackgroundAgent(opts) {
  const activePlan = this._planManagerService.getActivePlan();
  if (activePlan) {
    const status = activePlan.metadata.status;
    if (status !== 'approved' && status !== 'in-progress') {
      throw new PlanNotApprovedError(activePlan.metadata.title, status);
    }
  }
  // ... continue with agent creation
}
```

## Native Editor Features (`planLanguageFeatures.ts`)

### DocumentLinkProvider

Makes file paths clickable:

- Backticked paths: `` `path/to/file.ts` ``, `` `path/to/file.ts:123` ``
- List-style paths: `- \`path/to/file.ts\``

### CodeLensProvider

Adds inline actions above checklist items:

- `[ ]` → "→ Start"
- `[-]` → "✓ Mark Complete"
- `[x]` → "↩ Mark Incomplete"

### FoldingRangeProvider

Makes sections collapsible:

- YAML frontmatter
- Markdown headers (##, ###)

### DocumentSymbolProvider

Provides outline view support:

- Plan title (File symbol)
- Sections (Module symbols)
- Subsections (Property symbols)
- Checklist items (Boolean symbols with status prefix)

## React Components

### PlanEditor

Main component with two view modes:

1. **Structured View**: Visual sections with expandable panels
2. **Source View**: Raw markdown editing

Features:
- Status selector dropdown
- Save button with dirty state
- Progress overview with charts
- Collapsible section panels
- Draggable checklist

### ProgressCharts

SVG-based visualization:

- **DonutChart**: Circular progress indicator
- **StatusBreakdownBar**: Horizontal stacked bar
- **StatCards**: Individual stat displays

### DraggableTodoList

HTML5 drag-and-drop todo list:

- Drag handle for reordering
- Status toggle (pending → in_progress → completed)
- Inline editing on double-click
- Delete button
- Add new item

## Build Process

### Building React Components

```bash
cd src/vs/workbench/contrib/void/browser/react

# Build once
node build.js

# Watch mode
node build.js --watch
```

### Build Steps

1. **scope-tailwind**: `./src` → `./src2/`
   - Scopes Tailwind classes with `void-` prefix
   - Replaces `@@void-scope` with `void-scope`

2. **tsup**: `./src2/` → `./out/`
   - Bundles TypeScript/React to ES modules
   - Injects CSS into JavaScript

### Adding New React Components

1. Create component in `src/plan-editor-tsx/`
2. Add entry to `tsup.config.js`:
   ```javascript
   entry: [
     // ... existing entries
     './src2/plan-editor-tsx/index.tsx',
   ],
   ```
3. Run `node build.js`

## Troubleshooting

### CSS Not Applying

1. Verify `@@void-scope` wrapper exists
2. Check `useIsDark()` hook is called
3. Ensure `import '../styles.css'` is present
4. Rebuild React: `node build.js`

### Editor Not Opening

1. Check file matches pattern `**/.void/plans/*.md`
2. Verify `void.contribution.ts` imports `planCustomEditor.ts`
3. Check console for registration errors

### TypeScript Errors

Common fixes:
- Use `CodeLens` instead of `ICodeLensSymbol`
- Add `tags: []` to `DocumentSymbol` objects
- Use `LifecyclePhase.Restored` (not `Starting`)
- Ensure method signatures match base class

## Atomic Plan Creation (New)

### Overview

Plan creation has been redesigned to be **atomic** - a single `create_plan` tool call creates a complete plan with all sections populated. This replaces the previous incremental approach that required multiple tool calls.

### Before vs After

| Metric | Before (Incremental) | After (Atomic) |
|--------|---------------------|----------------|
| Tool calls for 25-task plan | 30+ | **1** |
| Disk I/O operations | 50+ | **1** |
| Tools in plan mode | 5 | **2** (create_plan, read_plan) |
| Plan modification | Special tools | **Direct file edit** |

### New `create_plan` Tool

```typescript
create_plan: {
    params: {
        title: string;              // Plan name
        overview: string;           // High-level description
        files: string[];            // Files to modify
        steps: string[];            // Implementation steps (numbered)
        checklist: Array<{          // ALL todos at once
            text: string;
            category?: string;      // Group: "Backend", "Frontend", "Testing"
            tool?: string;          // Hint: "edit_file", "rewrite_file", "run_terminal_cmd"
            file?: string;          // Target: "src/auth/login.ts:25-40"
        }>;
        testing?: string;           // Testing strategy
        notes?: string;             // Additional considerations
    }
}
```

### Enhanced Checklist Format

Checklist items now support tool hints and file targets:

```markdown
## Implementation Checklist

### Backend
- [ ] Create user model [tool:rewrite_file] `src/models/user.ts`
- [ ] Add validation logic [tool:edit_file] `src/utils/validators.ts:45-80`
- [ ] Run database migration [tool:run_terminal_cmd] `npm run migrate`

### Frontend
- [ ] Create login component [tool:rewrite_file] `src/components/Login.tsx`
- [ ] Add form state handling [tool:edit_file] `src/hooks/useAuth.ts`
```

### Plan Modification Workflow

After plan creation, modifications are made directly:
1. User edits the plan file in the editor
2. Or AI uses `edit_file` tool on the `.void/plans/*.md` file

No special update tools needed - plans are just Markdown files.

### Removed Tools

The following tools have been removed:
- `update_plan_section` - Use direct file editing instead
- `add_plan_todo` - Include all todos in `create_plan` call
- `mark_plan_item_complete` - Edit file directly or use Plan Editor UI

## Persistent Execution State (New)

### Overview

Plan execution state is now persisted to global storage, allowing recovery of interrupted executions after crashes or restarts.

### Storage Location

```
%APPDATA%/Code/void/execution/
├── {workspaceHash}-{planId}.json
├── {workspaceHash}-{planId2}.json
└── ...
```

- **Global storage**: Uses VS Code's `appSettingsHome/void/execution/`
- **Workspace isolation**: Files are prefixed with workspace hash to avoid collisions
- **Automatic cleanup**: Completed plans can be cleared with `clearPersistedState()`

### Persisted State Schema

```typescript
interface PersistedExecutionState {
    planId: string;
    planPath: string;
    workspacePath: string;
    workspaceId: string;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    currentStepIndex: number | null;
    completedSteps: number[];
    failedSteps: Array<{ index: number; error: string }>;
    totalSteps: number;
    toolsExecuted: number;
    filesModified: string[];
    startedAt: string;
    lastActivityAt: string;
    completedAt?: string;
    lastError?: string;
    recentTools: Array<{ toolName, timestamp, success, filesAffected }>;
}
```

### Recovery Flow

1. **On Startup**: `PlanExecutionTrackerStartupContribution` initializes at `LifecyclePhase.Restored`
2. **Load States**: Reads all `.json` files matching workspace from global storage
3. **Detect Interrupted**: Filters states with status `'running'` or `'paused'`
4. **Prompt User**: Shows notification with "Resume" or "Discard" options
5. **Resume**: Recreates in-memory state from persisted data and continues execution

### Throttled Saves

To avoid excessive disk I/O:
- Saves are batched with a 2-second delay
- Immediate save on plan completion
- Recent tools limited to last 50 entries

## Future Enhancements

- [x] Atomic plan creation (single tool call)
- [x] Enhanced checklist format with tool hints
- [x] Persistent execution state (surviving crashes)
- [ ] Revision timeline with history tracking
- [ ] Plan diff view for comparing versions
- [ ] @dnd-kit integration for smoother drag-and-drop
- [ ] Burndown chart with execution history
- [ ] "Approve and Run" combined action
