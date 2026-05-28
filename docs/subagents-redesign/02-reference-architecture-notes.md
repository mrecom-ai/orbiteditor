# 02 — Reference Architecture Notes (Claude Code patterns)

> Inspected `claude-code/src/` in the sibling workspace and Anthropic's public docs. Documented behavior and design only — no code copied.

## Task representation

In `claude-code/src/tasks/LocalAgentTask/LocalAgentTask.tsx`, an agent task carries:

- `agentType` (the subagent name)
- `prompt` (the natural-language instruction the parent wrote when delegating)
- `progress` (a `ProgressTracker` with `toolUseCount`, `recentActivities`, token counters)
- runtime state (background flag, retain flag, evict deadline)

Note: it does **not** carry an explicit per-file evidence ledger either. Their progress tracker has `recentActivities` (last 5 tool calls) and `toolUseCount`. Files inspected are derived implicitly by the model when it writes the result.

This means OrbitEditor's failure mode is partially shared by Claude Code: a weak model that runs tools but doesn't summarise them well will produce a poor result on either platform. **Orbit's fix improves on this by adding a deterministic per-file ledger** that is the source of truth for the validator.

## Subagent runtime loop

Architecture pattern observed:

1. Build the system prompt from the agent's frontmatter.
2. Append a delegation message containing the parent's task prompt.
3. Run the standard message-completion loop (model → tool calls → tool execution → tool results → continue) until the model emits an "end-of-turn" signal (no tool calls, or stop reason).
4. Each tool call updates the progress tracker.
5. The final assistant message is treated as the result.

Distinct from Orbit:

- Claude Code uses the same model loop as the parent agent — sub-agents are not a separate runtime, they are a different system prompt + tools allow-list.
- Orbit uses a dedicated `SubAgentOrchestratorService._runSession` loop, which is correct for our embedding into VS Code.

## Context isolation

Claude Code documents (and code confirms): a sub-agent receives only its system prompt + the delegation message. The parent's chat history is not forwarded. Orbit already does this in `_childSystemContract` + `_toTaskPrompt`. **No change needed here.**

Claude Code's built-in `Explore` and `Plan` agents additionally skip `CLAUDE.md` and the parent session's git status to keep research fast. Orbit's `explore` similarly receives only the structured task. **Already aligned.**

## Tools and permissions

Claude Code:

- Frontmatter `tools: Read, Grep, Glob, Bash` (allowlist) and `disallowedTools: Write, Edit` (denylist; deny-first when both are set).
- Permission modes: `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`.
- `PreToolUse` hooks can validate operations before they execute (e.g. block destructive Bash commands).

Orbit (after the previous productionization pass):

- `permissionMode` tiers: `read_only`, `safe_write`, `terminal_safe`, `full_with_approval`.
- `guardToolCall` runs before every dispatch with terminal/path safety + tool budget.
- No project-level hooks yet — same gap as before.

**Already aligned conceptually.** Hooks are a follow-up.

## Evidence and result handoff

Claude Code:

- The sub-agent's last assistant message is its "result" — i.e. the parent agent receives the model's free-form text.
- No structured contract; the parent uses its own context to interpret it.

Orbit (after this redesign):

- The sub-agent's last assistant message is a draft.
- The deterministic `SubAgentEvidenceTracker` records every successful tool call on the orchestrator side.
- The finalizer **merges** the model's text (rationale, summary line, recommendations) with the tracker's structured ledger (filesInspected, filesChanged, commandsRun, blockedActions).
- The validator runs against the merged result.
- The parent receives only the structured envelope and body — never the raw transcript.

**This is a deliberate Orbit-specific improvement over Claude Code.** Their model relies on the LLM to remember and summarise; ours uses the runtime as ground truth.

## Progress UI

Claude Code's `LocalAgentTask` panel shows:

- Agent name and elapsed time.
- "Last activity" line (e.g. *"Reading src/x.ts"*) derived from `recentActivities`.
- Token count.
- A final summary written by the model when complete.

Orbit's `SubAgentCard` already mirrors this exactly. The redesign keeps the live behavior unchanged and adds a structured terminal body.

## What Orbit should adopt conceptually

1. **The principle that built-in agents are first-class** with a registry and named permission tiers — already done in the previous pass.
2. **Hooks** (`PreToolUse`, `SubagentStop`) for project-level validation/audit — follow-up.
3. **Worktree isolation** for write-tier agents — follow-up.
4. **`isSearch`/`isRead` tool classification** for activity preview — already done.

## What Orbit should NOT adopt

1. **Treating the model's last assistant message as the canonical result.** Orbit already does better by extracting structured fields; this redesign goes further by making the runtime ledger authoritative.
2. **`bypassPermissions` mode** — out of scope for editor sub-agents; the four-tier model is sufficient.
3. **Persistent agent memory** that auto-writes — high risk of poisoning future runs.
4. **Fork mode** — out of scope until the editor has a clear use case for forked sessions.

## Net design decision

Keep Orbit's existing architecture (orchestrator, registry, validator, repair pass). Add **one new layer**: the deterministic `SubAgentEvidenceTracker`. Wire it into:

- `_executeTool` success/failure/block paths (write-side)
- `_finalizeAndValidate` as the source of truth (read-side)
- `validateSubAgentReport` (block-severity when explorer's tracker is empty)
- The terminal report (`SubAgentChildReport.diagnostics` block)
- The parent envelope (one structured block)
- The UI (failure card with diagnostics)

This is the smallest change that closes the screenshot failure and brings the runtime to a Claude Code-equivalent state — and beyond, because the ledger is a real source of truth.
