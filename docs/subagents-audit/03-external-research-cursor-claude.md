# 03 — External Research: Cursor and Claude Code Sub-agent Systems

## Sources checked

- **Cursor 2.4 changelog (official)** — https://cursor.com/changelog/2-4
  - Reliability: official.
  - Confirms: Cursor 2.4 introduced sub-agents that "run in parallel, use their own context, and can be configured with custom prompts, tool access, and models." Built-in defaults exist; custom sub-agents are optional.
- **Cursor sub-agent docs (canonical)** — https://cursor.com/docs/context/subagents
  - Reliability: official; the page returned no content via web fetch from this environment, so concrete frontmatter syntax for Cursor is not used in this doc. The 2.4 changelog and surrounding Cursor docs (modes, hooks, MCP) are sufficient for the patterns Orbit needs.
- **Claude Code "Create custom subagents" docs** — https://docs.claude.com/en/docs/claude-code/sub-agents
  - Reliability: official.
  - Confirms: every detail of the model below — frontmatter fields, scope, hooks, permission modes, MCP scoping, persistent memory, model selection, tool allow/deny, fork mode.
- **Claude Code agents/teams overview** — https://docs.claude.com/en/docs/claude-code/agents
  - Reliability: official.
- **Cursor MCP & dynamic context discovery blog** — https://cursor.com/blog/dynamic-context-discovery
  - Reliability: official.

The Cursor pages reinforce that the sub-agent design space is converging on Claude Code's frontmatter pattern. Orbit-Editor should adopt that vocabulary and behavior internally rather than invent new terminology.

## Cursor-style patterns

- **Independent agents** — Cursor "subagents are independent agents specialized to handle discrete parts of a parent agent's task." Each is a worker-style process, not a chat companion.
- **Parallel execution** — Multiple sub-agents run simultaneously; results return to the main conversation.
- **Own context** — "They run in parallel, use their own context" — strict context isolation.
- **Custom prompts** — Each sub-agent has its own prompt definition.
- **Tool access** — Sub-agents can be configured with specific tool access; defaults exist for research, terminal, and "parallel work streams".
- **Model choice** — Each sub-agent can specify a model.
- **Parent result merging** — "Faster overall execution, more focused context in your main conversation" — results are merged as summaries, not raw transcripts.
- **UI behavior** — Sub-agents appear as separate panels; the main chat stays "focused" — implies a card / row UI similar to what Orbit already has.
- **Hooks** — `PreToolUse`, `PostToolUse`, `Stop`, `beforeSubmitPrompt`, etc., available for validation and audit.
- **Skills** — Cursor and Claude Code both support `SKILL.md` packs — domain knowledge attached to a sub-agent.
- **Limitations / unclear areas** — Cursor's exact frontmatter, max parallelism, and how it scopes MCP per agent were not retrievable from the docs page in this run; Orbit can mirror Claude Code's published spec without loss of generality.

## Claude Code-style patterns

These are the most concrete and best-documented; Orbit will draw most heavily from these.

- **Agent definitions** — Markdown files with YAML frontmatter:

  ```yaml
  ---
  name: code-reviewer
  description: Expert code review specialist. Use proactively after code changes.
  tools: Read, Grep, Glob, Bash
  disallowedTools: Write, Edit
  model: sonnet
  permissionMode: default
  maxTurns: 20
  mcpServers: [github]
  skills: [api-conventions]
  hooks: { ... }
  memory: project
  background: false
  isolation: worktree
  color: blue
  initialPrompt: "..."
  ---

  System prompt body in markdown.
  ```

  Only `name` and `description` are required.

- **Agent descriptions** — drive automatic delegation: "Claude uses each subagent's description to decide when to delegate tasks." Phrases like "use proactively" encourage selection.

- **Agent routing** — the parent agent decides; the user can also explicitly invoke via natural-language name, `@-mention`, or session-wide `--agent`.

- **Isolated context** — "Each subagent starts with a fresh, isolated context window. It does not see your conversation history, the skills you've already invoked, or the files Claude has already read."

- **Tool permissions** — `tools` (allowlist) and `disallowedTools` (denylist). If both are set, deny is applied first then allow. Tool-name syntax `Agent(worker, researcher)` restricts what types of sub-agents the agent can spawn.

- **Skills / project instructions** — `skills` field preloads skill markdown into the agent at startup. Orbit can map this to project-level instruction files.

- **Result handoff** — "When subagents complete, their results return to your main conversation." The main agent receives the summary and can synthesise.

- **Safety model** — explicit `permissionMode` with values `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. Background agents auto-deny anything that would prompt.

- **Built-in agents** — `Explore` (read-only Haiku-fast research), `Plan` (read-only research for plan mode), `general-purpose` (full tool access), plus helpers (statusline-setup, claude-code-guide).

- **Hooks** — `PreToolUse`, `PostToolUse`, `Stop` (`SubagentStop`), `SubagentStart`, `SubagentStop` for project settings.

- **Worktree isolation** — `isolation: worktree` runs the agent in a temp git worktree branched from the default branch; cleaned up if no changes.

- **No nesting** — sub-agents cannot spawn other sub-agents (matches Orbit's `denyDelegation: true`).

- **Limitations / unclear areas** — fork mode is experimental; some hooks ignored for plugin sub-agents (security).

## Patterns OrbitEditor should copy

- **YAML-frontmatter style markdown agent files** — even if the first iteration only ships built-ins, the *internal* shape (`name`, `description`, `whenToUse`, `prompt`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, etc.) should mirror this so a future "load `.orbit/agents/*.md`" feature is just a parser.
  - Why it matters: gives users a familiar mental model and a clear extension path.
  - How Orbit should implement: define `SubAgentDefinition` with these exact fields; keep a registry service; wire the orchestrator to consume the registry, not a private constant.

- **Tool allowlist + denylist with deny-first resolution** — Claude Code's order: deny first, then allow against the remaining pool. Orbit currently has only an allowlist (`allowedBuiltinTools`) plus delegation deny.
  - Why it matters: deny-first lets a base agent inherit broad tools but block dangerous ones; matches operator expectations.
  - How Orbit should implement: extend `ToolPolicy` with `disallowedBuiltinTools?: string[]`; centralise in one helper.

- **Permission modes as named tiers** — `read_only`, `safe_write`, `terminal_safe`, `full_with_approval`. Orbit's current setup is implicit — `denyDelegation + allowReadOnlyMcpOnly + allowedBuiltinTools=readOnlyToolNames` is one preset but never named.
  - Why it matters: names allow users to pick a tier without reasoning about every flag.
  - How Orbit should implement: introduce `AgentPermissionMode` enum; precompute the matching `ToolPolicy` for each.

- **Description-driven delegation guidance** — write a clear "when to use" sentence per agent; surface it in the parent system prompt's task tool description.
  - Why it matters: improves automatic routing accuracy.
  - How Orbit should implement: add `whenToUse: string` to the definition; embed the list in the parent prompt.

- **Hooks lifecycle** — at minimum `PreToolUse` and `SubagentStop` for audit and policy enforcement.
  - Why it matters: lets Orbit add an audit log without rewriting the orchestrator.
  - How Orbit should implement: add an internal `subAgentHooks` array invoked in `_executeTool` and at terminal transition. (Future milestone — not needed for first production cut.)

- **Structured progress vs result split** — Cursor's UI keeps progress out of the main conversation; only the summary returns. Orbit already does this for the parent (good); the UI card body should mirror it by showing structured fields, not the raw rolling activity log, in expanded mode.

- **Fork (later)** — only when forking is actually useful for the editor; not first-iteration.

## Patterns OrbitEditor should avoid

- **`bypassPermissions` as a default** — Claude Code allows it but warns it skips all checks including `.git`/`.claude`/`.vscode` writes. Orbit should never expose this for sub-agents; it should only exist as an explicit operator override that requires a dialog.
  - Risk: silent, irreversible damage to the user's repo.
  - Safer alternative: `terminal_safe` and `full_with_approval` tiers.

- **Auto-delegating to a "general-purpose" agent that has every tool** — Claude Code does this and the parent loses control. Orbit's parent already routes explicitly via the `task` tool; we should keep that.
  - Risk: blurred boundaries, harder audit.
  - Safer alternative: keep explicit `subagent_type` selection in the task tool params.

- **Persistent memory directories** that the sub-agent can write to without approval — Claude Code allows `memory: project` to auto-enable Read/Write/Edit. For Orbit's first production cut, persistent memory writes should be **off**; revisit once the safety model is mature.
  - Risk: a single bad sub-agent run can permanently poison future sub-agent context.
  - Safer alternative: in-memory only for now; add memory in a later, audited milestone.

- **CLI-only `--agent` "session-as-subagent" override** — useful for Claude Code CLI but inappropriate for Orbit's editor UX where the parent chat-assistant identity is the user's mental model.
  - Risk: user confusion when the chat suddenly behaves like a worker.
  - Safer alternative: keep sub-agents distinct from the main chat-assistant role.

## Net guidance for Orbit's redesign

1. Keep the parent → child contract the user already has; do not adopt fork mode in this iteration.
2. Make `SubAgentDefinition` a service-level registry with all fields above.
3. Add the four missing built-in agents: `planner`, `implementer`, `test-verifier`, `ux-polisher`.
4. Add named permission tiers + a single permission guard.
5. Add structural validator + repair on any structural failure (not just chatty phrases).
6. Surface progress vs structured-result split in the UI by adding evidence/files-changed fields to the card.
7. Defer `skills`, `hooks`, `worktree isolation`, persistent memory, and project-level `.orbit/agents/*.md` to follow-up milestones — but design the types to support them today.
