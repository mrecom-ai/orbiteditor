# 02 — Current Sub-Agent Architecture (as found)

> Source-grounded trace. Every claim cites a file and a function or line range.

## High-level flow

```
Parent LLM (chatThreadService._runChatAgent / _runToolCall)
   │
   │  emits a `task` tool call
   ▼
toolsService.validateParams.task                  (toolsService.ts:617)
   │
   ▼
chatThreadService._runToolCall   (case builtinToolName === 'task')   (chatThreadService.ts:1043+)
   │
   ▼
SubAgentOrchestratorService.runTaskTool           (subAgentOrchestratorService.ts:312+)
   │
   │  ─→ resolves agent in NATIVE_SUBAGENTS (private)            (162–261)
   │  ─→ creates / resumes SubAgentTaskRecord + SubAgentSession
   │  ─→ enforces parallel-run limit
   │  ─→ arms stage timeout
   ▼
_runSession                                       (subAgentOrchestratorService.ts:840+)
   │
   │  loop (per turn):
   │    1. prepareLLMChatMessages (own tool policy)
   │    2. sendLLMMessage with `_childSystemContract` ONLY
   │    3. tool calls? → _executeTool with permission check
   │    4. no tool calls → _isChattySummary → optional _repairChattySummary
   │    5. _parseChildSummary (markdown delimiters > JSON > bullets)
   │    6. _terminalChildReport
   │
   ▼
report (SubAgentChildReport)
   │
   ▼
runTaskTool returns SubAgentTaskToolResult { fullText, report, stage, metadata }
   │
   ▼
chatThreadService stores it; toolsService.stringOfResult.task wraps in
   <task_result> envelope + trust instruction + truncated body              (toolsService.ts:1685+)
```

## Trace 1 — Parent → sub-agent creation

| Step | Where | Notes |
|---|---|---|
| Parent decides to call sub-agent | `prompts.ts` task tool description (line 945) | The system prompt explains parallel execution, agent choices, and a **CRITICAL** trust block telling the parent not to re-investigate. |
| Tool params validated | `toolsService.ts:617` `task: (params) => ...` | Requires non-empty `subagent_type`, `description ≤ 120 chars`, non-empty `prompt`. **No requirement for `objective`, `expected_output`, or `acceptance_criteria`.** Description and prompt are free-text. |
| Dispatch | `chatThreadService.ts:1061` | `_runToolCall` calls `_subAgentOrchestratorService.runTaskTool({ threadId, turnSequence, task, modelSelection, modelSelectionOptions, onStageUpdate })`. |
| Agent lookup | `subAgentOrchestratorService.ts: _agentRegistry()` and `NATIVE_SUBAGENTS` (162–261) | The 'registry' is just a private `Map` over a constant array. No service-level registry, no extension point, no project-level config. |
| Settings gate | `runTaskTool` line 314: `if (!globalSettings.enableDynamicSubAgents) throw` | OFF by default. Behind a feature flag. |
| Parallel-run gate | `runTaskTool` lines ~390–400 | Throws if `runningSessions ≥ subAgentMaxParallel` (default 3). |

### Fields passed to the sub-agent

`SubAgentTaskToolParams` (`subAgentTypes.ts`):

```ts
{ subagent_type, description, prompt, task_id?, command? }
```

The orchestrator builds `_toTaskPrompt` (line ~1100):

```text
Task: <description>
Context: <command?>

Instructions:
<prompt>
```

The sub-agent never receives a structured task model — only this concatenated text. There is no objective / expected output / acceptance criteria / scope / files-allowed structure.

### Context isolation

`_childSystemContract` is the **only** system message (`subAgentOrchestratorService.ts:1170+`). The parent chat-assistant system prompt is intentionally excluded — confirmed in inline comments. The user-side history fed to the sub-agent is just the single `_toTaskPrompt` user message; parent chat history is **not** dumped. This is correct.

## Trace 2 — Sub-agent execution

| Step | Where | Notes |
|---|---|---|
| LLM invocation | `_sendChildMessage` line 1080+ | Uses `ILLMMessageService.sendLLMMessage` with `agentRole: 'subagent'` and the agent's `permission` (`ToolPolicy`). |
| Tool call streaming | onText handler in `_sendChildMessage` | Last streaming tool emitted to UI via `setChildState`. |
| Tool execution | `_executeTool` line 1280+ | Dispatches built-in or MCP tool; rejects with structured error if disallowed. **Permission check happens here AND in `prepareLLMChatMessages`/`availableTools` AND in the harness — three places.** |
| Progress | `_runSession` increments `progress.toolUseCount`, appends `recentActivities`, fires `setChildState`. |
| Cancellation | `cancelStage` and `killTask` set `session.canceled/killed` and call `_cancelSessionRuntime` to abort the LLM request and any tool interrupt. |
| Per-child timeout | `_resolveTimeoutMs(globalSettings.subAgentPerChildTimeoutMs, …)`; default 240 s. Timeout race in `_runSession`. |
| Stage timeout | Default 360 s. Re-armed on every `setChildStateWithTimeout` to give long active runs more time. |
| Max turns | `DEFAULT_MAX_TURNS_PER_TASK = 32` or `agent.steps × 4`. Exceeding returns `failed` with partial summary. |
| Parallel | `_runningSessionIdsByThread` set per thread; gate enforced in `runTaskTool`. |
| Spawning further sub-agents | `denyDelegation: true` on every `READ_ONLY_SUBAGENT_POLICY` blocks the `task` tool from being available to the child. |
| Loop limits | Yes (`maxTurnsForTask`). |
| Errors | `try/catch` surrounds the whole `_runSession`; failure path returns a failed `SubAgentChildReport` with `_buildPartialSummary`. |

## Trace 3 — Sub-agent final result

| Step | Where | Notes |
|---|---|---|
| Final-message detection | `_runSession` — no tool calls returned by LLM ⇒ treated as final. |
| Typed result model | `SubAgentChildReport` (`subAgentTypes.ts`): `summaryBullets`, `evidence`, `openQuestions`, `confidence`, `status`, `tokenUsageEstimate`, `error`, `durationMs`. |
| Validation | `_isChattySummary` checks a single substring blacklist: 14 phrases. **No structural validation** (e.g. "must include findings"; "must include evidence with paths"; "explorer must have files inspected"). |
| Repair | `_repairChattySummary` runs **once** with a strict rewrite prompt; reuses agent system contract. Only triggered when chatty phrases match. |
| Raw assistant text used directly? | Yes, when `directMarkdown` path matches: if the model emits `==FINAL REPORT== … ==END REPORT==`, the markdown body is used verbatim (`_renderReport` → `parsed.directMarkdown`). |
| Progress vs final mixing | Activity log/text and bullets are tracked separately on the view model — fine. The UI subtitle however shows last activity while running, then `bullets[0]` when completed (good). The expanded body shows only bullets + error (no files inspected, no confidence indicator beyond the dot icon). |
| Parent receives | `renderTaskHandoffForParent` (`toolsService.ts:194`): `<task_result>` envelope + trust instruction + up to 6 KB of `output` (the rendered markdown report). The full sub-agent transcript is never injected — only the final rendered report. |

## Trace 4 — Sub-agent → UI

| Step | Where | Notes |
|---|---|---|
| Stage update | `runTaskTool` calls `onStageUpdate` → `chatThreadService._setSubAgentStageForTool` → `_setStreamState` writes `subAgentStagesByToolId` for the active stream. |
| Progress display | `SubAgentCard.tsx` reads `child.progress.toolUseCount`, `child.activityLog`, `child.activityText`, `child.error`. |
| Collapsed card | Title + spinner/state icon + last-activity subtitle + tools count + duration. Good. |
| Expanded body | Bullets + error. **Does not** show files inspected, evidence list, recommendations, blockers, confidence number, or risks. |
| Files inspected/changed | **Not surfaced as a UI section.** Evidence paths exist on the report (`evidence[].path`) but are not exposed in the card UI; only embedded inside the bullets list when the model wrote them there. |
| Errors | `child.error` rendered in expanded body with an alert icon — yes. |
| Tool activity summary | `recentActivities` is tracked in `progress` but only the latest is shown via `child.activityText`. |

## Trace 5 — Sub-agent → parent merge

| Step | Where | Notes |
|---|---|---|
| Parent receives | `toolsService.stringOfResult.task` → `renderTaskHandoffForParent` → `<task_result>` envelope + truncated `output`. |
| Whole transcript? | No — only the rendered final report (≤ 6 KB) plus structured envelope. |
| Useful findings only? | Mostly — but if the model emits chatty markdown inside `==FINAL REPORT==` delimiters, `directMarkdown` lets it through and the parent sees it. |
| Evidence preserved? | Yes — extracted into `report.evidence` and into the rendered markdown (Evidence/Supporting Files section). |
| Parent can continue? | Yes — the trust instruction in the envelope is explicit; the parent system prompt also tells it not to re-investigate. |

## Component summary

| Concern | Implemented today | Quality |
|---|---|---|
| Persistent task store | ✅ `subAgentTaskStoreService` with GC, eviction, sanitisation | Solid |
| Lifecycle states | ✅ pending/running/completed/failed/timed_out/canceled/killed | Solid |
| Background fields | ✅ `isBackgrounded`, `pendingMessages`, `retained`, `evictAfter` | Over-built for current UI but harmless |
| Agent definition | ✅ `SubAgentDefinition` type | Good shape, but not centralised in a registry service |
| Native registry | ⚠️ Hard-coded `NATIVE_SUBAGENTS` constant inside orchestrator | Limits extensibility |
| Permission policy | ⚠️ Three enforcement points (`_executeTool`, `availableTools`, `subAgentHarness`) | Risk of drift |
| Terminal safety | ✅ unreachable for read-only because terminal tools aren't in `readOnlyToolNames` | Implicit, not documented |
| Validator | ⚠️ Only chatty-phrase substring check; no structural validator | Insufficient |
| Repair | ⚠️ Triggered only on chatty match; one-shot | Insufficient |
| Parent merge | ✅ Structured envelope + trust instruction + truncated body | Mostly good; raw markdown body still injected |
| UI progress vs final | ⚠️ Same `summaryBullets` array drives both subtitle and expanded body | Acceptable; lacks evidence/files/confidence in UI |
| Built-in agents | 4 visible (`explore`, `general`, `reviewer`, `security`) | Missing planner/implementer/test-verifier/ux-polisher |
| Tests | ❌ None | Largest gap |
| Project-level agents | ❌ Not supported | Future feature |
| Audit trail | ⚠️ Metrics events fired (`SubAgent Task Invoked`, completed/failed/etc.); no in-app audit log | Observable but not surfaced |

## Where the "weak generic summary" failure mode lives

1. The model may emit a `==FINAL REPORT==`/`==END REPORT==` block whose body is generic ("This file does X") with no evidence section. The directMarkdown path passes it straight through (`_extractMarkdownReport`).
2. The chatty-phrase blacklist misses outputs like "Here is what I found" or vague single-bullet summaries that don't include any file path.
3. There is no enforcement that read-only explorer reports include at least one evidence path or that the report answers the original objective.
4. The repair pass only triggers when chatty phrases match — a non-chatty but generic report skips repair.

These are the precise failure points the productionised system must close.
