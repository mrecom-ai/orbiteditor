# 06 — Target Architecture

## Overview

```
                       ┌───────────────────────────┐
                       │  ParentLLM (chat agent)   │
                       └────────────┬──────────────┘
                                    │ task tool
                                    ▼
              ┌─────────────────────────────────────────┐
              │  toolsService.validateParams.task        │  ← M2 typed task model
              │   - subagent_type, description, prompt   │
              │   - objective, expectedOutput,           │
              │     acceptanceCriteria (new)             │
              └────────────────────┬────────────────────┘
                                    │
                                    ▼
              ┌─────────────────────────────────────────┐
              │  chatThreadService._runToolCall          │
              │  case 'task' → orchestrator.runTaskTool  │
              └────────────────────┬────────────────────┘
                                    │
                                    ▼
              ┌──────────────────────────────────────────────────┐
              │  SubAgentOrchestratorService                      │
              │  ┌──────────────────────────────────────────┐     │
              │  │  subAgentRegistry  (M1)                  │     │
              │  │   - explore, general, reviewer, security │     │
              │  │   - planner, implementer, test-verifier, │     │
              │  │     ux-polisher (new)                    │     │
              │  └──────────────────────────────────────────┘     │
              │  ┌──────────────────────────────────────────┐     │
              │  │  subAgentPolicy.guardCall (M3)           │     │
              │  │   permission tier + terminal/path safety │     │
              │  │   + tool budget                          │     │
              │  └──────────────────────────────────────────┘     │
              │  ┌──────────────────────────────────────────┐     │
              │  │  _runSession                              │     │
              │  │   - LLM ↔ tool loop                       │     │
              │  └──────────────────────────────────────────┘     │
              │  ┌──────────────────────────────────────────┐     │
              │  │  finalizer (M4)                           │     │
              │  │   parse → validate → optional repair      │     │
              │  └──────────────────────────────────────────┘     │
              └────────────────────┬─────────────────────────────┘
                                    │ structured SubAgentResult
                                    ▼
              ┌──────────────────────────────────────────┐
              │  toolsService.stringOfResult.task         │
              │  renderTaskHandoffForParent (M5)          │
              │   - <task_result> envelope                │
              │   - one-line summary, findings, files,    │
              │     risks, recommendations                │
              └────────────────────┬─────────────────────┘
                                    │
                                    ▼
                            Parent LLM resumes
```

## Components

### 1. Agent registry — `common/subAgentRegistry.ts` (new)

Pure module exporting `BUILTIN_SUBAGENTS: SubAgentDefinition[]`, `getAgent(name)`, `listAgents()`. Replaces the private `NATIVE_SUBAGENTS` constant.

### 2. Definition shape — `common/subAgentTypes.ts` (extended)

```ts
type AgentPermissionMode = 'read_only' | 'safe_write' | 'terminal_safe' | 'full_with_approval'

type AgentContextPolicy = 'minimal' | 'research' | 'implementation' | 'review' | 'verification'

type AgentOutputContract = {
  requireFindings: boolean;
  requireEvidence: boolean;     // path-shaped lines
  requireFilesInspected: boolean;
  forbidFilesChanged: boolean;
  requireOneLineSummary: boolean;
  requireConfidence: boolean;
}

type SubAgentDefinition = {
  // existing
  name: string;
  mode: 'subagent' | 'primary' | 'all';
  description: string;
  prompt: string;
  permission: ToolPolicy;          // kept for back-compat
  model?: { providerID: string; modelID: string };
  hidden?: boolean;
  color?: string;
  native?: boolean;
  steps?: number;

  // new
  whenToUse?: string;
  permissionMode: AgentPermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  contextPolicy?: AgentContextPolicy;
  outputContract?: AgentOutputContract;
  canRunInParallel?: boolean;
  maxRuntimeMs?: number;
  maxToolCalls?: number;
  maxContextTokens?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  enabled?: boolean;
}
```

### 3. Built-in agents (final list)

| Name | Visible | Tier | Output contract |
|---|---|---|---|
| explore | ✅ | read_only | findings + evidence + filesInspected required |
| general | ✅ | read_only | findings + evidence required |
| reviewer | ✅ | read_only | findings + evidence + risks required |
| security | ✅ | read_only | findings + evidence + risks required |
| planner | ✅ NEW | read_only | findings + recommendations + nextActions required |
| test-verifier | ✅ NEW | read_only* | commandsRun + status required (*read-only initially: surfaces test commands as bullets, does not yet execute terminal) |
| ux-polisher | ✅ NEW | read_only | findings + recommendations required |
| implementer | ❌ NEW (hidden until M-future) | safe_write | filesChanged + summary required |
| build, plan, compaction, title, summary | hidden primary helpers | n/a | unchanged |

Note on test-verifier: Initial cut keeps test-verifier read-only (it suggests commands and reads lint output via `read_lint_errors`). A later milestone can promote it to `terminal_safe` to actually run `npm run test`.

Note on implementer: Definition shipped but kept disabled by default behind an `enableSafeWriteSubAgents` setting; not registered in the visible list until follow-up. It exists so external callers can already see the planned tier.

### 4. Sub-agent task model — extended `SubAgentTaskToolParams`

```ts
type SubAgentTaskToolParams = {
  subagent_type: string;
  description: string;
  prompt: string;
  objective?: string;          // new — required for visible agents
  expected_output?: string;    // new — required for visible agents
  acceptance_criteria?: string;// new — optional list joined with newline
  scope?: string;              // new — optional file/area scope
  task_id?: string | null;
  command?: string | null;
}
```

Validation:

- `description` required (already)
- `prompt` required (already)
- For visible agents (`mode === 'subagent'`): `objective` AND `expected_output` recommended; if missing, the validator falls back to a generated objective from the description, but emits a low-confidence note.
- A typed `SubAgentTask` view is built from these for downstream code.

### 5. Lifecycle states

Unchanged: `pending | running | completed | failed | timed_out | canceled | killed`. Internal child states: `queued | running_llm | running_tool | summarizing | completed | failed | timed_out | canceled | killed`. These already cover the spec's `queued → starting → running → waiting_for_tool → ...` mental model.

### 6. Context builder

For this iteration, every sub-agent receives:

- The composed `_toTaskPrompt` (description + command + structured task body when present)
- No parent chat history
- The agent's own system contract (with prompt-injection guardrail line)

Future milestone: `AgentContextPolicy` will allow injecting selected parent messages or previous sub-agent results.

### 7. Tool permission layer — `common/subAgentPolicy.ts` (new)

```ts
function resolveAgentPolicy(agent: SubAgentDefinition): ToolPolicy
function isToolAllowedForAgent(toolName: string, agent: SubAgentDefinition, mcpTools: InternalToolInfo[]): { allowed: boolean; reason?: string }
function checkTerminalCommandSafety(command: string): { ok: boolean; reason?: string }
function checkPathSafety(path: string, op: 'read' | 'write'): { ok: boolean; reason?: string }
function guardToolCall(opts: { agent, toolCall, mcpTools }): { ok: boolean; blocked?: BlockedToolCall }
```

The orchestrator's `_executeTool` calls `guardToolCall` before dispatch. The harness exposes `guardToolCall` for tests. `availableTools` in `prompts.ts` calls `resolveAgentPolicy`/`isToolAllowedForAgent` (refactor) so it never disagrees with runtime.

### 8. Finalizer + validator + repair — `common/subAgentValidator.ts` (new), `common/subAgentFinalizer.ts` (new)

```ts
function validateSubAgentReport(report, contract, ctx): ValidationResult
type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[]; severity: 'block' | 'soft' }

function finalizeSubAgentRun(opts): SubAgentResult  // pure: parse + validate + decide repair-or-partial

async function repairSubAgentReport(opts): SubAgentResult  // single retry with strict rewrite prompt
```

`finalizeSubAgentRun` runs in `_runSession` instead of the inline parse+chatty-check. If validation fails with `severity: 'block'` and a repair has not yet been attempted, we run `repairSubAgentReport`; otherwise we mark the result `partial` with `confidence: low` and return.

### 9. Result model — typed alongside existing report

We keep `SubAgentChildReport` for back-compat and add a richer view in `SubAgentResult`:

```ts
type SubAgentFinding = { description: string; evidencePath?: string; severity?: 'info' | 'warn' | 'block' }
type SubAgentResult = {
  taskId: string;
  runId: string;
  agentName: string;
  status: 'success' | 'partial' | 'failed';
  oneLineSummary: string;
  detailedSummary: string;
  findings: SubAgentFinding[];
  filesInspected: string[];
  filesChanged: string[];
  commandsRun: string[];
  risks: string[];
  blockers: string[];
  recommendations: string[];
  nextActions: string[];
  evidence: SubAgentEvidence[];
  confidence: 'low' | 'medium' | 'high';
  blockedActions: BlockedToolCall[];
  durationMs: number;
  completedAt: number;
}
```

`renderTaskHandoffForParent` is updated (M5) to consume `SubAgentResult` if present, otherwise fallback to the existing `report` shape.

### 10. Validator rules

Implemented by `validateSubAgentReport`:

| Rule | Severity | Applies to |
|---|---|---|
| `oneLineSummary` non-empty | block | all |
| no chatty phrase from blacklist | block | all |
| `findings` length ≥ 1 if `requireFindings` | block | per contract |
| `evidence` length ≥ 1 if `requireEvidence` | block | per contract |
| each evidence has path-shaped value (`/`, `\`, `.`, or known suffix) | block | per contract |
| `filesInspected` length ≥ 1 if `requireFilesInspected` | block | per contract |
| `filesChanged` length === 0 if `forbidFilesChanged` | block | read_only |
| `confidence` set if `requireConfidence` | soft | per contract |
| `findings` mention any keyword from objective | soft | all |

A `block` severity drives repair; a `soft` failure only lowers `confidence`.

### 11. Parent merge

`renderTaskHandoffForParent` becomes:

- Always emit the structured `<task_result>` envelope (as today).
- Append a compact structured body: one-line summary, findings list, files inspected, recommendations, risks, blockers, confidence note. Truncate to ≤ 6 KB.
- The raw `output` markdown is **not** appended verbatim; instead, only the structured fields are rendered. The model's full markdown still lives on `result.report.rawResponse` for debug/persistence but is not concatenated into parent context.

Critical: this changes parent context shape slightly. Tests cover the new shape. The `<instruction>` line that says "do not re-read" is preserved.

### 12. UI model

`SubAgentChildViewModel` adds:

- `oneLineSummary?: string`
- `filesInspected?: string[]`
- `risks?: string[]`
- `recommendations?: string[]`
- `confidence?: 'low' | 'medium' | 'high'`
- `wasRepaired?: boolean`
- `blockedActionsCount?: number`

`SubAgentCard` collapsed row (unchanged size + alignment):

- icon + title + subtitle (one-line summary when terminal, last activity while running) + tool count + duration + ⚠ partial badge + 🔒 blocked badge

Expanded body adds (in order):

- one-line summary (if present)
- findings list
- files inspected (chips, max 8)
- risks (alert list, max 4)
- recommendations (info list, max 4)
- error (if any)

`SubAgentCardList` unchanged.

## Backward compatibility

- Existing `SubAgentChildReport` is kept and remains the persisted shape; new fields are optional or derived.
- `task` tool params: new fields are all **optional**. Old callers (already-recorded chat threads) keep working.
- `SubAgentDefinition` keeps the existing `permission: ToolPolicy` field; new `permissionMode` is the source of truth at runtime, with `permission` as derived/legacy.
- React UI components: SubAgentCard/SubAgentCardList contracts widen but never narrow; old children render exactly as before.
