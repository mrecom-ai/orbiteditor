# 01 — Codebase Map (Sub-Agent System)

> All paths are relative to `orbiteditor/`. Findings are source-grounded — every claim cites a file.

## Workspace shape

- `orbiteditor/` — VS Code fork (Orbit). Orbit-specific code lives under `src/vs/workbench/contrib/orbit/`.
- `claude-code/` — separate sibling project; not relevant for the sub-agent runtime.

## Important folders for sub-agents

| Path | Role |
|---|---|
| `src/vs/workbench/contrib/orbit/common/` | Pure types and helpers shared between browser and electron-main. |
| `src/vs/workbench/contrib/orbit/browser/` | Workbench-side services that the renderer wires up. The orchestrator and stores live here. |
| `src/vs/workbench/contrib/orbit/browser/react/src/` | React UI for the sidebar and sub-agent cards. |
| `src/vs/workbench/contrib/orbit/common/prompt/` | All system prompts, tool catalogs, allow-lists. |
| `src/vs/workbench/contrib/orbit/test/common/` | **Empty** — no Orbit tests exist today. |

## Sub-agent files (direct)

| File | Size (LoC) | Purpose |
|---|---:|---|
| `common/subAgentTypes.ts` | ~440 | Types: `SubAgentDefinition`, `SubAgentTaskRecord`, `SubAgentChildReport`, `SubAgentEvidence`, `SubAgentStageViewModel`, lifecycle helpers (`transitionToTerminal`, `applyBackgroundDefaults`). |
| `common/subAgentHarness.ts` | ~220 | Shared helpers: `parseSubAgentReport`, `summarizeSubAgentActivity`, `readonlySubAgentPolicy`, `isSubAgentBuiltinToolAllowed`, `isSubAgentMcpToolAllowed`. |
| `browser/subAgentTaskStoreService.ts` | ~280 | Persistent `ISubAgentTaskStoreService` (storage scope APPLICATION) + thread/session indexing + GC + eviction. |
| `browser/subAgentOrchestratorService.ts` | ~2300 | The runtime: `runTaskTool`, `_runSession`, system contract, tool execution, parser, repair pass, native registry constant. |
| `browser/react/src/sidebar-tsx/components/chatComponents/SubAgentCard.tsx` | ~190 | Single-child collapsed/expanded card. |
| `browser/react/src/sidebar-tsx/components/chatComponents/SubAgentCardList.tsx` | ~40 | Stage container — sorts children by priority. |

## Sub-agent files (touch points)

| File | Why it matters |
|---|---|
| `browser/chatThreadService.ts` | Hosts `runTaskTool` invocation (line ~1061), threads sub-agent stage state into stream state (`subAgentStage`, `subAgentStagesByToolId`), persists tool-result envelopes via `_sanitizeThreadsForStorage`. |
| `browser/toolsService.ts` | Validates the `task` tool params (line ~617), throws when called outside chatThreadService (line ~1239), renders the parent-facing `<task_result>` envelope via `renderTaskHandoffForParent` (line ~194). |
| `browser/convertToLLMMessageService.ts` | Builds LLM messages for the parent and sub-agent (`prepareLLMChatMessages`). The full chat-assistant system prompt is **excluded** for sub-agents — they get only the worker contract. |
| `common/prompt/prompts.ts` | Defines: `task` tool schema and description (line ~945), `readOnlyToolNames`, `isMCPToolReadOnly`, `isDelegationStyleToolName`, `availableTools` filter, `chat_systemMessage` parent prompt with sub-agent guidance. |
| `common/orbitSettingsTypes.ts` | Settings: `enableDynamicSubAgents`, `subAgentMaxParallel` (1‑3), `subAgentPerChildTimeoutMs`, `subAgentStageTimeoutMs`. Default `enableDynamicSubAgents: false`. |
| `common/storageKeys.ts` | `SUBAGENT_TASK_STORAGE_KEY = 'void.subAgentTaskStorageI'`. |
| `common/sendLLMMessageTypes.ts` | `ToolPolicy` shape: `allowedBuiltinTools`, `allowReadOnlyMcpOnly`, `denyDelegation`. |
| `react/src/util/services.tsx` | Exposes `ISubAgentOrchestratorService`/`ISubAgentTaskStoreService` to React via accessor. |
| `react/src/sidebar-tsx/SidebarChat.tsx` | Renders `SubAgentCardList` from `streamState[threadId].subAgentStage`. |

## Pipeline-adjacent files

| File | Role |
|---|---|
| `common/sendLLMMessageService.ts` | LLM bridge (browser → electron-main). |
| `electron-main/llmMessage/sendLLMMessage.impl.ts` | Provider implementations for all models. |
| `common/mcpService.ts`, `common/mcpServiceTypes.ts` | MCP tool discovery + invocation; sub-agents reuse this with read-only filter. |
| `browser/terminalToolService.ts` | Terminal command runner used by the `run_command` and persistent terminal tools. Sub-agents currently cannot reach this because terminal tools are not in `readOnlyToolNames`. |
| `common/orbitSettingsService.ts` | Settings persistence and `globalSettings` shape. |
| `browser/react/src/sidebar-tsx/constants/builtinToolNameToComponent.tsx` | Maps tool name → React component for tool result display, including `task`. |
| `browser/react/src/sidebar-tsx/constants/toolTitles.tsx` | Tool title overrides — includes `task`. |

## Settings + UI

- `react/src/orbit-settings-tsx/Settings.tsx` exposes `enableDynamicSubAgents`, `subAgentMaxParallel`, and timeouts.
- Defaults: `enableDynamicSubAgents: false`, `subAgentMaxParallel: 3`, per-child 240 s, stage 360 s.

## Build & test commands available

From `package.json` and `AGENTS.md`:

| Command | Purpose |
|---|---|
| `npm run compile-client` | Fastest client-only TS compile. Used to validate orbit edits. |
| `npm run compile` | Full compile (slow). |
| `npm run buildreact` | Bundles React UI in `browser/react/`. Required if React source changed. |
| `npm run watch` | Continuous compile via `deemon`. |
| `npm run eslint` | Lint. |
| `npm run test-node` | Mocha unit tests in `test/unit/`. |
| `npm run test-browser` | Playwright. |

Test convention for workbench contribs (see e.g. `src/vs/workbench/contrib/snippets/test/browser/*.test.ts`): suite + ensureNoDisposablesAreLeakedInTestSuite + node-mocha.

## Existing tests for sub-agents

**None.** `src/vs/workbench/contrib/orbit/test/common/` is empty (no `.gitkeep`, no `*.test.ts`).

## Areas requiring deeper inspection

- Whether `SubAgentDefinition` is truly the source of truth or if `NATIVE_SUBAGENTS` (orchestrator-private) duplicates intent. **Confirmed in Phase 2: it is duplicated and not centralised.**
- Whether the parser's "directMarkdown" path can pass through chatty text that the chatty-detector regex misses. **Confirmed in Phase 2: yes, only one substring list, no semantic check.**
- Whether read-only enforcement happens inside `_executeTool` for MCP and built-in tools. **Confirmed: yes, but the same checks are scattered between `_executeTool`, `availableTools`, and the harness — easy to drift.**
- Whether terminal commands could ever be reached. **Confirmed: read-only sub-agents cannot, because `run_command`/`run_persistent_command` are not in `readOnlyToolNames` and the policy only allows that list.**
