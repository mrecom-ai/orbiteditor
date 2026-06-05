# 01 — Current Failure Analysis

## Reproduction

User screenshot:

```
Validation soft-failed after repair:
MISSING_EVIDENCE, MISSING_FILES_INSPECTED, TOO_GENERIC

Summary:
I need to understand the context better. Let me explore the workspace...

Tools count: 68
```

Same workspace, default `explore` agent, model that successfully called 68 tools.

## Root cause (single bug, three symptoms)

The orchestrator **derives `filesInspected` from the model's text output, not from the actual tool calls it executed.**

### Code evidence

`src/vs/workbench/contrib/orbit/browser/subAgentOrchestratorService.ts`, inside `_finalizeAndValidate`:

```ts
const buildDraft = (text: string) => {
    const parsed = this._parseChildSummary(text)
    const filesInspected = Array.from(
        new Set(parsed.evidence.map(e => e.path).filter(p => !!p))
    )
    ...
}
```

`parsed.evidence` is parsed from the model's **assistant message text** by `_parseChildSummary` (looks for `## Evidence` markdown sections, JSON `evidence: []`, etc.).

When the model emits a generic message like *"I need to understand the context better"* with no markdown evidence section, `parsed.evidence` is empty → `filesInspected` is empty → the validator's `MISSING_FILES_INSPECTED` rule fires.

The model already called 68 read/search tools. We **have** that data on the orchestrator side. We just throw it away.

## Data-flow diagram

```
Read({ path: 'src/x.ts' })  ─┐
Glob({ glob_pattern: '**/*auth*' }) ─┼─ executed in _executeTool, success path
Grep({ pattern: 'auth' })   ─┘
                                    │
                                    ▼
              progress.toolUseCount += 1   ← only a counter
              progress.recentActivities.push({ toolName, ... })  ← display-only
                                    │
                                    │  (no per-file ledger created)
                                    ▼
              session.history.push(toolMessage)  ← raw stringified result
                                    │
                                    ▼
              Loop returns when LLM emits no tool calls
                                    │
                                    ▼
              _finalizeAndValidate
                  └─ _parseChildSummary(lastAssistantText)  ← MODEL'S TEXT
                      └─ extracts evidence from "## Evidence" section IF model wrote one
                  └─ filesInspected = parsed.evidence.map(e => e.path)
                                    │
                                    │  IF model didn't write the section: []
                                    ▼
              validateSubAgentReport
                  └─ requireFilesInspected: true
                      └─ filesInspected.length === 0
                      └─ MISSING_FILES_INSPECTED → block
                                    │
                                    ▼
              _repairBadReport
                  └─ asks the model to rewrite — but the model still has nothing
                     concrete to put in the evidence section because nothing
                     forces it to
                                    │
                                    ▼
              re-validate → still missing → soft-fail → confidence dampened to ≤ 0.4
                                    │
                                    ▼
              Card shows "Validation soft-failed after repair:
                          MISSING_EVIDENCE, MISSING_FILES_INSPECTED, TOO_GENERIC"
```

## Why the three error codes correlate

- `MISSING_EVIDENCE` — `report.evidence.length === 0` because that field is also derived from `parsed.evidence`.
- `MISSING_FILES_INSPECTED` — derived from the same source.
- `TOO_GENERIC` — bullets are short and contain no path-shape; this is a soft consequence of the same bug.

A single fix (deterministic evidence tracker) clears all three.

## Why the repair pass cannot save this

`_repairBadReport` is rewrite-only and is told "do not invent evidence". The original tool calls' results are buried in `session.history` as stringified tool messages. The repair pass receives only the previous-bad text + the validation errors; the model has no clean structured input to recover the file paths from. So the second pass also fails the validator.

## Why "the parent had to fall back and explore directly"

`renderTaskHandoffForParent` includes the validation status. The parent receives `confidence=low`, no evidence, no files inspected. Its system prompt says "trust the result" but the result is empty. It cannot reasonably trust an empty report, so it re-investigates manually. This is a downstream consequence of the same root cause.

## Other things to fix at the same time

While here, the audit should also tighten:

1. **The validator's `MISSING_FILES_INSPECTED` is currently block-severity** (correct), but the orchestrator catches the block and only soft-fails if repair doesn't fix it. For `explore`, missing evidence after repair must escalate to **hard `failed`**, not "completed but partial".
2. The current report has no diagnostics for the parent or UI to explain WHY the run failed (model? tool failure? guard? model didn't tool-call?).
3. There's no evidence gate — the model can choose to finalize at any time. The explorer should be forced to keep trying until the budget is exhausted if it has zero evidence.

## What this audit confirms

- The runtime is fundamentally correct (LLM ↔ tool ↔ history loop works).
- The handover from runtime to finalizer drops the structured tool-activity ledger and re-derives it from text.
- Fixing the handover is a focused change: add a tracker, populate it on every successful tool call, use it in the finalizer instead of (or alongside) `_parseChildSummary`.

The code below implements that fix.
