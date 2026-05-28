# Orbit Sub-Agent System

## Overview

Orbit's sub-agent system lets the main agent delegate bounded tasks to isolated child agents. Each sub-agent runs in its own conversation context, has a restricted tool policy, and returns a structured summary to the parent — keeping the main chat clean and focused.

The system is designed around three principles:
1. **Isolation** — sub-agents get only the context they need, not the full parent conversation.
2. **Safety** — tool permissions are enforced in code, not just in prompts. Read-only agents cannot edit files.
3. **Clarity** — the user sees what each agent is doing, how long it ran, and what it found.

---

## Architecture

### Key files

| File | Role |
|------|------|
| `common/subAgentTypes.ts` | All shared types: `SubAgentDefinition`, `SubAgentTaskRecord`, `SubAgentChildViewModel`, `SubAgentProgress`, lifecycle utilities |
| `common/subAgentHarness.ts` | Report parsing, activity summarization, policy helpers |
| `browser/subAgentOrchestratorService.ts` | Orchestrator: session management, LLM loop, tool execution, lifecycle state machine |
| `browser/subAgentTaskStoreService.ts` | Persistent task/session store with GC and eviction |
| `browser/convertToLLMMessageService.ts` | Message conversion with orphan tool message handling |
| `react/src/sidebar-tsx/components/chatComponents/SubAgentCard.tsx` | UI card: status, activity log, findings, error |
| `react/src/sidebar-tsx/components/chatComponents/SubAgentCardList.tsx` | Sorted list of sub-agent cards |
| `react/src/sidebar-tsx/constants/builtinToolNameToComponent.tsx` | Wires sub-agent tool results to UI cards |

### Data flow

```
Parent agent calls task() tool
  → SubAgentOrchestratorService.runTaskTool()
    → Resolves agent from registry
    → Creates/resumes SubAgentSession
    → Runs LLM loop (_runSession)
      → prepareLLMChatMessages (isolated context)
      → sendLLMMessage
      → executeTool (permission-checked)
      → repeat until no tool calls
    → Parses final report
    → Returns SubAgentTaskToolResult to parent
  → Parent receives structured summary text
  → UI shows SubAgentCard with status/findings
```

---

## How sub-agents are selected

The parent agent calls the `task` tool with:
- `subagent_type`: the agent name (e.g. `explore`, `reviewer`)
- `description`: short human-readable title shown in the UI
- `prompt`: the specific instructions for this invocation

The orchestrator resolves the agent by name from `NATIVE_SUBAGENTS`. If the name is unknown, the call fails with a clear error.

The parent agent decides when to delegate based on the agent descriptions in the system prompt. The orchestrator enforces concurrency limits (`subAgentMaxParallel`, default 3).

---

## Built-in agents

### Primary agents (internal, not user-spawnable)

| Name | Purpose |
|------|---------|
| `build` | Default primary coding agent |
| `plan` | Read-only planning agent |
| `compaction` | Context compaction (hidden) |
| `title` | Session title generation (hidden) |
| `summary` | Session summary generation (hidden) |

### Sub-agents (user-spawnable via `task` tool)

| Name | Color | Purpose | Tools |
|------|-------|---------|-------|
| `explore` | Blue | Fast read-only codebase exploration, architecture discovery, file search | Read-only |
| `general` | Green | Bounded synthesis, narrow investigation, targeted analysis | Read-only |
| `reviewer` | Amber | Code review: correctness, regressions, security, maintainability | Read-only |
| `security` | Red | Security review: vulnerabilities, unsafe patterns, permission gaps | Read-only |

All sub-agents use `READ_ONLY_SUBAGENT_POLICY`:
- `allowedBuiltinTools`: `read_file`, `ls_dir`, `get_dir_tree`, `search_pathnames_only`, `search_for_files`, `search_in_file`, `read_lint_errors`
- `allowReadOnlyMcpOnly: true`
- `denyDelegation: true` (sub-agents cannot spawn further sub-agents)

---

## Permission model

Tool permissions are enforced in `_executeTool` before any tool call executes:

```ts
// Builtin tool check
if (resolvedBuiltin && this._isBuiltinToolAllowed(resolvedBuiltin, session.agent.permission)) {
    // execute
} else {
    // return tool_error: "Tool X is not allowed for sub-agents"
}

// MCP tool check
if (session.agent.permission.allowReadOnlyMcpOnly && !isMCPToolReadOnly(mcpTool)) {
    // return tool_error: "MCP tool X is not read-only and is denied"
}
```

The permission check happens in code — the LLM cannot bypass it by rephrasing the tool call.

---

## Run lifecycle

Each sub-agent run goes through these states:

```
queued → running_llm → running_tool → running_llm → ... → summarizing → completed
                                                                       → failed
                                                                       → timed_out
                                                                       → canceled
                                                                       → killed
```

State transitions are tracked in `SubAgentChildViewModel.state` and persisted via `SubAgentTaskStoreService`.

Timeouts:
- `subAgentPerChildTimeoutMs` (default 90s): per-child LLM+tool loop timeout
- `subAgentStageTimeoutMs` (default 120s): total stage timeout

Cancellation:
- `cancelStage()`: cancels all running sessions for a thread
- `killTask(taskId)`: force-kills a specific task by ID (user-initiated via stop button)

---

## Context isolation

Sub-agents do not receive the parent's full conversation. They receive:
1. Their agent system prompt (from `_childSystemContract`)
2. The task prompt built from `description` + `prompt` fields
3. Their own isolated history (max 48 messages, trimmed from the front)

After trimming, the history always starts from the first `user` message to prevent orphan `tool` messages that would cause provider errors (e.g. DeepSeek 400: "Messages with role 'tool' must be a response to a preceding message with 'tool_calls'").

---

## Output contract

Every sub-agent returns a `SubAgentChildReport`:

```ts
type SubAgentChildReport = {
    childId: string;
    taskTemplate: string;
    title: string;
    status: 'completed' | 'failed' | 'timed_out' | 'canceled' | 'killed';
    rawResponse: string;
    summaryBullets: string[];    // shown in UI
    evidence: SubAgentEvidence[]; // kept in report, not shown in UI
    openQuestions: string[];      // kept in report, not shown in UI
    confidence: number;           // kept in report, not shown in UI
    tokenUsageEstimate?: number;
    error?: string;
    durationMs: number;
}
```

The report is rendered as structured markdown and returned to the parent agent as the `task` tool result. The parent sees a clean summary, not raw logs.

---

## How to add a new sub-agent

1. Add an entry to `NATIVE_SUBAGENTS` in `subAgentOrchestratorService.ts`:

```ts
{
    name: 'my-agent',
    mode: 'subagent',
    description: 'One sentence describing when to use this agent.',
    prompt: 'You are a ... sub-agent.\n\nRole: ...\n\nRules:\n- ...',
    permission: READ_ONLY_SUBAGENT_POLICY, // or custom policy
    color: '#8b5cf6',
    steps: 10,
    native: true,
}
```

2. Add a system contract template in `_childSystemContract`:

```ts
if (session.agent.name === 'my-agent') {
    return [...sharedPrefix, '## Section', '...'].join('\n')
}
```

3. The agent is immediately available via the `task` tool with `subagent_type: "my-agent"`.

---

## How to debug sub-agent runs

**In the UI:**
- Expand a sub-agent card to see the activity log, findings, and error.
- The stop button (⏹) kills a running agent.
- Progress shows tool count, elapsed time, and token estimate.

**In code:**
- `SubAgentTaskStoreService.state` holds all task records and session snapshots.
- Each task has a `latestStage` with the full `SubAgentStageViewModel`.
- Metrics are captured via `IMetricsService` for each lifecycle event.

**Common issues:**
- `400 Error from provider (DeepSeek): Messages with role 'tool' must be a response to a preceding message with 'tool_calls'` — fixed by `_trimSessionHistory` stripping all leading non-user messages after slicing.
- Sub-agent returns empty report — check `rawResponse` in the task record; the agent may have hit the turn limit or timed out.
- Tool denied — the agent's `permission.allowedBuiltinTools` does not include the requested tool.

---

## Known limitations

1. **No write-capable sub-agents yet.** All current sub-agents are read-only. An `implementer` agent with controlled write access is a planned addition.
2. **No parallel read + write safety.** File-level locking for concurrent editing agents is not yet implemented.
3. **No project-level agent overrides.** `.orbit/agents/*.md` project-level agent definitions are not yet loaded.
4. **No test coverage.** Unit tests for routing, permission enforcement, and result merging are not yet written.
5. **Sub-agent descriptions are static.** The parent agent selects sub-agents based on the description in the system prompt; there is no dynamic routing logic.
