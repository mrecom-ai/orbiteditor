# 07 — Implementation Plan

## Guiding constraints

- Do not break the existing build, chat, file-edit, terminal, or model-selection flows.
- Compile after every milestone. Run `npm run compile-client` (per `AGENTS.md`).
- Keep changes additive when possible. Refactor in place only when necessary.
- Never edit `out/`, `.build/`, `node_modules/`, or upstream VS Code files.
- Tests run via `npm run test-node`; convention is mocha `suite/test` + `ensureNoDisposablesAreLeakedInTestSuite`.

## File inventory (planned changes)

| Milestone | New files | Modified files |
|---|---|---|
| M1 | `common/subAgentRegistry.ts`<br>`common/subAgentPermissions.ts` | `common/subAgentTypes.ts` (extend types)<br>`browser/subAgentOrchestratorService.ts` (consume registry)<br>`common/prompt/prompts.ts` (task tool description references registry list) |
| M2 | `common/subAgentTaskBuilder.ts` | `browser/toolsService.ts` (validate new fields)<br>`browser/subAgentOrchestratorService.ts` (`_toTaskPrompt` includes objective/expectedOutput)<br>`common/prompt/prompts.ts` (task tool params) |
| M3 | `common/subAgentPolicy.ts` | `browser/subAgentOrchestratorService.ts` (`_executeTool` calls guard)<br>`common/sendLLMMessageTypes.ts` (extend ToolPolicy with disallowedBuiltinTools) |
| M4 | `common/subAgentValidator.ts`<br>`common/subAgentFinalizer.ts` | `browser/subAgentOrchestratorService.ts` (replace inline finalize) |
| M5 | — | `browser/toolsService.ts` (`renderTaskHandoffForParent`) |
| M6 | — | `common/subAgentTypes.ts` (extend view model)<br>`browser/subAgentOrchestratorService.ts` (populate new view fields)<br>`react/src/sidebar-tsx/components/chatComponents/SubAgentCard.tsx` |
| M7 | `test/common/subAgentRegistry.test.ts`<br>`test/common/subAgentPolicy.test.ts`<br>`test/common/subAgentValidator.test.ts`<br>`test/common/subAgentFinalizer.test.ts`<br>`test/common/subAgentTaskBuilder.test.ts` | — |
| M8 | `docs/subagents-audit/08-verification-report.md`<br>`docs/sub-agents/architecture.md` (user-facing) | — |

## Milestones

### M1 — Registry + new built-in agents

1. Add `AgentPermissionMode`, `AgentContextPolicy`, `AgentOutputContract`, extended `SubAgentDefinition` to `common/subAgentTypes.ts`.
2. Create `common/subAgentRegistry.ts` exporting `BUILTIN_SUBAGENTS`, `getAgent(name)`, `listVisibleAgents()`. Include all existing agents + `planner`, `test-verifier`, `ux-polisher`. (`implementer` defined but excluded from default visible list.)
3. Update `subAgentOrchestratorService._agentRegistry()` to read from this module.
4. Update `prompts.ts` task tool description to enumerate visible agents using `listVisibleAgents()`. Keep description string concise.

Verification: `npm run compile-client` passes. Existing sub-agent invocations still work.

### M2 — Task creation quality

1. Add `objective`, `expectedOutput`, `acceptanceCriteria`, `scope` to `task` tool params (`prompts.ts`). Mark as optional in description.
2. Update `toolsService.validateParams.task` to accept and validate them.
3. Add `common/subAgentTaskBuilder.ts` with `buildSubAgentTask(params, agent)` returning a `SubAgentTask` and `validateSubAgentTask(task)` returning errors.
4. Update `_toTaskPrompt` to include `Objective`, `Expected output`, and `Acceptance criteria` blocks when present.

### M3 — Permission enforcement

1. Add `disallowedBuiltinTools?: string[]` to `ToolPolicy` (`common/sendLLMMessageTypes.ts`).
2. Add `common/subAgentPolicy.ts` with permission tier presets, `terminalSafetyCheck`, `pathSafetyCheck`, `guardToolCall`.
3. Wire `_executeTool` in orchestrator to call `guardToolCall` before built-in or MCP dispatch. On block, return a structured `tool_error` and append a `BlockedToolCall` to a session-scoped list which is then merged into `report.blockedActions` at terminal time.
4. Update `prompts.availableTools` and `subAgentHarness.isSubAgentBuiltinToolAllowed` to delegate to `subAgentPolicy`. Eliminate duplicated logic.
5. Add prompt-injection guardrail line to `_childSystemContract`.

### M4 — Finalizer + validator + repair

1. Add `common/subAgentValidator.ts` with rule list and `validateSubAgentReport(report, contract, ctx)`.
2. Add `common/subAgentFinalizer.ts` with `finalizeSubAgentRun({ rawText, history, agent, task, blockedActions, durationMs })` that:
   - calls `parseSubAgentReport` (existing),
   - constructs a typed `SubAgentResult` and `SubAgentChildReport`,
   - validates,
   - returns `{ result, needsRepair: boolean, validationErrors }`.
3. Modify `_runSession` to:
   - call finalizer once,
   - if `needsRepair` and not yet attempted, call `repairSubAgentReport(...)` (a hardened version of `_repairChattySummary`) and finalize again,
   - otherwise return the result (marking `status: 'partial'` if validation still fails).
4. The repair pass uses a "rewrite-only" mini contract that does not invoke tools.

### M5 — Parent merge

1. Update `renderTaskHandoffForParent` in `toolsService.ts` to:
   - render envelope (unchanged),
   - render structured body fields from `result` (one-line summary, findings, files inspected, recommendations, risks, blockers),
   - cap total to 6 KB,
   - omit raw assistant transcript.
2. Keep `result.report.rawResponse` available on the message for debug/UI.

### M6 — UI improvements

1. Extend `SubAgentChildViewModel` with `oneLineSummary`, `filesInspected`, `risks`, `recommendations`, `confidence`, `wasRepaired`, `blockedActionsCount`.
2. Orchestrator populates these on terminal transition (from the validated `SubAgentResult`).
3. `SubAgentCard.tsx`:
   - prefer `oneLineSummary` for terminal subtitle,
   - show ⚠ "partial" badge when `child.state === 'completed'` and `wasRepaired`,
   - show 🔒 "blocked" indicator when `blockedActionsCount > 0`,
   - render expanded body in order: one-line summary, findings, files-inspected chips, risks, recommendations, error.
4. Run `npm run buildreact` after React edits.

### M7 — Tests

For each new pure module, add a test file under `test/common/`. Use mocha `suite/test`. Cover at minimum:

- `subAgentRegistry`: every visible agent is registered, has unique name, has prompt non-empty, has `permissionMode`.
- `subAgentPolicy`:
  - read_only blocks `edit_file`, `run_command`, `delete_file_or_folder`.
  - terminal_safe blocks dangerous commands (`rm -rf`, `sudo`, `git push --force`, `curl | sh`).
  - terminal_safe accepts safe commands (`npm test`, `git status`).
  - path safety blocks `.env`, `id_rsa`, `*.pem`.
  - MCP mutating tool blocked for read_only.
- `subAgentValidator`:
  - rejects "What would you like me to do?", "I can help" etc.
  - rejects explorer report with no evidence.
  - rejects read-only report with non-empty filesChanged.
  - accepts a valid evidence-based explorer report.
- `subAgentFinalizer`:
  - generic chatty input → repair flag.
  - good input → validates without repair.
  - safe partial fallback when repair fails.
- `subAgentTaskBuilder`:
  - rejects task without objective for visible agent (soft warning).
  - accepts well-formed task.

Verification: `npm run test-node`.

### M8 — Documentation + verification

1. Write `docs/subagents-audit/08-verification-report.md` with command results.
2. Optionally add a user-facing `docs/sub-agents/architecture.md` summarising the final system. (We will check page budget; if the audit folder already documents it sufficiently, link to that.)

## Sequencing notes

M1 → M2 → M3 → M4 are tightly ordered (each consumes prior types).
M5 depends on M4's `SubAgentResult` shape.
M6 can land in parallel with M5 once `SubAgentResult` exists.
M7 follows M6 so the React shape is stable before tests reference it (tests target pure logic so are mostly independent).

If time pressure forces a cut, M5 + M6 are the most user-visible. M3 + M4 are the most user-trust-critical. M7 must ship — there were no tests before.
