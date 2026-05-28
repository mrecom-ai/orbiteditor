# 03 — Claude Code Reference Comparison + Patch-vs-Rebuild Decision

## What Claude Code does well

- Clear separation between **agent definition** (frontmatter) and **runtime** (model loop).
- Permission modes are named, declarative, inheritable.
- Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop` → `SubagentStop`) give project-level extensibility.
- The progress UI is intentionally minimal: last activity + tools count.
- Sub-agents are isolated to their own context window.

## What Orbit currently does differently

- Orbit has its own dedicated `SubAgentOrchestratorService` rather than reusing the parent's chat agent. This is correct for an in-editor environment with a tight VS Code service decorator pattern.
- Orbit already provides four named permission tiers and a deterministic policy guard — slightly stronger than Claude Code's six modes (which include `bypassPermissions` that we deliberately omit).
- Orbit derives filesInspected from the **model's text output** — this is the bug the screenshot exposes.

## What Orbit should copy conceptually

- The notion of `recentActivities` for live preview — already done.
- The principle that the runtime, not the model, is the source of truth for execution metadata. Claude Code's tracker still defers to the model for the final report; **Orbit will go one step further** with a deterministic per-file ledger.
- Project-level hooks (deferred to a follow-up milestone).

## What Orbit should NOT copy

- Reliance on the model's last assistant message as the canonical result. Orbit's structured envelope is already better; this redesign tightens it.
- `bypassPermissions` mode.
- Auto-writing persistent memory directories.
- Fork mode (until there's a clear editor use case).

## Patch vs rebuild — decision

> **Targeted core patch with a strangler-pattern shim. Not a full rewrite.**

Justification:

- The runtime loop (`_runSession`) is sound — model ↔ tool ↔ history works correctly. Tool calls succeed; results are returned to the model.
- The tool execution gate (`guardToolCall`) is correct — it runs pre-flight, blocks unsafe calls, and writes to a session-level audit list.
- The validator and repair pass are correct in principle — they just receive the wrong input today (model-derived evidence instead of runtime-derived evidence).
- The agent registry, permission tier system, and parent envelope are all correct.

The only thing structurally missing is a **deterministic `SubAgentEvidenceTracker`** that feeds the finalizer. Adding it does not require rewriting the orchestrator; it requires:

1. Adding the tracker type + a per-session instance.
2. Recording into it from `_executeTool` (success / block / error).
3. Reading from it in `_finalizeAndValidate` to override `filesInspected`/`filesChanged`/`commandsRun`/`blockedActions`.
4. Promoting `MISSING_FILES_INSPECTED` to a hard `failed` status (not "completed but partial") when the tracker is empty.
5. Adding a diagnostics block (model name, tools attempted, tools succeeded, likely cause) to the report and surfacing it in the UI.
6. Adding an evidence gate that injects a corrective user message when the model tries to finalize early without meeting the per-agent evidence requirements.

This is M1–M5 of the redesign spec, plus tests. It does **not** require:

- Rewriting `_runSession`.
- Replacing the LLM message service.
- Changing `chatThreadService`'s task tool dispatch.
- Touching the React UI shell beyond adding a failure-state branch.

## What is intentionally deferred

- **Text tool protocol mode** for weak models that don't tool-call reliably. The deterministic ledger plus the evidence gate already produces a clear `failed` result with diagnostics when a model cannot tool-call. Adding a separate text-protocol parser is a meaningful extension, but it doesn't fix the screenshot — it would address a different failure mode (a model that emits prose like *"call read_file on x.ts"* instead of a structured tool call). Filing as a follow-up.
- **Hooks** and **worktree isolation** — same as the previous pass.
- **Project-level `.orbit/agents/*.md`** — same as the previous pass.

## Strangler-pattern shape

The current `_finalizeAndValidate` becomes:

```
_finalizeAndValidate
  ├─ build draft from model text  ← unchanged
  ├─ overlay evidence from tracker (NEW)
  ├─ validate with hard-fail on missing-evidence-for-explorer (NEW behavior)
  ├─ repair pass if block-severity errors AND tracker has evidence (NEW gate)
  ├─ if tracker is empty: skip repair and go straight to failed status (NEW)
  └─ enrich with diagnostics block (NEW)
```

`_runSession` gets one new branch:

```
on no-tool-calls assistant message:
  if explorer AND tracker.requirementsNotMet AND budget remaining:
    inject corrective user message      ← NEW evidence gate
    continue loop
  else:
    fall through to _finalizeAndValidate
```

Public APIs (`runTaskTool`, `cancelStage`, `killTask`, `ISubAgentOrchestratorService`) are unchanged. The `SubAgentChildReport` shape is widened (new optional `diagnostics` field) but every existing field is preserved.

## Acceptance criteria (this iteration)

1. Same screenshot scenario produces either a real evidence-based report or a clear `failed` card with diagnostics — never a generic "I need to understand" summary.
2. `filesInspected`, `filesChanged`, `commandsRun`, `blockedActions` all come from the runtime tracker.
3. Explorer cannot finalize early when the tracker is empty and the budget is not exhausted.
4. The validator hard-fails (status = `failed`, not `partial`) when explorer has zero tracker evidence.
5. The parent receives a structured failure result with diagnostics.
6. The UI card visibly distinguishes `success` / `partial` / `failed`.
7. Existing chat / edit / apply / model-selection flows still work.
8. Tests cover tracker recording, evidence-gate behavior, hard-fail when empty.
