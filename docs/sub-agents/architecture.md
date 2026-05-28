# OrbitEditor — Sub-Agents

A short, user-focused guide to OrbitEditor's sub-agent runtime as it ships after the productionisation pass.

## What is a sub-agent?

A sub-agent is an isolated worker AI session that the parent chat agent can delegate to. Sub-agents:

- Run with their own system prompt and tool permissions.
- Do not see the full chat history.
- Return a structured worker report instead of free-form chat.
- Cannot ask the user follow-up questions.
- Cannot spawn further sub-agents.

The parent uses the `task` tool to launch a sub-agent, then synthesises the structured result into its own response.

## Built-in sub-agents

| Name | Purpose | Tier |
|---|---|---|
| `explore` | Read-only architecture / code research. Surfaces architecture, traces flows, cites evidence. | read_only |
| `general` | Bounded synthesis or narrow investigation over already-known context. Use `explore` for broad discovery. | read_only |
| `reviewer` | Code review for correctness, regressions, security, maintainability. Reports blocking vs non-blocking issues. | read_only |
| `security` | Security audit for unsafe patterns, permission gaps, secret exposure. | read_only |
| `planner` | Convert findings into a safe implementation plan with affected files, risks, acceptance criteria, test plan, rollback plan. | read_only |
| `test-verifier` | Identify the right verification commands for a recent change and inspect lint output. (Recommends commands; does not yet execute terminal in this iteration.) | read_only |
| `ux-polisher` | Audit user-facing components, copy, accessibility, error/loading states. | read_only |
| `implementer` | (Disabled in this iteration.) Apply an approved plan with minimal edits. | safe_write |

## Permission tiers

```
read_only            search + read; no MCP mutations; no terminal
safe_write           read + edit + create file; no terminal; no destructive ops
terminal_safe        safe_write + run_command (terminal-safety regex enforced)
full_with_approval   inherit parent; every effectful call needs user approval
```

Every visible agent today uses `read_only`. The other tiers are wired through the runtime guard but no visible agent uses them yet.

## How a delegation looks

Parent invokes the `task` tool:

```
<task>
  <subagent_type>explore</subagent_type>
  <description>trace auth flow</description>
  <objective>Find authentication entrypoints, middleware, and token validation paths.</objective>
  <expected_output>3-6 bullet findings naming specific files + a list of key files with their roles.</expected_output>
  <prompt>... full instructions ...</prompt>
</task>
```

The orchestrator:

1. Resolves the agent in the registry (`common/subAgentRegistry.ts`).
2. Builds a structured task prompt (`common/subAgentTaskBuilder.ts`).
3. Runs the LLM ↔ tool loop with the agent's system contract — **not** the parent chat-assistant prompt.
4. Pre-flight guards every tool call (`common/subAgentPolicy.ts`):
   - Tier allowlist + denylist (deny-first).
   - Terminal command safety regex.
   - Path safety for `.env`, `*.pem`, `id_rsa`, `.aws`, `.ssh`, etc.
   - Tool-call budget.
   - MCP read-only annotation when required.
5. Finalises the run (`common/subAgentValidator.ts`):
   - Parses the assistant text (markdown delimiters or JSON).
   - Validates against the agent's output contract.
   - If validation fails with `block`-severity errors, runs one rewrite-only repair pass.
   - Marks the result as `partial` (yellow badge in the UI) if validation still soft-fails.
6. The parent receives a structured `<task_result>` envelope plus a structured body — never the raw model transcript.

## What the user sees

A sub-agent card in the sidebar shows:

- **Collapsed**: state icon, agent name + task title, last-activity subtitle (while running) or one-line summary (when terminal), tools count, duration, and badges:
  - ⚠ "partial" — the validator triggered a rewrite.
  - 🔒 "blocked" — at least one tool call was rejected by the policy guard.
  - confidence pill: "low" / "medium" / "high".
- **Expanded**: Summary, Findings, Files inspected (chips), Risks, Recommendations, plus any error.

## Customising agents

This iteration ships the eight built-in agents above. Custom project-level agents (e.g. a `.orbit/agents/code-reviewer.md` markdown frontmatter file) are intentionally a follow-up milestone — the registry types in `common/subAgentTypes.ts` already model the shape used by Claude Code and Cursor, so a future loader can plug in without changing the orchestrator.

## Debugging

- All sub-agent activity is logged via the existing metrics service: `SubAgent Task Invoked`, `SubAgent Child Completed/Failed/TimedOut/Killed/Canceled`, and per-call `SubAgent Blocked Action` events.
- Persisted state lives under storage key `void.subAgentTaskStorageI` (see `common/storageKeys.ts`).
- Each task record stores the rendered final report on `report.rawResponse`; the structured fields (`oneLineSummary`, `filesInspected`, `risks`, `recommendations`, `blockedActions`, `confidenceBand`) are also persisted.

## Where things live

```
common/subAgentTypes.ts          Types: SubAgentDefinition, SubAgentChildReport, lifecycle helpers, view-model
common/subAgentRegistry.ts       Built-in agent definitions; the single source of truth
common/subAgentTaskBuilder.ts    validateSubAgentTaskParams, buildSubAgentTaskPrompt, extractObjectiveKeywords
common/subAgentPolicy.ts         PERMISSION_TIER_POLICIES, terminalSafetyCheck, pathSafetyCheck, guardToolCall
common/subAgentValidator.ts      validateSubAgentReport, containsChattyPhrase, ValidationResult
common/subAgentHarness.ts        parseSubAgentReport (existing) + helpers
common/sendLLMMessageTypes.ts    ToolPolicy (extended with disallowedBuiltinTools)

browser/subAgentOrchestratorService.ts   runTaskTool, _runSession, _executeTool (with guard), _finalizeAndValidate, _repairBadReport
browser/subAgentTaskStoreService.ts      Persistent SubAgentTaskRecord store + GC + eviction
browser/toolsService.ts                  task tool registration, validateParams.task, renderTaskHandoffForParent
browser/chatThreadService.ts             Hosts the task tool dispatch and the per-thread sub-agent stage VM
common/prompt/prompts.ts                 Task-tool description + readOnlyToolNames + isDelegationStyleToolName

react/src/sidebar-tsx/components/chatComponents/SubAgentCard.tsx
react/src/sidebar-tsx/components/chatComponents/SubAgentCardList.tsx
react/src/styles.css                     .void-sa-* visual rules
```

For deeper internals, see `docs/subagents-audit/01–08*.md`.
