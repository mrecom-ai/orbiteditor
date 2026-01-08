# Atomic create_plan Tool Implementation (Cursor AI Style)

## Overview

This document describes the transformation of the `create_plan` tool from a multi-step incremental approach to an atomic single-call implementation, matching Cursor AI's design philosophy.

## What Changed

### Before (Multi-Step Approach)
```typescript
// Step 1: Create plan template
create_plan({ planName, overview, initialFiles })

// Step 2-N: Update sections (multiple calls)
update_plan_section({ sectionName: "steps", content: "..." })
update_plan_section({ sectionName: "testing", content: "..." })

// Step N+1-M: Add todos (multiple calls)
add_plan_todo({ todoText: "Task 1", category: "Backend" })
add_plan_todo({ todoText: "Task 2", category: "Frontend" })

// Total: 5-15 tool calls to create a complete plan
```

### After (Atomic Approach - Cursor AI Style)
```typescript
// Single call with complete content
create_plan({
  name: "User Authentication",
  overview: "Implement JWT-based authentication...",
  plan: `# User Authentication Implementation

## Approach
...complete markdown content...

## Key Files
- \`src/auth/authService.ts\` - Create new service
...
  `,
  todos: [
    { id: "create-auth-service", content: "Create authService.ts..." },
    { id: "add-middleware", content: "Implement auth middleware..." }
  ]
})

// Total: 1 tool call to create a complete plan
```

## Key Features

### 1. **Atomic Plan Creation**
- Single tool call creates complete plan with all content
- No follow-up calls needed for sections or todos
- 5-15x reduction in tool calls (from 5-15 calls to 1 call)

### 2. **New Parameters**
```typescript
{
  name: string | null,        // "User Authentication" (3-4 words, optional)
  overview: string,           // 1-2 sentence summary (required)
  plan: string,              // Full markdown content (required, NEW)
  todos: TodoItem[]          // Structured todos with IDs (NEW)
}

interface TodoItem {
  id: string,      // Unique ID: "setup-auth" (lowercase, hyphens, alphanumeric)
  content: string  // Task description: "Setup JWT authentication system"
}
```

### 3. **Todo ID System**
- Each todo has a unique identifier for tracking and referencing
- IDs are preserved in markdown as HTML comments:
  ```markdown
  - [ ] Setup JWT authentication system <!-- id:setup-auth -->
  - [ ] Add authentication middleware <!-- id:add-middleware -->
  ```
- Enables better task tracking and progress monitoring
- IDs survive drag-and-drop reordering in the UI

### 4. **Validation Rules**
The tool enforces Cursor AI's content guidelines:
- **Plan must start with level 1 heading**: First line must be `# Title`
- **No markdown tables allowed**: Use bullet lists instead (tables discouraged for clarity)
- **Todo IDs must be unique**: No duplicate IDs within a plan
- **Todo ID format**: lowercase, hyphens, alphanumeric only (e.g., "setup-auth")

## Files Modified

### Core Implementation

#### 1. `src/vs/workbench/contrib/void/common/toolsServiceTypes.ts`
**Changes:**
- Added `TodoItem` interface with `id` and `content` fields
- Updated `create_plan` parameters from `{planName, overview, initialFiles}` to `{name, overview, plan, todos}`

```typescript
// Plan todo item with unique ID for tracking
export interface TodoItem {
    id: string;
    content: string;
}

export type BuiltinToolCallParams = {
    'create_plan': {
        name: string | null,
        overview: string,
        plan: string,          // NEW: Full markdown content
        todos: TodoItem[]      // NEW: Structured todos
    },
    // ... other tools
}
```

#### 2. `src/vs/workbench/contrib/void/common/planTemplate.ts`
**Changes:**
- Re-exported `TodoItem` from toolsServiceTypes for convenience
- Added `ValidationResult` interface for validation functions
- Added `CreateAtomicPlanOptions` interface for new plan creation
- Implemented validation functions:
  - `validateTodoId(id: string): boolean` - Validates ID format
  - `validatePlanContent(content: string): ValidationResult` - Validates plan rules
  - `validateTodos(todos: TodoItem[]): ValidationResult` - Validates todos structure
- Implemented todo conversion utilities:
  - `todosToMarkdown(todos: TodoItem[]): string` - Converts to markdown with ID comments
  - `parseTodosFromMarkdown(content: string): TodoItem[]` - Extracts todos with IDs
- Implemented atomic plan generator:
  - `createAtomicPlanContent(opts: CreateAtomicPlanOptions): string` - Creates complete plan in one call

**Key Functions:**

```typescript
// Validates plan content according to Cursor AI rules
export function validatePlanContent(content: string): ValidationResult {
    // Rule 1: First line must be # heading
    // Rule 2: No markdown tables
    return { valid: true } | { valid: false, error: "..." };
}

// Validates todos array structure and IDs
export function validateTodos(todos: TodoItem[]): ValidationResult {
    // Check unique IDs
    // Check ID format (lowercase, hyphens, alphanumeric)
    // Check content not empty
    return { valid: true } | { valid: false, error: "..." };
}

// Converts todos to markdown with ID preservation
export function todosToMarkdown(todos: TodoItem[]): string {
    return todos.map(todo =>
        `- [ ] ${todo.content} <!-- id:${todo.id} -->`
    ).join('\n');
}

// Creates complete atomic plan content
export function createAtomicPlanContent(opts: CreateAtomicPlanOptions): string {
    // 1. Validate plan content and todos
    // 2. Build YAML frontmatter
    // 3. Append todos section if not present
    // 4. Return complete content
}
```

#### 3. `src/vs/workbench/contrib/void/browser/toolsService.ts`
**Changes:**
- Updated imports: Removed `createPlanContent` and `validateTodos` (unused)
- Updated `create_plan` parameter validation (lines 464-496):
  - Parse `name`, `overview`, `plan`, and `todos` parameters
  - Validate todo structure (id and content fields)
- Updated `create_plan` execution logic (lines 1062-1122):
  - Use `createAtomicPlanContent()` instead of legacy `createPlanContent()`
  - Pass full plan markdown and todos array
  - Validate content before writing
- Updated success message to mention editing with `edit_file`

**Parameter Validation:**
```typescript
create_plan: (params: RawToolParamsObj): BuiltinToolCallParams['create_plan'] => {
    const name = validateOptionalStr('name', params.name);
    const overview = validateStr('overview', params.overview);
    const plan = validateStr('plan', params.plan);
    let todos: TodoItem[] = [];

    if (params.todos) {
        // Parse JSON or array
        // Validate structure (id and content fields)
    }

    return { name, overview, plan, todos };
}
```

**Execution Logic:**
```typescript
create_plan: async (params: BuiltinToolCallParams['create_plan']) => {
    const { name, overview, plan, todos } = params;

    // Generate filename and path
    const effectiveName = name || 'Implementation Plan';
    const fileName = generatePlanFileName(effectiveName);
    const planUri = URI.joinPath(plansDirUri, fileName);

    // Use atomic plan content generator (Cursor AI style)
    const planContent = createAtomicPlanContent({
        name: effectiveName,
        overview,
        plan,
        todos,
        metadata: { ... }
    });

    // Write, open, capture metrics
    await fileService.writeFile(planUri, VSBuffer.fromString(planContent));
    this._activePlanPath = planUri.fsPath;
    await this.commandService.executeCommand('vscode.open', planUri);

    return {
        result: {
            planPath: planUri.fsPath,
            planName: effectiveName
        }
    };
}
```

### Tool Definition & Prompts

#### 4. `src/vs/workbench/contrib/void/common/prompt/prompts.ts`
**Changes:**
- Rewrote `create_plan` tool definition (lines 853-943) with:
  - New description emphasizing atomic single-call creation
  - Updated parameters (name, overview, plan, todos)
  - Comprehensive guidelines for plan content and todos
  - Updated workflow: RESEARCH → CLARIFY → DESIGN → CREATE → PRESENT
  - Complete example showing full plan markdown + todos array
- Added deprecation notices to legacy tools:
  - `update_plan_section` - "⚠️ LEGACY TOOL: Prefer editing plan files directly with edit_file"
  - `add_plan_todo` - "⚠️ LEGACY TOOL: Use create_plan with todos array instead"
  - `mark_plan_item_complete` - "⚠️ LEGACY TOOL: For existing plans, edit the file directly"
- Updated PLAN mode workflow (lines 1203-1224):
  - Changed from DOCUMENT step to CREATE step
  - Emphasized single atomic call
  - Noted legacy tools are deprecated
- Updated tool usage patterns (lines 1250-1257):
  - Added note: "Do NOT use update_plan_section or add_plan_todo (legacy tools)"

**New Tool Description:**
```typescript
create_plan: {
    name: 'create_plan',
    description: `Create a complete implementation plan in a single atomic operation.

**WHEN TO USE:**
- After completing research and understanding the task
- After asking clarifying questions (use AskUserQuestion before, not in the plan)
- When ready to present a finalized, actionable plan

**PLAN CONTENT GUIDELINES:**
- Must start with level 1 markdown heading (# Plan Title)
- Be concise and glanceable - minimum detail for understanding
- Identify key files to modify with specific paths
- Cite essential code snippets where relevant
- NO MARKDOWN TABLES (use bullet lists instead)
- Focus on high-level decisions, not low-level implementation

**TODO ORGANIZATION:**
- Use for complex plans that need task breakdown
- Each todo needs unique ID (lowercase, hyphens, e.g., "setup-auth") and clear content
- Simple plans may have few todos or none at all
- Make todos specific, actionable, and trackable

**WORKFLOW:**
1. RESEARCH: Run parallel searches/reads to understand the codebase
2. CLARIFY: Ask critical questions BEFORE creating plan (use AskUserQuestion)
3. DESIGN: Synthesize findings into implementation approach
4. CREATE: Call create_plan ONCE with complete content
5. PRESENT: Summarize plan and guide user to review

**UPDATING PLANS:**
- This tool creates a NEW plan file each time
- To update existing plans, use edit_file tool directly
- Do NOT call this tool again to modify an existing plan`,

    params: {
        name: { description: 'Short 3-4 word name...' },
        overview: { description: '1-2 sentence high-level summary...' },
        plan: { description: 'Complete markdown plan content. Must start with # heading...' },
        todos: { description: 'Array of todo objects with unique id and content...' }
    },

    example: `<create_plan>
<name>User Authentication</name>
<overview>Implement JWT-based authentication...</overview>
<plan>
# User Authentication Implementation

## Approach
...

## Key Files
- \`src/auth/authService.ts\` - Create new service
...
</plan>
<todos>[
  {"id": "create-auth-service", "content": "Create authService.ts..."},
  {"id": "add-middleware", "content": "Implement authentication middleware..."}
]</todos>
</create_plan>`
}
```

### Visualization Components

#### 5. `src/vs/workbench/contrib/void/browser/react/src2/plan-editor-tsx/PlanEditor.tsx`
**Changes:**
- Updated `parseChecklistItems()` function (lines 49-93):
  - Extracts todo IDs from HTML comments: `<!-- id:todo-id -->`
  - Removes ID comment from displayed content
  - Falls back to auto-generated ID if not found
- Updated `serializeChecklistItems()` function (lines 95-105):
  - Preserves todo IDs as HTML comments when saving
  - Format: `- [x] Task content <!-- id:task-id -->`

**Parse Function:**
```typescript
function parseChecklistItems(content: string): TodoItem[] {
    const items: TodoItem[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const match = line.match(/^- \[([ xX\-~])\] (.+)$/);
        if (match) {
            const [, statusChar, fullText] = match;

            // Extract ID from HTML comment if present
            const idMatch = fullText.match(/<!--\s*id:([a-z0-9-]+)\s*-->$/);
            let id: string;
            let content: string;

            if (idMatch) {
                id = idMatch[1];
                content = fullText.replace(/\s*<!--\s*id:[a-z0-9-]+\s*-->$/, '').trim();
            } else {
                id = `todo-${Date.now()}-${index}`;
                content = fullText;
            }

            items.push({ id, content, status, lineIndex: index });
        }
    });

    return items;
}
```

**Serialize Function:**
```typescript
function serializeChecklistItems(items: TodoItem[]): string {
    return items.map((item) => {
        const statusChar = item.status === 'completed' ? 'x' :
            item.status === 'in_progress' ? '-' : ' ';
        return `- [${statusChar}] ${item.content} <!-- id:${item.id} -->`;
    }).join('\n');
}
```

#### 6. `src/vs/workbench/contrib/void/browser/react/src2/plan-editor-tsx/DraggableTodoList.tsx`
**No changes needed** - Already uses `TodoItem` interface with `id` and `content` fields. The component automatically preserves IDs during drag-and-drop operations thanks to the serialization changes in PlanEditor.tsx.

## Workflow Comparison

### Old Multi-Step Workflow
```
User: "Create a plan for user authentication"

AI: Let me create a plan template
    → create_plan({ planName: "User Authentication", overview: "..." })

AI: Let me add the implementation steps
    → update_plan_section({ sectionName: "steps", content: "..." })

AI: Let me add the testing strategy
    → update_plan_section({ sectionName: "testing", content: "..." })

AI: Let me add todo items
    → add_plan_todo({ todoText: "Create authService", category: "Backend" })
    → add_plan_todo({ todoText: "Add middleware", category: "Backend" })
    → add_plan_todo({ todoText: "Write tests", category: "Testing" })

AI: Here's your plan (after 6 tool calls)

Total: 6 tool calls, fragmented mental model
```

### New Atomic Workflow (Cursor AI Style)
```
User: "Create a plan for user authentication"

AI: Let me research the codebase first
    → read_file, search_in_file (parallel searches)

AI: Now I'll create a complete plan
    → create_plan({
        name: "User Authentication",
        overview: "Implement JWT-based authentication...",
        plan: `# User Authentication Implementation

## Approach
Implement JWT token-based authentication using existing middleware patterns...

## Key Files
- \`src/auth/authService.ts\` - Create new service with token generation
- \`src/middleware/authMiddleware.ts\` - Add JWT verification middleware
...

## Testing
- Unit tests for token generation/verification
- Integration tests for login/logout flows
        `,
        todos: [
            { id: "create-auth-service", content: "Create authService.ts..." },
            { id: "add-middleware", content: "Implement auth middleware..." },
            { id: "write-tests", content: "Write unit and integration tests..." }
        ]
    })

AI: Plan created successfully. Review it in the editor and let me know if you'd like any changes.

Total: 1 tool call, clear mental model
```

## Benefits

### 1. **Performance**
- **5-15x fewer tool calls**: Single atomic call vs 5-15 incremental calls
- **Faster planning**: Complete plan in one turn (no back-and-forth)
- **Reduced latency**: No multi-round tool execution overhead

### 2. **User Experience**
- **Clearer workflow**: Research → Clarify → Create (done)
- **Complete plans**: All content in one place, not scattered across calls
- **Better tracking**: Unique todo IDs enable referencing and progress monitoring
- **Glanceable**: Concise plans with minimum detail for understanding

### 3. **Developer Experience**
- **Simpler code**: One content generator vs multiple updaters
- **Easier testing**: Single function to validate
- **Better maintainability**: Fewer code paths, cleaner abstractions
- **Type safety**: Structured todos with TypeScript interfaces

### 4. **AI Experience**
- **Natural workflow**: Write complete plan, not fragments
- **Fewer context switches**: No mental model of template sections
- **More flexible**: Custom markdown structure, not rigid template
- **Less error-prone**: One validation step vs multiple partial validations

## Backward Compatibility

### Legacy Tools Still Available
The following tools remain functional for backward compatibility:
- `update_plan_section` - Update specific plan sections
- `add_plan_todo` - Add individual todo items
- `mark_plan_item_complete` - Mark todos as complete

**Note:** These tools are marked as deprecated with clear warnings directing users to the new atomic approach or direct file editing.

### Migration Strategy
1. **New plans**: Always use atomic `create_plan` with full content
2. **Existing plans**:
   - Use `edit_file` tool to modify plan files directly
   - Legacy tools still work if needed for specific updates
3. **Gradual transition**: No breaking changes, users can adopt atomic approach at their own pace

## Validation Examples

### Valid Plan
```markdown
# User Authentication Implementation

## Approach
Implement JWT token-based authentication...

## Key Files
- `src/auth/authService.ts` - Token generation
- `src/middleware/authMiddleware.ts` - JWT verification

## Implementation Details
1. **Token Generation**
   - Use `jsonwebtoken` library
   - 24hr expiry, refresh token support

2. **Middleware Integration**
   - Add to existing middleware chain
   - Protect routes with `authenticate` wrapper
```
✅ Starts with `#` heading, no tables, clear structure

### Invalid Plan - Missing Heading
```markdown
This is a plan for user authentication

## Approach
...
```
❌ Error: "Plan must start with level 1 heading (# Title)"

### Invalid Plan - Has Tables
```markdown
# User Authentication

## Files
| File | Description |
|------|-------------|
| authService.ts | Token generation |
```
❌ Error: "Markdown tables not allowed. Use bullet lists instead."

### Valid Todos
```json
[
  { "id": "setup-auth", "content": "Setup JWT authentication system" },
  { "id": "add-middleware", "content": "Implement auth middleware" }
]
```
✅ Unique IDs, valid format (lowercase, hyphens, alphanumeric)

### Invalid Todos - Duplicate IDs
```json
[
  { "id": "setup-auth", "content": "Setup JWT..." },
  { "id": "setup-auth", "content": "Another task" }
]
```
❌ Error: "Todo IDs must be unique"

### Invalid Todos - Bad ID Format
```json
[
  { "id": "Setup_Auth", "content": "Setup JWT..." }
]
```
❌ Error: "Invalid todo ID 'Setup_Auth'. Use lowercase, hyphens, and alphanumeric only."

## Testing

### Manual Testing Steps
1. **Create atomic plan via tool:**
   - Call `create_plan` with full plan + todos
   - Verify plan file created in `.void/plans/`
   - Verify YAML frontmatter present
   - Verify custom markdown content rendered
   - Verify todos appear with ID comments

2. **Validate restrictions:**
   - Test plan without `#` heading → should reject
   - Test plan with table → should reject
   - Test duplicate todo IDs → should reject
   - Test invalid ID format → should reject

3. **Test visualization:**
   - Open plan in editor
   - Verify todos are draggable
   - Verify IDs preserved after drag-drop
   - Toggle todo status → ID preserved

4. **Test updates:**
   - Edit plan file directly with `edit_file`
   - Verify changes reflected in editor
   - Verify no need for special update tools

### Compilation
All TypeScript code compiles without errors after the following fixes:
- Exported `TodoItem` from planTemplate.ts
- Removed unused imports from toolsService.ts
- Fixed unused variable in createAtomicPlanContent()

## Future Enhancements

### Potential Improvements
1. **Auto-generate todo IDs**: If IDs not provided, generate kebab-case IDs from content
2. **ID badges in UI**: Display todo IDs as visual badges in the plan editor
3. **Todo references**: Allow referencing todos by ID in plan content (`ref:setup-auth`)
4. **Plan templates**: Predefined plan structures for common tasks
5. **Plan versioning**: Track changes to plans over time with git-like history
6. **Collaborative editing**: Multi-user plan editing with conflict resolution

## Troubleshooting

### Common Issues

**Issue: Plan validation fails with "must start with # heading"**
- **Solution**: Ensure first line of plan content is `# Title`, not `## Title` or regular text

**Issue: Todo IDs not preserved after editing**
- **Solution**: Check that PlanEditor.tsx serialization includes ID comments (`<!-- id:... -->`)

**Issue: Duplicate tool_use IDs error from API**
- **Solution**: This is unrelated to plan tool changes - check message history for duplicate tool calls in conversation

**Issue: Legacy tools still being used**
- **Solution**: Update prompts to emphasize atomic creation, check tool descriptions have deprecation notices

## Summary

This implementation successfully transforms the `create_plan` tool from a multi-step incremental approach to a single atomic operation matching Cursor AI's design. Key achievements:

✅ **Single atomic call** - Complete plans in one tool invocation
✅ **Full markdown content** - Custom plan structure, not rigid templates
✅ **Structured todos with IDs** - Better tracking and referencing
✅ **Validation rules** - Ensures quality (no tables, proper headings)
✅ **React visualization** - Preserves todo IDs through UI interactions
✅ **Backward compatible** - Legacy tools still functional with deprecation notices
✅ **Clear documentation** - Comprehensive guide for future developers

The result is a faster, more intuitive planning experience that aligns with modern AI tool design patterns while maintaining full compatibility with existing functionality.
