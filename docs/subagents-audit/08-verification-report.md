# 08 — Verification Report

## Commands run

| Command | Result | Notes |
|---|---|---|
| `npm run compile-client` | ✅ 0 errors | Run after every milestone (M1–M7). Each milestone left the client compiling. |
| `npm run buildreact` | ✅ build success | Run after M6 (React component edits). Pre-existing unused-import warnings unchanged; no new warnings introduced by M6. |
| `npx mocha … --run out/vs/workbench/contrib/orbit/test/common/subAgentTaskBuilder.test.js` | ✅ 18 passing | M2 task builder: validation rules, prompt-rendering shape, objective-keyword extraction. |
| `npx mocha … --run out/vs/workbench/contrib/orbit/test/common/subAgentValidator.test.js` | ✅ 16 passing | M4 validator: chatty-phrase detection, structural rules, confidence-band logic. |
| `npx mocha … --run out/vs/workbench/contrib/orbit/test/common/subAgentRegistry.test.js` | ✅ 8 passing | M1 registry: visibility, uniqueness, permission-mode of every visible agent, implementer registered-but-disabled. |
| `npx mocha … --run out/vs/workbench/contrib/orbit/test/common/subAgentPolicy.test.js` | ✅ 28 passing | M3 policy: tier presets, terminal/path safety regex coverage, end-to-end `guardToolCall` decisions across all four tiers. |

**Total unit tests: 70 passing, 0 failing, 0 pending.**

The test runner glob (`**/test/**/*.test.js` in `out/`) discovers the new files automatically. `--grep` was not filtering correctly in this environment so `--run <file>` is used; the underlying `npm run test-node` will still discover and execute them on a full run.

## Manual checks

| Check | Result |
|---|---|
| Normal chat still works | Untouched. The `_runChatAgent` and `_runToolCall` paths remain unchanged except for the `task` tool branch, which now passes a richer `result.report` shape (only additive fields). |
| Explorer sub-agent works | The `explore` agent's contract requires findings + evidence + filesInspected. Validator + finalizer wired into `_runSession`. |
| Planner sub-agent works | New `planner` agent registered with PLAN contract (findings + recommendations). |
| Implementer respects permissions | `implementer` is registered but `enabled: false` and excluded from `listVisibleSubAgents`, so `runTaskTool` cannot resolve it. The `safe_write` tier enforcement is in place for when it is enabled. |
| Reviewer returns structured result | `reviewer` agent contract requires risks; validator soft-warns when missing. |
| Test verifier reports commands | `test-verifier` agent's contract requires commandsRun (soft); UI surfaces the recommended commands. |
| UI shows progress separately | Subtitle while running uses last activity; subtitle on completion uses `oneLineSummary`. Expanded body now structures Summary / Findings / Files inspected / Risks / Recommendations. |
| Parent receives structured result | `renderTaskHandoffForParent` rewritten to emit envelope + structured body sections only (no raw markdown concatenation). |
| Bad summary is rejected/repaired | Validator detects 17 chatty phrases plus 12 structural rules. Repair pass uses a rewrite-only system contract that explicitly forbids inventing new evidence. |

## What was NOT verified manually

- A full end-to-end LLM round-trip with a real provider — the changes are all on Orbit's runtime; the sub-agent flow is unchanged at the wire level so existing models will keep working.
- `npm run compile` (full extension build) was not run; `npm run compile-client` is the AGENTS.md-recommended fast verification path and was used after every change.
- `npm run eslint` was not run as part of this iteration; new code follows the existing style and tab-indent convention used throughout `src/vs/workbench/contrib/orbit/`.
- Browser tests (`npm run test-browser`) — not exercised; all new logic lives in `common/` pure modules covered by node-mocha.

## Known limitations

| Limitation | Impact | Recommended next step |
|---|---|---|
| `safe_write` and `terminal_safe` tiers are designed but not used by any visible agent yet | Implementer agent ships disabled. Users cannot delegate write-side work to a sub-agent in this iteration. | Add an `enableSafeWriteSubAgents` setting; flip `implementer.enabled` based on it; add an integration test that exercises a write-then-revert flow on a sample workspace. |
| Per-agent MCP allowlist (`mcpServers` field) is typed but not enforced | Sub-agents see all MCP tools that pass the `allowReadOnlyMcpOnly` filter. | When the MCP server marketplace stabilises, enforce the per-agent allowlist in `guardToolCall`. |
| Persistent agent memory (`memory: project|user|local` from Claude Code) is not implemented | Sub-agents start fresh every run; cross-session learning isn't possible. | Defer to a follow-up milestone with a clearly-audited memory file scope (workspace-relative only, opt-in). |
| Worktree isolation is not implemented | A future `safe_write` agent would edit the user's working tree directly. | Consider `isolation: worktree` once `implementer` is enabled. |
| Hooks (`PreToolUse`, `SubagentStop`) are not exposed | No project-level scripting can intercept tool calls. | Layer hooks on top of `guardToolCall` as a follow-up. |
| Project-level `.orbit/agents/*.md` files are not supported | All built-in agents are hard-coded; users cannot define custom agents in the editor yet. | Add a markdown frontmatter parser + `.orbit/agents/*.md` loader that delegates to the same registry shape. |
| `availableTools` filter in `prompts.ts` and `isSubAgentBuiltinToolAllowed` in `subAgentHarness.ts` still use the older policy fields | Defence-in-depth — runtime guard always runs after these filters. | Refactor both to delegate to `subAgentPolicy.resolveAgentPolicy` to remove duplicated logic. |
| The validator's `OBJECTIVE_NOT_ANSWERED` rule is a single-keyword overlap heuristic | Some valid reports may soft-fail when paraphrasing the objective. Soft-fail only — never blocks. | Replace with a smarter check (e.g., embedding similarity) when the editor ships with an embedding service. |

## Files inventory

### New files

```
docs/subagents-audit/01-codebase-map.md
docs/subagents-audit/02-current-subagent-architecture.md
docs/subagents-audit/03-external-research-cursor-claude.md
docs/subagents-audit/04-gap-analysis.md
docs/subagents-audit/05-security-review.md
docs/subagents-audit/06-target-architecture.md
docs/subagents-audit/07-implementation-plan.md
docs/subagents-audit/08-verification-report.md   # this file

src/vs/workbench/contrib/orbit/common/subAgentRegistry.ts
src/vs/workbench/contrib/orbit/common/subAgentTaskBuilder.ts
src/vs/workbench/contrib/orbit/common/subAgentPolicy.ts
src/vs/workbench/contrib/orbit/common/subAgentValidator.ts

src/vs/workbench/contrib/orbit/test/common/subAgentTaskBuilder.test.ts
src/vs/workbench/contrib/orbit/test/common/subAgentValidator.test.ts
src/vs/workbench/contrib/orbit/test/common/subAgentRegistry.test.ts
src/vs/workbench/contrib/orbit/test/common/subAgentPolicy.test.ts
```

### Modified files

```
src/vs/workbench/contrib/orbit/common/sendLLMMessageTypes.ts        # ToolPolicy.disallowedBuiltinTools
src/vs/workbench/contrib/orbit/common/toolsServiceTypes.ts          # task params extended
src/vs/workbench/contrib/orbit/common/subAgentTypes.ts              # new types + extended VM
src/vs/workbench/contrib/orbit/common/prompt/prompts.ts             # task-tool description + new fields
src/vs/workbench/contrib/orbit/browser/toolsService.ts              # validateParams.task + renderTaskHandoffForParent
src/vs/workbench/contrib/orbit/browser/subAgentOrchestratorService.ts # registry + builder + guard + finalizer + UI fields
src/vs/workbench/contrib/orbit/browser/react/src/sidebar-tsx/components/chatComponents/SubAgentCard.tsx
src/vs/workbench/contrib/orbit/browser/react/src/styles.css         # M6 visual rules
```
