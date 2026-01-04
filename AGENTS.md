# AGENTS.md - Void Editor Agent Architecture

## Overview

This document defines production-quality agent workflows for contributors working on the **Void Editor** codebase. Void is a fork of VSCode that integrates AI capabilities for code editing, chat, and automation.

**MANDATORY PRINCIPLE**:
> **Never edit code until you understand the codebase structure, runtime states, and current issues.**

All agents MUST follow the 5-step workflow: **Understand → Diagnose → Plan → Execute → Verify**.

---

## Repository Profile

### Tech Stack

**Core Technologies:**
- **Language**: TypeScript (ES modules, ~5400+ .ts files)
- **Runtime**: Electron 34.3.2 (dual-process: main + browser/renderer)
- **UI Framework**: React 19 (for Void-specific UI components)
- **Base**: VSCode fork (preserves all VSCode architecture patterns)

**Build System:**
- **Task Runner**: Gulp (gulpfile.js orchestrates compilation)
- **TypeScript Compilation**: Custom build pipeline via `build/lib/`
- **React Bundler**: tsup (for React components in `src/vs/workbench/contrib/void/browser/react/`)
- **Scripts**: npm scripts in package.json (`compile`, `watch`, `buildreact`, etc.)

**Key Dependencies:**
- AI SDKs: `@anthropic-ai/sdk`, `openai`, `@google/genai`, `@mistralai/mistralai`, `groq-sdk`, `ollama`
- MCP: `@modelcontextprotocol/sdk` (Model Context Protocol for tool integrations)
- Native modules: `node-pty`, `kerberos`, `@vscode/sqlite3`, `@parcel/watcher`
- UI: `framer-motion`, `lucide-react`, `react-tooltip`, `tailwindcss`
- Other: `marked` (markdown), `mermaid` (diagrams), `puppeteer-core` (browser automation)

**Testing:**
- Unit tests: Mocha (`test/unit/`)
- Browser tests: Playwright (`test-browser` script)
- Integration tests: `test/integration/`, `test/smoke/`
- Test runners: Custom VSCode test infrastructure

**Linting & Formatting:**
- **ESLint**: `eslint.config.js` with custom plugins in `.eslint-plugin-local/`
- **TypeScript**: Strict typing, custom local rules (layering, import patterns, service branding)
- **Style**: `tsfmt.json` (tabs, space conventions)
- **Key Rules**:
  - Code layering enforcement (common → browser → electron-main)
  - No dangerous type assertions
  - Service brand declarations required
  - Import pattern restrictions by layer

### Architecture Patterns

**VSCode Architecture:**
```
┌─────────────────────────────────────────┐
│  Electron Main Process                  │
│  - Node.js access                       │
│  - File system, native modules          │
│  - LLM message sending (avoids CSP)     │
│  - electron-main/ code                  │
└──────────────┬──────────────────────────┘
               │ IPC
┌──────────────▼──────────────────────────┐
│  Browser/Renderer Process               │
│  - UI rendering (HTML/CSS/JS)           │
│  - Editor, Monaco, React components     │
│  - browser/ code (can use window, DOM)  │
│  - Cannot import node_modules directly  │
└─────────────────────────────────────────┘
```

**Service-Oriented Design:**
- **Services**: Singletons registered with `registerSingleton()` (see `_dummyContrib.ts` for examples)
- **Dependency Injection**: Constructor parameters with `@IServiceName`
- **Core Void Services**:
  - `IVoidSettingsService` - provider/model settings
  - `IEditCodeService` - code diffs, streaming edits, Apply logic
  - `ILLMMessageService` - sends messages to LLM providers
  - `IToolsService` - handles tool calls (read_file, edit_file, run_command, etc.)
  - `ITerminalToolService` - terminal automation
  - `IVoidModelService` - file URI/model management
  - `IChatThreadService` - chat history and threads
  - `IConvertToLLMMessageService` - transforms chat state to provider-specific formats

**Layering (STRICTLY ENFORCED by ESLint):**
```
common/         ← Can be used by both processes, no special imports
  ↓
browser/        ← Renderer process only, can use window/DOM
  ↓
electron-sandbox/  ← Renderer with limited Electron APIs
  ↓
node/           ← Node.js process, can import node_modules
  ↓
electron-main/  ← Main process, full Electron + Node.js access
```

**Void-Specific Modules** (`src/vs/workbench/contrib/void/`):
```
void/
├── browser/                    # Renderer process code
│   ├── editCodeService.ts      # DiffZones, Apply logic (Fast/Slow)
│   ├── sidebarPane.ts          # Sidebar UI registration
│   ├── sidebarActions.ts       # Ctrl+L keybinds
│   ├── quickEditActions.ts     # Ctrl+K keybinds
│   ├── autocomplete/           # Inline autocomplete
│   ├── toolsService.ts         # Tool call orchestration
│   ├── terminalToolService.ts  # Terminal commands
│   └── react/                  # React components (built separately)
│       ├── src/
│       │   ├── sidebar-tsx/    # Chat UI
│       │   ├── markdown/       # Markdown rendering
│       │   ├── void-settings-tsx/  # Settings UI
│       │   └── ...
│       ├── build.js            # React build script
│       ├── tsup.config.js      # Bundler config
│       └── out/                # Compiled React output
│
├── common/                     # Shared code
│   ├── sendLLMMessageTypes.ts  # LLM message type definitions
│   ├── toolsServiceTypes.ts    # Tool definitions
│   ├── voidSettingsService.ts  # Settings state management
│   ├── voidSettingsTypes.ts    # Settings types
│   ├── editCodeServiceTypes.ts # DiffZone, DiffArea types
│   ├── chatThreadServiceTypes.ts # Chat message types
│   ├── modelCapabilities.ts    # Provider/model configs
│   └── prompt/prompts.ts       # System prompts, tool definitions
│
└── electron-main/              # Main process code
    ├── llmMessage/
    │   └── sendLLMMessage.impl.ts  # LLM API calls
    ├── sendLLMMessageChannel.ts    # IPC channel setup
    └── mcpChannel.ts               # MCP server management
```

**Key Data Flows:**

1. **LLM Message Pipeline**:
   ```
   User Input (Sidebar React)
     → IChatThreadService (stores message)
     → IConvertToLLMMessageService (formats for provider)
     → ILLMMessageService (browser, sends to main via IPC)
     → sendLLMMessage.impl.ts (electron-main, calls API)
     → Streams response back via IPC
     → Updates chat thread
   ```

2. **Apply/Edit Code Flow**:
   ```
   User clicks "Apply"
     → IEditCodeService.startApplying()
     → Creates DiffZone (tracks region)
     → Sends LLM request with Search/Replace prompt (Fast Apply)
       OR whole-file rewrite (Slow Apply)
     → Streams response, extracts Search/Replace blocks
     → Computes diffs (findDiffs helper)
     → Renders red/green diff decorations
     → User accepts/rejects → applies to ITextModel
   ```

3. **Tool Call Flow**:
   ```
   LLM requests tool (e.g., read_file)
     → IToolsService.validateToolCall() (validates params)
     → Checks approval state (approved tools auto-run)
     → IToolsService.callTool() (executes)
     → Returns result to LLM as tool_result message
   ```

**State Management:**
- **Immutable Updates**: Services like `voidSettingsService` maintain immutable state, emit `onDidChangeState` events
- **DiffAreas**: Tracked per-file, per-region (`DiffZone`, `CtrlKZone`, `TrackingZone`)
- **Chat Threads**: Stored in `chatThreadService`, persisted to storage
- **Approval States**: Tools have approval types (edits, terminal, browser_automation, MCP tools)

### Build Commands

**Development:**
```bash
npm install                    # Install dependencies
npm run watch                  # Watch mode (compiles TypeScript)
npm run watchreact             # Watch React components only
npm run buildreact             # Build React once
./scripts/code.sh              # Launch developer mode (Mac/Linux)
./scripts/code.bat             # Launch developer mode (Windows)
```

**Testing:**
```bash
npm test                       # Runs appropriate test suite
npm run test-node              # Node unit tests (Mocha)
npm run test-browser           # Browser unit tests (Playwright)
./scripts/test.sh              # Full Electron unit tests
./scripts/test-integration.sh  # Integration tests
```

**Linting:**
```bash
npm run eslint                 # Run ESLint
npm run stylelint              # Run Stylelint (CSS)
npm run hygiene                # Code hygiene checks (via Gulp)
```

**Build:**
```bash
npm run compile                # Compile all
npm run compile-client         # Compile client only (faster)
npm run compile-build          # Production build with mangling
```

### Configuration Files

**Critical Files to Understand:**
- `package.json` - Scripts, dependencies, versions
- `product.json` - Product configuration (name, version, update URLs)
- `gulpfile.js` → `build/gulpfile.js` - Main build orchestration
- `eslint.config.js` - Linting rules (MUST follow for PRs)
- `tsfmt.json` - TypeScript formatting rules
- `tsconfig.json` - TypeScript compiler config (multiple per module)
- `src/vs/workbench/contrib/void/browser/react/tsup.config.js` - React bundler config

**Important Patterns:**
- All TypeScript imports MUST end in `.js` (ES module convention)
- React component imports from `react/src/` must use relative paths ending in `.js`
- Services use `createDecorator()` and `registerSingleton()`
- Actions registered with `registerAction2()` or `MenuRegistry.appendMenuItem()`

### Known Issues & Technical Debt

**From Code TODOs/FIXMEs (sampled 30+ occurrences):**

1. **Model Capabilities** (`modelCapabilities.ts`):
   - ❗ "TODO!!! double check all context sizes below"
   - ❗ "TODO!!! add openrouter common models"
   - ❗ "TODO!!! allow user to modify capabilities and tell them if autodetected model or falling back"
   - ❗ Pricing info incomplete for some models (e.g., o1 thinking costs, Claude token-tier pricing)

2. **TODO List Feature** (`chatThreadService.ts`, `toolsService.ts`):
   - Multiple TODOs around parsing, validation, UI state
   - Feature is functional but marked for future improvements

3. **Code Quality**:
   - `HACK` comment in `convertToLLMMessageService.ts` (system message handling)
   - Some logic marked "TODO make this logic more general" (code symbol detection)
   - Autocomplete test mode check "TODO remove this"

4. **React Build**:
   - Must manually run `npm run buildreact` after React changes (not auto-watched by default `npm run watch`)
   - React imports must end in `.js` or build fails with cryptic errors

5. **CI/CD**:
   - Minimal CI in this repo (only issue triage workflow)
   - Main build/release happens in separate `void-builder` repo

**Security Considerations:**
- No hardcoded secrets detected in sampled files
- API keys stored via `IEncryptionService`
- MCP server config allows arbitrary code execution (by design)

**Repo Health:**
- ✅ Active development (recent commits)
- ⚠️ No unit tests found in `src/vs/workbench/contrib/void/` (test coverage TBD)
- ⚠️ Large codebase (5400+ .ts files, inherited from VSCode)
- ✅ Good documentation (VOID_CODEBASE_GUIDE.md, HOW_TO_CONTRIBUTE.md)
- ⚠️ Some commented-out imports (unused code?)

---

## Agent Profiles

### 1. Explorer Agent

**Purpose**: Map and understand the codebase before any changes are made. The Explorer gathers context, locates relevant code, and builds a mental model of the system.

**Inputs Expected:**
- User task description
- Relevant file paths or feature areas
- Vague requirements that need clarification

**Mandatory Pre-Checks:**
1. ✅ Verify workspace is the Void repository
2. ✅ Check git status (uncommitted changes? correct branch?)
3. ✅ Read `VOID_CODEBASE_GUIDE.md` if unfamiliar with architecture
4. ✅ Identify which layer (common/browser/electron-main) the change belongs to

**Workflow Steps:**

#### 1. UNDERSTAND
- **Locate Entry Points**:
  - For Void features: Start at `src/vs/workbench/contrib/void/browser/void.contribution.ts`
  - For keybindings: Check `sidebarActions.ts` or `quickEditActions.ts`
  - For services: Find service definition (e.g., `IEditCodeService`)
  - For UI: Check `react/src/` folders

- **Map Dependencies**:
  - Use `Read` tool to examine imports
  - Trace service dependencies via constructor injection (`@IServiceName`)
  - Understand data flow (e.g., user input → service → LLM → response)

- **Read Documentation**:
  - Check `README.md` files in subdirectories (e.g., `autocomplete/README.md`)
  - Review `VOID_CODEBASE_GUIDE.md` for relevant sections
  - Look for inline comments explaining complex logic

- **Identify Core Modules**:
  - What services are involved?
  - What types are used? (check `*Types.ts` files)
  - Are there existing patterns to follow?

- **Clarify Runtime States**:
  - What state is managed? (e.g., `VoidSettingsState`, `DiffZone` state)
  - How is state updated? (immutable? events?)
  - What lifecycle events matter? (mount, dispose, refresh)

- **Confirm Constraints**:
  - Which layer? (common/browser/electron-main)
  - Can I import node_modules here? (only in electron-main/node)
  - What ESLint rules apply? (check `eslint.config.js`)
  - Are there TypeScript type requirements? (Service brands, etc.)

#### 2. DIAGNOSE
(Explorer typically doesn't diagnose bugs, but may identify gaps in understanding)

- **Identify Knowledge Gaps**:
  - What parts of the codebase are unclear?
  - Are there missing types or undocumented functions?
  - Do I need to ask the user for clarification?

#### 3. PLAN
- **Document Findings**:
  - List relevant files (with line ranges if applicable)
  - Summarize data flow (ASCII diagram if helpful)
  - Note any constraints or gotchas

- **Define Exploration Boundaries**:
  - What do I NOT need to understand for this task?
  - Can I defer some complexity for later?

#### 4. EXECUTE
- Produce a **Context Report** with:
  - **Relevant Files**: List with brief descriptions
  - **Key Patterns**: How similar features are implemented
  - **Constraints**: Layering, types, dependencies
  - **Recommendations**: Where to make changes, what to avoid

#### 5. VERIFY
- ✅ Context report is accurate (re-read key files if needed)
- ✅ User confirms understanding aligns with their intent

**Rules & Constraints:**
- ❌ NEVER make assumptions about APIs without reading the code
- ❌ NEVER skip reading `*Types.ts` files (they define contracts)
- ❌ NEVER proceed to coding without a clear mental model
- ✅ ALWAYS use semantic search or grep to find relevant code
- ✅ ALWAYS check multiple examples of similar features
- ✅ ALWAYS ask clarifying questions if user intent is ambiguous

**Done Criteria:**
- [ ] All relevant files identified and read
- [ ] Data flow documented (even if informal)
- [ ] Constraints and patterns understood
- [ ] User approves exploration findings before moving to implementation

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Assuming VSCode patterns without checking Void-specific overrides
  - ✅ **Prevention**: Always check `void/` directory first for Void-specific implementations

- ❌ **Failure**: Missing React build step when exploring UI components
  - ✅ **Prevention**: Note if changes require `npm run buildreact`

- ❌ **Failure**: Overlooking layering rules (e.g., importing node_modules in browser/)
  - ✅ **Prevention**: Check file path, consult `eslint.config.js` layering rules

---

### 2. Implementer Agent

**Purpose**: Write production-quality code ONLY after Explorer has completed analysis. The Implementer follows existing patterns, respects constraints, and writes testable, maintainable code.

**Inputs Expected:**
- Context report from Explorer (or equivalent understanding)
- Specific implementation requirements
- Acceptance criteria (what "done" looks like)

**Mandatory Pre-Checks:**
1. ✅ Explorer phase is complete (context is understood)
2. ✅ Relevant files identified and patterns studied
3. ✅ Layering constraints confirmed (common/browser/electron-main)
4. ✅ Build is passing (`npm run watch` running without errors)
5. ✅ No uncommitted changes that could interfere

**Workflow Steps:**

#### 1. UNDERSTAND
- **Confirm Scope**:
  - What files need modification?
  - Are new files needed? (Check naming conventions)
  - What is the minimal change required?

- **Review Patterns**:
  - Re-read similar implementations
  - Check for helper functions/utilities to reuse
  - Note any anti-patterns to avoid

#### 2. DIAGNOSE
(If implementing a bug fix)

- **Reproduce the Issue**:
  - Follow steps in issue description
  - Verify the bug exists in current codebase
  - Understand why the current code fails

- **Identify Root Cause**:
  - Use debugger or console.log if needed
  - Trace execution path
  - Check for edge cases

#### 3. PLAN
- **Design Solution**:
  - Option A vs Option B (if multiple approaches exist)
  - Why is this approach best? (minimal, safe, maintainable)

- **List Exact Changes**:
  - File X: Add function Y
  - File Z: Modify line N to handle case W

- **Define Tests**:
  - What tests to add? (unit, integration)
  - How to manually verify? (steps to reproduce)

- **Define Done Criteria**:
  - [ ] Feature works as expected
  - [ ] No linting errors
  - [ ] No TypeScript errors
  - [ ] Tests pass (if applicable)
  - [ ] Code follows existing patterns
  - [ ] Documentation updated (if needed)

#### 4. EXECUTE
- **Implement Changes**:
  - Follow existing code style (tabs, spacing per `tsfmt.json`)
  - Use TypeScript types rigorously (no `any` unless necessary)
  - Add JSDoc comments for public APIs
  - Handle errors gracefully (no silent failures)

- **Write Tests** (if applicable):
  - Add to appropriate test directory
  - Follow existing test patterns (Mocha + assert)
  - Cover happy path + edge cases

- **Update Documentation**:
  - Update README.md if adding a feature
  - Add inline comments for complex logic
  - Update `VOID_CODEBASE_GUIDE.md` if architecture changes

**Void-Specific Implementation Rules:**

1. **Service Registration**:
   ```typescript
   // Define service interface
   export interface IMyService {
       readonly _serviceBrand: undefined;
       myMethod(): void;
   }
   export const IMyService = createDecorator<IMyService>('myService');

   // Implement service
   class MyService implements IMyService {
       declare readonly _serviceBrand: undefined;
       constructor(
           @IOtherService private readonly otherService: IOtherService
       ) {}
       myMethod(): void { /* ... */ }
   }

   // Register singleton
   registerSingleton(IMyService, MyService, InstantiationType.Eager);
   ```

2. **React Components**:
   - Place in `src/vs/workbench/contrib/void/browser/react/src/`
   - Keep folder depth shallow (1 level deep for auto-detection)
   - Use `mountFnGenerator()` for mounting into VSCode
   - Run `npm run buildreact` after changes
   - Imports MUST end in `.js`:
     ```typescript
     import { myUtil } from '../../../../../common/helpers/util.js'; // ✅ Correct
     import { myUtil } from '../../../../../common/helpers/util';    // ❌ Wrong
     ```

3. **Type Safety**:
   - Use `*Types.ts` files for shared types
   - Avoid `any`, prefer `unknown` if type is truly unknown
   - Use discriminated unions for complex state:
     ```typescript
     type State =
       | { status: 'idle' }
       | { status: 'loading', progress: number }
       | { status: 'success', data: string }
       | { status: 'error', error: Error };
     ```

4. **Event Emitters**:
   ```typescript
   import { Emitter, Event } from '../../../../base/common/event.js';

   private readonly _onDidChange = this._register(new Emitter<void>());
   readonly onDidChange: Event<void> = this._onDidChange.event;

   // Later:
   this._onDidChange.fire();
   ```

5. **Layering**:
   - ❌ NEVER import node_modules in `browser/` or `common/`
   - ✅ Use IPC channels to call main process if Node.js is needed
   - ✅ Check `eslint.config.js` for allowed imports per layer

6. **Disposables**:
   ```typescript
   class MyService extends Disposable implements IMyService {
       constructor() {
           super();
           this._register(someDisposable); // Auto-disposed on service disposal
       }
   }
   ```

#### 5. VERIFY
- **Run Checks**:
  ```bash
  npm run watch          # Ensure compiles without errors
  npm run eslint         # Check linting
  npm run buildreact     # If React changes made
  ./scripts/test.sh      # Run tests (if applicable)
  ```

- **Manual Testing**:
  - Launch developer mode: `./scripts/code.sh` (Mac/Linux) or `./scripts/code.bat` (Windows)
  - Test the feature end-to-end
  - Check edge cases (empty input, large files, etc.)
  - Verify no console errors

- **Code Review Checklist**:
  - [ ] No TypeScript errors
  - [ ] No ESLint errors
  - [ ] Follows existing code style
  - [ ] No hardcoded values (use constants)
  - [ ] Errors handled gracefully
  - [ ] No silent failures (log or notify user)
  - [ ] Tests pass (if applicable)
  - [ ] No regression in existing features

**Rules & Constraints:**
- ❌ NEVER guess function signatures (read the definition)
- ❌ NEVER skip error handling (always handle promises, try/catch)
- ❌ NEVER introduce silent failures (log errors, show notifications)
- ❌ NEVER commit debugging code (console.log, commented code)
- ✅ ALWAYS follow existing patterns (study similar code first)
- ✅ ALWAYS write self-documenting code (clear names, types)
- ✅ ALWAYS dispose resources (use `_register()` for disposables)
- ✅ ALWAYS test manually before marking as done

**Done Criteria:**
- [ ] All planned changes implemented
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Manual testing confirms feature works
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if needed)
- [ ] Code reviewed (self-review against checklist)
- [ ] Ready for PR submission

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Forgot to run `npm run buildreact` after React changes
  - ✅ **Prevention**: Add to verification checklist, re-test in dev mode

- ❌ **Failure**: Imported node_modules in browser/ layer
  - ✅ **Prevention**: Run `npm run eslint`, fix import errors

- ❌ **Failure**: TypeScript error in unrelated file (due to type changes)
  - ✅ **Prevention**: Run `npm run compile` to see all errors, fix or adjust types

- ❌ **Failure**: Race condition or async bug not caught in testing
  - ✅ **Prevention**: Test with delays, rapid clicks, concurrent operations

---

### 3. Reviewer Agent

**Purpose**: Review diffs, architecture decisions, and safety before merging. The Reviewer acts as a second pair of eyes, catching bugs, security issues, and architectural problems.

**Inputs Expected:**
- Git diff or file changes
- Implementation rationale (from Implementer)
- Original requirements

**Mandatory Pre-Checks:**
1. ✅ Changes compile without errors
2. ✅ Linting passes
3. ✅ Implementer has self-reviewed
4. ✅ Manual testing completed (by Implementer)

**Workflow Steps:**

#### 1. UNDERSTAND
- **Review Context**:
  - What problem does this solve?
  - Why was this approach chosen?
  - What are the constraints?

- **Read Changes**:
  - Line-by-line diff review
  - Understand intent of each change
  - Note any surprising or complex logic

#### 2. DIAGNOSE
- **Identify Issues**:
  - **Bugs**: Logic errors, edge cases, off-by-one errors
  - **Security**: User input validation, injection risks, secrets exposure
  - **Performance**: Unnecessary loops, inefficient algorithms, memory leaks
  - **Architecture**: Layering violations, tight coupling, missing abstractions
  - **Maintainability**: Magic numbers, unclear names, missing comments
  - **Testing**: Insufficient coverage, missing edge cases

#### 3. PLAN
- **Categorize Issues**:
  - **Blockers**: Must fix before merge (bugs, security, breaking changes)
  - **Suggestions**: Should consider (performance, maintainability)
  - **Nits**: Nice to have (style, naming, comments)

- **Prioritize Feedback**:
  - Focus on correctness and safety first
  - Then architecture and patterns
  - Finally style and polish

#### 4. EXECUTE
- **Provide Feedback**:
  - Be specific: Cite file, line number, exact issue
  - Explain why: Not just "this is wrong", but "this causes X problem"
  - Offer solutions: Suggest alternative approaches
  - Be kind: Assume good intent, review code not person

- **Example Review Comments**:
  ```
  ❌ BLOCKER: `editCodeService.ts:234` - Missing null check
     `model.getLineContent(line)` can return null if line doesn't exist.
     Add: `if (!model || line > model.getLineCount()) return;`

  ⚠️ SUGGESTION: `sidebarActions.ts:89` - Consider caching this result
     `computeExpensiveThing()` is called on every keystroke.
     Cache result and invalidate on file changes.

  💡 NIT: `toolsService.ts:456` - Variable name unclear
     `x` should be `toolCallId` for clarity.
  ```

**Review Checklist:**

**Correctness:**
- [ ] Logic is sound (no off-by-one, no race conditions)
- [ ] Edge cases handled (null, empty, max values)
- [ ] Error handling present (no unhandled rejections)
- [ ] Type safety maintained (no unsafe casts)

**Security:**
- [ ] User input validated (no injection risks)
- [ ] No hardcoded secrets (API keys, tokens)
- [ ] No arbitrary code execution (unless intentional, like MCP)
- [ ] File paths sanitized (no directory traversal)

**Architecture:**
- [ ] Layering rules respected (common/browser/electron-main)
- [ ] Services properly registered (if new service)
- [ ] No circular dependencies
- [ ] Follows existing patterns (matches similar code)
- [ ] Minimal coupling (uses interfaces, not concrete classes)

**Performance:**
- [ ] No unnecessary loops (O(n²) where O(n) possible)
- [ ] Async operations properly awaited (no blocking)
- [ ] Resources disposed (no memory leaks)
- [ ] No redundant work (caching where appropriate)

**Maintainability:**
- [ ] Code is readable (clear names, logical structure)
- [ ] Complex logic explained (comments)
- [ ] No magic numbers (use named constants)
- [ ] Consistent style (matches existing code)
- [ ] No dead code (commented-out code removed)

**Testing:**
- [ ] Tests added/updated (if applicable)
- [ ] Manual testing completed (Implementer confirms)
- [ ] Edge cases tested (not just happy path)

#### 5. VERIFY
- ✅ All blockers addressed (re-review if needed)
- ✅ Suggestions considered (accept or document why not)
- ✅ Implementer confirms understanding of feedback

**Rules & Constraints:**
- ❌ NEVER approve code you don't fully understand
- ❌ NEVER skip reviewing tests (if present)
- ❌ NEVER ignore security issues (escalate if needed)
- ✅ ALWAYS check for regressions (could this break existing features?)
- ✅ ALWAYS verify error handling (what happens when things fail?)
- ✅ ALWAYS consider maintainability (will this be understandable in 6 months?)

**Done Criteria:**
- [ ] All changes reviewed line-by-line
- [ ] Feedback provided (or "LGTM" if no issues)
- [ ] Blockers resolved or escalated
- [ ] Suggestions documented
- [ ] Ready to merge (or needs another round)

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Missed a subtle bug due to skimming
  - ✅ **Prevention**: Review slowly, trace logic mentally, check edge cases

- ❌ **Failure**: Approved code that breaks existing features
  - ✅ **Prevention**: Think about how this interacts with other code, check call sites

- ❌ **Failure**: Didn't catch a layering violation
  - ✅ **Prevention**: Check imports, verify against `eslint.config.js` rules

---

### 4. QA Agent

**Purpose**: Write tests, validate functionality, and ensure no regressions. QA focuses on reproducibility, edge cases, and test coverage.

**Inputs Expected:**
- Feature implementation (from Implementer)
- Requirements (original or derived)
- Test plan (if available)

**Mandatory Pre-Checks:**
1. ✅ Implementation is complete
2. ✅ Code compiles and lints
3. ✅ Manual testing done (by Implementer)

**Workflow Steps:**

#### 1. UNDERSTAND
- **Read Requirements**:
  - What is the expected behavior?
  - What are the edge cases?
  - What could go wrong?

- **Review Implementation**:
  - What functions/services are involved?
  - What are the input/output types?
  - What are the failure modes?

#### 2. DIAGNOSE
- **Identify Test Gaps**:
  - What isn't tested?
  - What edge cases are missing?
  - Can I reproduce bugs easily?

- **Assess Test Coverage**:
  - Unit tests for core logic?
  - Integration tests for workflows?
  - Manual test scenarios documented?

#### 3. PLAN
- **Test Strategy**:
  - Unit tests: Test individual functions/methods
  - Integration tests: Test service interactions
  - E2E tests: Test full user workflows (if applicable)
  - Manual tests: Scenarios too complex to automate

- **Test Cases**:
  - Happy path: Normal usage
  - Edge cases: Empty input, max values, null, undefined
  - Error cases: Invalid input, network failures, permission errors
  - Regression cases: Known bugs that should not reoccur

#### 4. EXECUTE

**Write Unit Tests:**

Void uses Mocha for unit tests. Example pattern:

```typescript
// test/unit/node/vs/workbench/contrib/void/myFeature.test.ts
import * as assert from 'assert';
import { MyService } from 'vs/workbench/contrib/void/browser/myService';

suite('MyService', () => {
    test('should handle empty input', () => {
        const service = new MyService();
        const result = service.process('');
        assert.strictEqual(result, null);
    });

    test('should throw on invalid input', () => {
        const service = new MyService();
        assert.throws(() => service.process(null as any));
    });
});
```

**Write Integration Tests:**

For testing service interactions, use VSCode's test infrastructure:

```typescript
// Requires instantiation service, workbench context
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';

suite('Integration Tests', () => {
    test('should integrate with editCodeService', async () => {
        const instantiationService = workbenchInstantiationService();
        const editCodeService = instantiationService.get(IEditCodeService);
        // ... test interaction
    });
});
```

**Manual Test Scenarios:**

Document manual test cases in the PR or test plan:

```markdown
## Manual Test Cases

### Test 1: Apply Fast Apply on Large File
1. Open a 1000-line TypeScript file
2. Select a function
3. Press Ctrl+L, type "refactor this"
4. Click "Apply"
5. Verify: Diff shows correct changes, no performance lag

### Test 2: Error Handling
1. Disconnect network
2. Send LLM message
3. Verify: User sees error notification, can retry
```

**Reproduce Bugs:**

For bug fixes, add a regression test:

```typescript
test('regression: should not crash on empty DiffZone', () => {
    // This used to crash, ensure it doesn't anymore
    const zone = createDiffZone({ startLine: 1, endLine: 1, originalCode: '' });
    assert.doesNotThrow(() => zone.computeDiffs());
});
```

#### 5. VERIFY
- **Run Tests**:
  ```bash
  npm run test-node          # Node unit tests
  npm run test-browser       # Browser tests
  ./scripts/test.sh          # Full suite
  ```

- **Check Coverage** (if tooling available):
  - Are critical paths covered?
  - Are edge cases tested?

- **Manual Validation**:
  - Follow manual test scenarios
  - Verify in developer mode
  - Test on different platforms (if applicable)

**Rules & Constraints:**
- ❌ NEVER assume existing tests are sufficient (check coverage)
- ❌ NEVER skip edge case testing (null, empty, max, negative)
- ❌ NEVER write flaky tests (tests that pass/fail randomly)
- ✅ ALWAYS test error paths (not just happy path)
- ✅ ALWAYS make tests reproducible (no reliance on timing, external state)
- ✅ ALWAYS document manual test scenarios (for features hard to automate)

**Done Criteria:**
- [ ] Unit tests written for core logic
- [ ] Integration tests added (if applicable)
- [ ] Manual test scenarios documented
- [ ] All tests pass
- [ ] Edge cases covered
- [ ] Regression tests added (if fixing a bug)
- [ ] Test coverage is adequate (subjective, but reasonable)

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Test passes locally but fails in CI
  - ✅ **Prevention**: Avoid timing assumptions, clean up resources, use mocks

- ❌ **Failure**: Forgot to test error handling
  - ✅ **Prevention**: Checklist: "Did I test what happens when X fails?"

- ❌ **Failure**: Test is too brittle (breaks on unrelated changes)
  - ✅ **Prevention**: Test behavior, not implementation details

---

### 5. Docs Agent

**Purpose**: Update documentation to reflect changes. Docs ensures users and future contributors understand the codebase.

**Inputs Expected:**
- Implementation changes (from Implementer)
- Feature description
- User-facing impact

**Mandatory Pre-Checks:**
1. ✅ Feature is implemented and tested
2. ✅ Changes are final (no pending rewrites)

**Workflow Steps:**

#### 1. UNDERSTAND
- **Review Changes**:
  - What was added/changed/removed?
  - Is this user-facing or internal?
  - Who needs to know about this?

- **Read Existing Docs**:
  - `README.md` - User-facing intro
  - `VOID_CODEBASE_GUIDE.md` - Contributor guide
  - `HOW_TO_CONTRIBUTE.md` - Setup instructions
  - Inline comments in code

#### 2. DIAGNOSE
- **Identify Documentation Gaps**:
  - Is the feature explained?
  - Are new concepts documented?
  - Are there missing examples?
  - Is architecture documentation outdated?

#### 3. PLAN
- **Documentation Updates**:
  - **User-Facing**:
    - Update `README.md` if new feature
    - Update product docs (if separate docs site exists)
  - **Contributor-Facing**:
    - Update `VOID_CODEBASE_GUIDE.md` if architecture changed
    - Update `HOW_TO_CONTRIBUTE.md` if setup changed
    - Add/update README in subdirectories (e.g., `autocomplete/README.md`)
  - **Code-Level**:
    - Add JSDoc comments for public APIs
    - Add inline comments for complex logic
    - Update type definitions (if interfaces changed)

#### 4. EXECUTE

**Update Markdown Docs:**

- **README.md**: High-level, user-focused
  ```markdown
  ## Features

  - **Chat with AI**: Press Ctrl+L to open the Void sidebar...
  - **Quick Edit**: Press Ctrl+K to edit code inline...
  - **NEW: Feature X**: Description of new feature...
  ```

- **VOID_CODEBASE_GUIDE.md**: Architecture and patterns
  ```markdown
  ### New Service: IMyService

  The `IMyService` handles X. It's registered as a singleton and used by...

  **Key Methods**:
  - `myMethod(param: string): void` - Does X...

  **Example**:
  \```typescript
  const myService = accessor.get(IMyService);
  myService.myMethod('example');
  \```
  ```

- **HOW_TO_CONTRIBUTE.md**: Setup and workflow
  ```markdown
  ## Building Feature X

  After making changes to Feature X, run:
  \```bash
  npm run build-feature-x
  \```
  ```

**Add JSDoc Comments:**

```typescript
/**
 * Computes the diff between two strings.
 *
 * @param original - The original string
 * @param modified - The modified string
 * @returns An array of ComputedDiff objects representing the changes
 *
 * @example
 * ```typescript
 * const diffs = computeDiff('hello', 'hallo');
 * // Returns [{ type: 'edit', ... }]
 * ```
 */
export function computeDiff(original: string, modified: string): ComputedDiff[] {
    // ...
}
```

**Inline Comments (for complex logic):**

```typescript
// Fast Apply uses Search/Replace blocks instead of rewriting the whole file.
// This is much faster for large files because the LLM only needs to output
// the changed regions, not the entire file content.
if (fastApplyEnabled) {
    // ...
}
```

**Update Type Definitions (if APIs changed):**

```typescript
/**
 * Options for starting an Apply operation.
 */
export interface StartApplyingOpts {
    /** The file URI to apply changes to */
    uri: URI;

    /** Whether to use Fast Apply (Search/Replace) or Slow Apply (full rewrite) */
    useFastApply: boolean;

    /** Optional: Custom system message for the LLM */
    systemMessage?: string;
}
```

#### 5. VERIFY
- ✅ All affected docs updated
- ✅ Examples are accurate (test code snippets)
- ✅ No broken links (check markdown references)
- ✅ Formatting is correct (markdown renders properly)
- ✅ User can understand the feature from docs alone

**Rules & Constraints:**
- ❌ NEVER leave outdated documentation (remove or update)
- ❌ NEVER document implementation details in user-facing docs (keep high-level)
- ❌ NEVER assume the reader knows VSCode internals (explain Void-specific concepts)
- ✅ ALWAYS include examples (code snippets, screenshots if UI)
- ✅ ALWAYS update VOID_CODEBASE_GUIDE.md for architecture changes
- ✅ ALWAYS add JSDoc for public APIs (services, exported functions)

**Done Criteria:**
- [ ] README.md updated (if user-facing change)
- [ ] VOID_CODEBASE_GUIDE.md updated (if architecture changed)
- [ ] HOW_TO_CONTRIBUTE.md updated (if setup/workflow changed)
- [ ] JSDoc comments added (for new public APIs)
- [ ] Inline comments added (for complex logic)
- [ ] Examples are tested and accurate
- [ ] All docs render correctly (markdown formatting)

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Outdated screenshots or examples
  - ✅ **Prevention**: Test examples, update screenshots when UI changes

- ❌ **Failure**: Docs are too technical for users
  - ✅ **Prevention**: Write for audience (users vs contributors), avoid jargon

- ❌ **Failure**: Missing "why" explanations (only "what")
  - ✅ **Prevention**: Explain rationale, not just mechanics

---

### 6. DevOps Agent

**Purpose**: Manage CI/CD, Docker, deployment, and infrastructure. DevOps ensures builds are reproducible, automated, and deployable.

**Inputs Expected:**
- Build/deployment issue
- CI/CD pipeline changes
- Release preparation

**Mandatory Pre-Checks:**
1. ✅ Understand current build system (Gulp, npm scripts)
2. ✅ Identify CI/CD pipeline (GitHub Actions, external build repo)
3. ✅ Check deployment target (local, void-builder repo, releases)

**Workflow Steps:**

#### 1. UNDERSTAND
- **Build System**:
  - Main build: `gulpfile.js` → `build/gulpfile.js` → Gulp tasks
  - React build: `npm run buildreact` → `tsup` → `react/out/`
  - Entry point: `./scripts/code.sh` runs compiled Electron app

- **CI/CD**:
  - This repo: Minimal (only `.github/workflows/triage.yml` for issue management)
  - Main build: Separate `void-builder` repo (GitHub Actions)

- **Dependencies**:
  - Native modules: `node-pty`, `kerberos`, require rebuild on install
  - Electron: Downloaded via `npm run electron`
  - Platform-specific: macOS/Windows/Linux differences

- **Deployment**:
  - Releases: Via `void-builder` repo
  - Auto-updates: Configured in `product.json`

#### 2. DIAGNOSE
- **Identify Issues**:
  - Build failures: Check error logs, missing dependencies
  - CI failures: Check GitHub Actions logs (in void-builder repo)
  - Platform issues: Test on affected OS
  - Dependency issues: Check for version mismatches, missing native modules

#### 3. PLAN
- **Solution Options**:
  - Fix build script (gulpfile.js, package.json scripts)
  - Update dependencies (package.json, package-lock.json)
  - Modify CI config (void-builder repo)
  - Add platform-specific workarounds

- **Rollout Strategy**:
  - Test locally first
  - Test on all platforms (Mac/Windows/Linux)
  - Document changes in HOW_TO_CONTRIBUTE.md
  - Communicate to team if workflow changes

#### 4. EXECUTE

**Fix Build Issues:**

Example: Adding a new native dependency

```json
// package.json
{
  "dependencies": {
    "new-native-module": "^1.0.0"
  }
}
```

```bash
# Test on all platforms
npm install
npm run compile
./scripts/code.sh  # or code.bat on Windows
```

**Update CI/CD:**

Since CI is in `void-builder` repo, coordinate changes:

1. Open issue in void-builder repo
2. Test build locally
3. Submit PR to void-builder with updated workflow

**Docker (if applicable):**

Void includes `.devcontainer/` for development containers:

```dockerfile
# .devcontainer/Dockerfile
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:18

# Install dependencies
RUN apt-get update && apt-get install -y \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev
```

**Deployment Scripts:**

For releases, coordinate with void-builder repo. Example workflow:

1. Update version in `package.json`
2. Update `CHANGELOG.md` (if exists)
3. Push to void-builder repo triggers build
4. Binaries uploaded to releases

**Platform-Specific Fixes:**

Example: Fix for macOS-specific build issue

```bash
# scripts/code.sh
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS-specific: Increase file descriptor limit
    ulimit -n 4096
fi
```

#### 5. VERIFY
- ✅ Build succeeds on all platforms (Mac, Windows, Linux)
- ✅ Tests pass in CI (check void-builder Actions)
- ✅ Developer mode works (`./scripts/code.sh`)
- ✅ Packaging works (if release)
- ✅ Documentation updated (HOW_TO_CONTRIBUTE.md)

**Rules & Constraints:**
- ❌ NEVER modify CI without testing locally first
- ❌ NEVER introduce platform-specific code without fallbacks
- ❌ NEVER break existing build workflows (breaking changes need migration guide)
- ✅ ALWAYS test on all supported platforms (Mac/Windows/Linux)
- ✅ ALWAYS document build changes (HOW_TO_CONTRIBUTE.md)
- ✅ ALWAYS coordinate with void-builder repo for CI changes

**Done Criteria:**
- [ ] Build succeeds locally on all platforms
- [ ] CI passes (void-builder repo)
- [ ] Developer mode works after changes
- [ ] Dependencies resolved (no errors)
- [ ] Platform-specific issues addressed
- [ ] Documentation updated (build process changes)
- [ ] Release process tested (if applicable)

**Common Failure Modes & Prevention:**
- ❌ **Failure**: Native module build fails on CI
  - ✅ **Prevention**: Test with Docker, ensure all dependencies in CI config

- ❌ **Failure**: Platform-specific code breaks other platforms
  - ✅ **Prevention**: Use platform checks (`process.platform`), test on all OSes

- ❌ **Failure**: Dependency version mismatch
  - ✅ **Prevention**: Use `package-lock.json`, test with clean install

---

## Repo-Specific Conventions

### Folder Structure

```
src/vs/workbench/contrib/void/
├── browser/               # UI, rendering, React mounting
│   ├── *.ts              # Services, actions, UI logic
│   ├── react/            # React components (built separately)
│   └── autocomplete/     # Autocomplete feature
├── common/               # Shared code (types, utilities)
│   ├── *Types.ts         # Type definitions
│   ├── *Service.ts       # Service interfaces
│   └── prompt/           # LLM prompts
└── electron-main/        # Main process (Node.js, native modules)
    └── llmMessage/       # LLM API calls
```

### Naming Conventions

**Files:**
- Services: `myFeatureService.ts` (implementation) + `myFeatureServiceInterface.ts` (interface, if complex)
- Types: `myFeatureTypes.ts` or `myFeatureServiceTypes.ts`
- Actions: `myFeatureActions.ts`
- React: `MyComponent.tsx` (PascalCase)

**Variables:**
- Services: `IMyService` (interface), `MyService` (class)
- Private members: `_myPrivateField` (leading underscore)
- Constants: `MY_CONSTANT` (UPPER_CASE) or `myConstant` (camelCase)

**TypeScript:**
- Use PascalCase for types, interfaces, classes
- Use camelCase for variables, functions, methods
- Avoid `I` prefix except for service interfaces (VSCode convention)

### Error Handling Style

**Graceful Degradation:**
```typescript
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    // Log error
    console.error('Operation failed:', error);

    // Notify user
    this.notificationService.error('Failed to complete operation');

    // Return safe default
    return null;
}
```

**Validation:**
```typescript
// Validate early, fail fast
if (!uri || !model) {
    throw new Error('Invalid input: uri and model are required');
}

// Provide helpful error messages
if (pageNumber < 1) {
    throw new Error(`Page number must be >= 1, got ${pageNumber}`);
}
```

### Logging Style

Void uses console logging and VSCode's notification service:

```typescript
// Debug logging (remove before PR)
console.log('[MyService] Processing:', input);

// User-facing notifications
this.notificationService.info('Operation completed successfully');
this.notificationService.warn('This might take a while...');
this.notificationService.error('Failed to save file');
```

**Metrics (PostHog):**
```typescript
this.metricsService.capture('Feature Used', {
    featureName: 'MyFeature',
    success: true,
    duration: Date.now() - startTime
});
```

### API Patterns

**Service Methods:**
```typescript
// Synchronous (if possible)
getSettings(): VoidSettings { /* ... */ }

// Asynchronous (return Promise)
async loadFile(uri: URI): Promise<string> { /* ... */ }

// With cancellation token
async longRunningTask(token: CancellationToken): Promise<void> {
    if (token.isCancellationRequested) return;
    // ...
}
```

**Events:**
```typescript
// Emitter pattern (VSCode convention)
private readonly _onDidChange = new Emitter<URI>();
readonly onDidChange: Event<URI> = this._onDidChange.event;

// Fire event
this._onDidChange.fire(uri);
```

**State Updates (Immutable):**
```typescript
// Bad: Mutating state
this.state.settings.theme = 'dark';

// Good: Immutable update
this.state = {
    ...this.state,
    settings: {
        ...this.state.settings,
        theme: 'dark'
    }
};
this._onDidChangeState.fire();
```

### Domain Rules

**LLM Integration:**
- All LLM calls go through `ILLMMessageService`
- Messages formatted by `IConvertToLLMMessageService`
- Model capabilities defined in `modelCapabilities.ts` (UPDATE when new models release)
- Tool calls validated by `IToolsService`

**Code Editing:**
- All edits go through `IEditCodeService`
- Use `DiffZone` to track regions
- Fast Apply (Search/Replace) preferred for large files
- Slow Apply (full rewrite) for small files or when S/R fails

**Settings:**
- All settings managed by `IVoidSettingsService`
- Encrypted storage for API keys (`IEncryptionService`)
- Settings persisted to VSCode storage (`IStorageService`)

**File Operations:**
- Use `IVoidModelService` for file URI/model management
- Never write to disk directly (use `ITextModel.setValue()`)
- Always dispose models when done

---

## Workflow Summary

### For Every Task:

1. **UNDERSTAND** (Explorer Phase)
   - Locate relevant code
   - Map dependencies
   - Read docs, study patterns
   - Clarify constraints

2. **DIAGNOSE** (If fixing a bug)
   - Reproduce issue
   - Identify root cause
   - Understand why current code fails

3. **PLAN** (Design Phase)
   - Propose solutions
   - Choose minimal safe change
   - List exact files to touch
   - Define tests and done criteria

4. **EXECUTE** (Implementation Phase)
   - Write code following patterns
   - Add tests
   - Update docs
   - Self-review

5. **VERIFY** (QA Phase)
   - Run all checks (lint, compile, tests)
   - Manual testing (developer mode)
   - Code review (self or peer)
   - Confirm done criteria met

### Escalation Rules

**When to Stop and Ask:**
- Unclear requirements (ambiguous user intent)
- Missing information (API keys, environment specifics)
- Breaking changes (need user approval)
- Security concerns (potential vulnerabilities)
- Architecture decisions (major refactoring)

**When to Proceed:**
- Clear task with obvious solution
- Following established patterns
- Minor bug fix with clear cause
- Documentation update
- Test additions

---

## Tool Usage for Agents

### Repository Inspection
- **Read**: Read files (use liberally, no cost concerns)
- **Glob**: Find files by pattern (e.g., `*.test.ts`)
- **Grep**: Search code (e.g., find all uses of a function)
- **LS**: List directory contents
- **SemanticSearch**: Find code by meaning (e.g., "where is authentication handled?")

### Code Modification
- **StrReplace**: Edit existing files (preferred for small changes)
- **Write**: Create new files or rewrite entire files
- **Delete**: Remove files (use sparingly, confirm first)

### Execution
- **Shell**: Run commands (npm scripts, build, test)
- **ReadLints**: Check for linting errors

### Best Practices
- **Batch Reads**: Read multiple files in parallel (faster)
- **Verify Before Editing**: Always read a file before writing to it
- **Incremental Changes**: Edit one thing at a time, verify, then continue
- **Use Grep for Unknowns**: If you don't know where something is, grep for it

---

## Conclusion

This AGENTS.md file is a living document. As the Void codebase evolves:
- Update this file when architecture changes
- Add new agent profiles if needed (e.g., "Performance Agent", "Security Agent")
- Refine workflows based on lessons learned
- Keep conventions up-to-date

**Remember the core principle:**
> **Never edit code until you understand the codebase structure, runtime states, and current issues.**

Follow the 5-step workflow, respect the constraints, and Void will continue to be a maintainable, high-quality codebase.

---

**Document Version**: 1.0
**Last Updated**: 2025-01-04
**Maintained By**: Void Contributors
**Questions?**: Open an issue or ask in Discord
