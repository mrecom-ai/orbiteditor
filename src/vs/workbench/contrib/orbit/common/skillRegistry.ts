/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * In-memory registry of available skills.
 *
 * Skills come from three sources, merged by priority (later overrides earlier on name
 * collision):
 *   built-in  <  user (~/.orbit/skills)  <  project (.orbit/skills)
 *
 * The browser-side `skillLoader` discovers user/project skills from disk and calls
 * `setUserSkills` / `setProjectSkills`. The `enabled` flag of each skill is derived from
 * a separately-tracked disabled-name set (persisted in settings), so toggling a skill on
 * or off never requires re-reading files.
 *
 * This module is intentionally framework-free (no DI) so it can be imported from both
 * `common/prompt/prompts.ts` (system prompt assembly) and the React settings UI.
 */

import { SkillDefinition } from './orbitSkillTypes.js'

// ---------------------------------------------------------------------------------------
// Built-in skills — defined inline (mirrors BUILTIN_SUBAGENTS in subAgentRegistry.ts).
// Inline definitions avoid any runtime filesystem/resource-path dependency.
// ---------------------------------------------------------------------------------------

const CREATE_SKILL_BODY = `# Create a Skill

A skill is a reusable bundle of instructions packaged as a \`SKILL.md\` file. Orbit loads a
skill's body on demand (via the \`skill\` tool) when a task matches the skill's description.

## File layout

Each skill lives in its own folder containing a \`SKILL.md\` file:

- User-level (available everywhere): \`~/.orbit/skills/<name>/SKILL.md\`
- Project-level (this workspace only, overrides user): \`.orbit/skills/<name>/SKILL.md\`

## Frontmatter

Begin the file with a YAML-style frontmatter block:

\`\`\`
---
name: my-skill
description: Third-person summary of what the skill does and WHEN to use it. The model reads this to decide whether to load the skill.
---
\`\`\`

Fields:
- \`name\` (required): lowercase-hyphenated, max 64 chars, unique.
- \`description\` (required): third-person, max 1024 chars. Lead with the trigger ("Use when …").
- \`disableModelInvocation\` (optional): \`true\` to hide the skill from automatic loading (explicit use only).

## Writing a good skill

- Put the trigger conditions up front in the description — that is all the model sees until it loads the skill.
- Keep the body focused: concrete steps, checklists, commands, and conventions.
- Prefer imperative, scannable instructions over prose.
- Reference exact file paths, commands, and tools where relevant.

## After creating

The skill is picked up automatically. Toggle it on/off or delete it from
Orbit's Settings → Skills tab.`

const REVIEW_BODY = `# Review

Ask the user which review to run using the \`AskQuestion\` tool: one single-select
question, title "Which review?", two options — \`bugbot\` ("Bugbot — correctness/bug
review") and \`security\` ("Security Review — vulnerability audit"). If \`AskQuestion\`
is not available, ask in plain text instead and wait for the reply before continuing.

After the user picks, follow that skill's instructions exactly once:
- \`bugbot\` → follow \`review-bugbot\`.
- \`security\` → follow \`review-security\`.

Do not run both. Do not skip the question and guess.`

const REVIEW_BUGBOT_BODY = `# Review Bugbot

Use when the user runs \`/review-bugbot\`, asks to hunt for bugs/debug a diff, or
picks "Bugbot" from \`/review\`. Find correctness bugs only — no style, security, or
performance-only nitpicks (that's \`review-security\`'s job).

Follow every step below in order. Do not skip steps or reorder them.

## 1. Determine scope

- Default: **branch changes** — everything different from the repo's default branch
  (committed, staged, and unstaged), via the merge-base.
- If the user says "uncommitted" / "working tree" / "dirty" / "not committed yet" →
  **uncommitted changes** — diff against \`HEAD\` only.
- If the user names a specific PR link, PR number, or branch → check it out first
  (step 2), then treat it as branch changes against its own base.

## 2. Check out the target — only if a PR/branch was named

1. Resolve the link/number/name to a branch.
2. \`git branch --show-current\` — if already on it, skip to step 3.
3. Otherwise: \`gh pr checkout <number>\` for a PR, or \`git fetch origin <branch> &&
   git checkout <branch>\` for a named branch.
4. If checkout is blocked by local changes or conflicts, stop and tell the user the
   exact blocker, then ask whether to stash. **Never stash without an explicit yes.**
   Once confirmed, stash and retry the checkout once.

## 3. Compute the diff yourself with \`Shell\` — do not ask the sub-agent to do this

The sub-agent(s) you launch in step 5 have no shell access, so you must produce the
diff text before launching. Run these exactly:

\`\`\`bash
# find the default branch
BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=\${BASE:-main}
\`\`\`

For **branch changes**:
\`\`\`bash
RANGE="$(git merge-base HEAD "origin/$BASE")"
git diff "$RANGE" > /tmp/orbit_review_diff.txt
git diff --name-only "$RANGE" > /tmp/orbit_review_files.txt
\`\`\`

For **uncommitted changes**:
\`\`\`bash
RANGE="HEAD"
git diff HEAD > /tmp/orbit_review_diff.txt
git diff --name-only HEAD > /tmp/orbit_review_files.txt
git status --porcelain | awk '$1=="??"{print $2}' >> /tmp/orbit_review_files.txt
\`\`\`
For any file the \`??\` line lists (new/untracked), \`Read\` it and mention it as an
added file when you build the sub-agent prompt(s) below, since \`git diff\` alone
won't show untracked file contents.

If the command errors or \`/tmp/orbit_review_diff.txt\` ends up empty, retry once. If
it's still empty, tell the user in one sentence there's no diff to review and stop —
do not launch a sub-agent over nothing.

## 4. Decide: one sub-agent, or split into batches

Run \`wc -l < /tmp/orbit_review_diff.txt\`. A single \`explore\` sub-agent handed a huge
diff will burn its whole turn budget reading context files and fail before it
reports anything — that is the #1 cause of turn-limit failures on this skill, so
don't let it happen:

- **Under ~400 diff lines**: single sub-agent — step 5a.
- **400+ diff lines, or 10+ changed files**: split by file into batches of at most
  ~150 diff lines or 5 files each, whichever limit is hit first. For each batch,
  write its own diff slice:
  \`\`\`bash
  git diff "$RANGE" -- <files in this batch> > /tmp/orbit_review_diff_<N>.txt
  \`\`\`
  Then launch one sub-agent per batch — step 5b. Launch all of them in the same
  assistant message so they run concurrently; do not launch them one at a time.

## 5a. Single sub-agent (diff under ~400 lines)

Launch \`task\` with \`subagent_type: "explore"\` (read-only — it must not be able to
edit or run commands, only \`Read\`/\`Grep\`/\`Glob\` for context). Use this prompt shape,
filled in completely — the sub-agent has zero access to this conversation:

\`\`\`text
Full Repository Path: <absolute repo root>
Diff file: /tmp/orbit_review_diff.txt — Read this file first; it is the full diff to review.
New/untracked files (if any): <path list from step 3, or "none">
Custom Instructions: <only if the user gave specific review instructions, else omit this line>

Find CORRECTNESS BUGS in this diff — logical, behavioral, and edge-case defects only.
Do not report style, security, or pure-performance issues. For every changed line ask:
what could go wrong here, what does this assume, what happens on unexpected input.

Stay focused: judge the diff on its own first. Only Read a file outside the diff when
a specific line's correctness genuinely depends on code you can't see (e.g. the
definition of a function it calls) — cap that at roughly 8 extra file reads total.
Do not go explore the wider codebase; that is not your job and will exhaust your
turns before you produce a single finding.

Check for:
- Logic bugs: wrong conditions, inverted booleans, missing switch/if-else cases,
  off-by-one errors, incorrect operator precedence.
- Type coercion bugs: == vs ===, falsy checks that wrongly reject valid 0 / "" / false.
- State bugs: races, missing locks, stale closures, stale refs in hooks, missing
  effect/listener cleanup, impossible states left unguarded.
- Data flow bugs: unhandled null/undefined, wrong defaults, mutation of shared or
  immutable data, incorrect serialization/deserialization.
- Edge cases: empty collections, zero/negative values, very large input
  (overflow/timeout), unicode/encoding, timezone/locale/date boundaries.
- Integration bugs: API contract violations, unenforced ordering between async calls,
  incorrect error propagation.

Report each bug as one line: Severity | file:line | one-sentence finding.
Severity, most to least serious: Critical (crash/data loss/security-relevant),
High (wrong behavior a user would hit), Medium (a real but unlikely edge case),
Low (cosmetic or very unlikely). If you find nothing, say so explicitly.
\`\`\`

## 5b. Batched sub-agents (large diff)

Same prompt shape as 5a, once per batch, with \`Diff file\` pointing at that batch's
\`/tmp/orbit_review_diff_<N>.txt\` instead of the full diff, plus an added line
\`Files in this batch: <list>\`. Everything else — the bug categories, the "stay
focused" cap, the output format — is identical across batches.

## 6. If a sub-agent fails

- Wrong invocation (missing repo path, wrong subagent_type, bad prompt shape) →
  fix it and retry once immediately.
- Diff-read failure even though step 3 produced a non-empty file → retry once with
  the same file path.
- **Turn/step limit hit** (the failure mentions a turn, step, or iteration limit) →
  do **not** retry with the same scope; it will fail the same way again. Instead,
  split that sub-agent's diff slice in half by file and retry as two smaller
  batches (reapply step 4's batching logic to just this slice). If a half still
  hits the limit, report its files as "not reviewed — diff too large for one pass"
  instead of continuing to retry.
- Any other failure → retry once with the same prompt. If it fails again, stop and
  tell the user the short error — do not keep retrying.

## 7. Report results

- No bugs found across all batches → one line: "Bugbot found no bugs."
- Bugs found → merge every batch's findings into one compact markdown table with
  exactly these columns: \`Severity\`, \`Location\`, \`Finding\`. \`Location\` is
  \`file:line\`. De-duplicate any finding reported by more than one batch (can happen
  at batch boundaries). Sort rows Critical → High → Medium → Low; if a sub-agent
  returned them unsorted or with a missing severity, sort/fill that in yourself
  before printing — don't just relay a jumbled list. If any files were skipped per
  step 6, say so in one line after the table.
- Do not fix any finding or re-run the review unless the user explicitly asks next.`

const REVIEW_SECURITY_BODY = `# Review Security

Use when the user runs \`/review-security\`, asks for a security audit/vulnerability
check, or picks "Security Review" from \`/review\`. Find vulnerabilities only — no
style, correctness-only, or pure-performance issues (that's \`review-bugbot\`'s job).

Follow every step below in order. Do not skip steps or reorder them.

## 1. Determine scope

- Default: **branch changes** — everything different from the repo's default branch
  (committed, staged, and unstaged), via the merge-base.
- If the user says "uncommitted" / "working tree" / "dirty" / "not committed yet" →
  **uncommitted changes** — diff against \`HEAD\` only.
- If the user names a specific PR link, PR number, or branch → check it out first
  (step 2), then treat it as branch changes against its own base.

## 2. Check out the target — only if a PR/branch was named

1. Resolve the link/number/name to a branch.
2. \`git branch --show-current\` — if already on it, skip to step 3.
3. Otherwise: \`gh pr checkout <number>\` for a PR, or \`git fetch origin <branch> &&
   git checkout <branch>\` for a named branch.
4. If checkout is blocked by local changes or conflicts, stop and tell the user the
   exact blocker, then ask whether to stash. **Never stash without an explicit yes.**
   Once confirmed, stash and retry the checkout once.

## 3. Compute the diff yourself with \`Shell\` — do not ask the sub-agent to do this

The sub-agent(s) you launch in step 5 have no shell access, so you must produce the
diff text before launching. Run these exactly:

\`\`\`bash
# find the default branch
BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=\${BASE:-main}
\`\`\`

For **branch changes**:
\`\`\`bash
RANGE="$(git merge-base HEAD "origin/$BASE")"
git diff "$RANGE" > /tmp/orbit_review_diff.txt
git diff --name-only "$RANGE" > /tmp/orbit_review_files.txt
\`\`\`

For **uncommitted changes**:
\`\`\`bash
RANGE="HEAD"
git diff HEAD > /tmp/orbit_review_diff.txt
git diff --name-only HEAD > /tmp/orbit_review_files.txt
git status --porcelain | awk '$1=="??"{print $2}' >> /tmp/orbit_review_files.txt
\`\`\`
For any file the \`??\` line lists (new/untracked), \`Read\` it and mention it as an
added file when you build the sub-agent prompt(s) below, since \`git diff\` alone
won't show untracked file contents.

If the command errors or \`/tmp/orbit_review_diff.txt\` ends up empty, retry once. If
it's still empty, tell the user in one sentence there's no diff to review and stop —
do not launch a sub-agent over nothing.

## 4. Decide: one sub-agent, or split into batches

Run \`wc -l < /tmp/orbit_review_diff.txt\`. A single \`explore\` sub-agent handed a huge
diff will burn its whole turn budget reading context files and fail before it
reports anything — that is the #1 cause of turn-limit failures on this skill, so
don't let it happen:

- **Under ~400 diff lines**: single sub-agent — step 5a.
- **400+ diff lines, or 10+ changed files**: split by file into batches of at most
  ~150 diff lines or 5 files each, whichever limit is hit first. For each batch,
  write its own diff slice:
  \`\`\`bash
  git diff "$RANGE" -- <files in this batch> > /tmp/orbit_review_diff_<N>.txt
  \`\`\`
  Then launch one sub-agent per batch — step 5b. Launch all of them in the same
  assistant message so they run concurrently; do not launch them one at a time.

## 5a. Single sub-agent (diff under ~400 lines)

Launch \`task\` with \`subagent_type: "explore"\` (read-only — it must not be able to
edit or run commands, only \`Read\`/\`Grep\`/\`Glob\` for context). Use this prompt shape,
filled in completely — the sub-agent has zero access to this conversation:

\`\`\`text
Full Repository Path: <absolute repo root>
Diff file: /tmp/orbit_review_diff.txt — Read this file first; it is the full diff to review.
New/untracked files (if any): <path list from step 3, or "none">
Custom Instructions: <only if the user gave specific review instructions, else omit this line>

Find SECURITY VULNERABILITIES in this diff only — nothing else. Assume an external
attacker with network access to the running application.

Stay focused: judge the diff on its own first. Only Read a file outside the diff when
a specific line's safety genuinely depends on code you can't see (e.g. how a value
you're flagging is actually used downstream) — cap that at roughly 8 extra file reads
total. Do not go explore the wider codebase; that is not your job and will exhaust
your turns before you produce a single finding.

Check every subsection below that applies to the change:
- Injection: SQL/NoSQL, command injection via exec/spawn, XSS via unsanitized
  HTML/JSX, template injection, ReDoS from user-controlled regex.
- Auth: missing auth/authz checks, privilege escalation, weak or fixated sessions,
  JWT misconfig (none algorithm, weak secret, missing expiry), OAuth/OIDC misconfig
  (open redirect, missing state param).
- Data exposure: secrets in code/config/logs/client bundles, sensitive fields in API
  responses, debug endpoints or source maps left enabled in production, verbose
  error messages leaking stack traces or internal paths.
- CSRF / SSRF: state-changing GETs, missing CSRF tokens, permissive CORS with
  credentials, user-supplied URLs fetched server-side.
- Files & paths: path traversal, arbitrary file writes from user-controlled names,
  decompression bombs, symlink attacks, uploads with no type/size check.
- Cryptography: weak/deprecated algorithms (MD5, SHA1, DES, RC4), hardcoded keys/IVs,
  homegrown crypto, missing integrity checks, Math.random used where cryptographic
  randomness is required.
- Supply chain: known-vulnerable or unpinned dependencies, unsafe eval or dynamic
  require of user input.
- Availability: missing rate limiting on auth/login endpoints, unbounded per-request
  allocation, missing timeouts on external calls.

Report each finding as one line: Severity | file:line | one-sentence finding
(vulnerability + how it's reachable).
Severity, most to least serious: Critical (RCE, auth bypass, mass data exfiltration),
High (injection, significant data exposure), Medium (information disclosure, DoS,
CSRF), Low (defense-in-depth only). If you find nothing, say so explicitly.
\`\`\`

## 5b. Batched sub-agents (large diff)

Same prompt shape as 5a, once per batch, with \`Diff file\` pointing at that batch's
\`/tmp/orbit_review_diff_<N>.txt\` instead of the full diff, plus an added line
\`Files in this batch: <list>\`. Everything else — the vulnerability subsections, the
"stay focused" cap, the output format — is identical across batches.

## 6. If a sub-agent fails

- Wrong invocation (missing repo path, wrong subagent_type, bad prompt shape) →
  fix it and retry once immediately.
- Diff-read failure even though step 3 produced a non-empty file → retry once with
  the same file path.
- **Turn/step limit hit** (the failure mentions a turn, step, or iteration limit) →
  do **not** retry with the same scope; it will fail the same way again. Instead,
  split that sub-agent's diff slice in half by file and retry as two smaller
  batches (reapply step 4's batching logic to just this slice). If a half still
  hits the limit, report its files as "not reviewed — diff too large for one pass"
  instead of continuing to retry.
- Any other failure → retry once with the same prompt. If it fails again, stop and
  tell the user the short error — do not keep retrying.

## 7. Report results

- No issues found across all batches → one line: "Security review found no issues."
- Issues found → merge every batch's findings into one compact markdown table with
  exactly these columns: \`Severity\`, \`Location\`, \`Finding\`. \`Location\` is
  \`file:line\`. De-duplicate any finding reported by more than one batch (can happen
  at batch boundaries). Sort rows Critical → High → Medium → Low; if a sub-agent
  returned them unsorted or with a missing severity, sort/fill that in yourself
  before printing — don't just relay a jumbled list. If any files were skipped per
  step 6, say so in one line after the table.
- Do not fix any finding or re-run the review unless the user explicitly asks next.`

export const BUILTIN_SKILLS: SkillDefinition[] = [
	{
		name: 'create-skill',
		description: 'Guide for creating effective skills in Orbit Editor. Use when the user wants to create a new skill, write a SKILL.md file, or extend the agent with reusable domain knowledge.',
		source: 'built-in',
		filePath: '',
		body: CREATE_SKILL_BODY,
		enabled: true,
	},
	{
		name: 'review',
		description: 'Ask the user whether to run a Bugbot (correctness) or Security review, then dispatch to the matching skill. Use only when the user explicitly runs /review without saying which kind.',
		disableModelInvocation: true,
		source: 'built-in',
		filePath: '',
		body: REVIEW_BODY,
		enabled: true,
	},
	{
		name: 'review-bugbot',
		description: 'Review a diff (branch changes, uncommitted changes, or a named PR/branch) for correctness bugs via a read-only sub-agent, reporting a Severity/Location/Finding table. Use when the user asks to find bugs, debug, bug-hunt, or review code for correctness.',
		source: 'built-in',
		filePath: '',
		body: REVIEW_BUGBOT_BODY,
		enabled: true,
	},
	{
		name: 'review-security',
		description: 'Review a diff (branch changes, uncommitted changes, or a named PR/branch) for security vulnerabilities via a read-only sub-agent, reporting a Severity/Location/Finding table. Use when the user asks for a security review, security audit, or vulnerability check.',
		source: 'built-in',
		filePath: '',
		body: REVIEW_SECURITY_BODY,
		enabled: true,
	},
]

// ---------------------------------------------------------------------------------------
// Registry state
// ---------------------------------------------------------------------------------------

let _userSkills: SkillDefinition[] = []
let _projectSkills: SkillDefinition[] = []
let _disabledSkillNames: Set<string> = new Set()

const _onChangeListeners = new Set<() => void>()

/**
 * Memoized result of listSkills(). Invalidated on every registry mutation (_fireChange).
 * listSkills() is called several times per LLM turn during prompt assembly, so caching the
 * merged+sorted list avoids rebuilding a Map and re-sorting on each call.
 */
let _cachedList: SkillDefinition[] | null = null

const _fireChange = (): void => {
	_cachedList = null
	for (const listener of _onChangeListeners) {
		try { listener() } catch { /* never let one listener break others */ }
	}
}

/** Subscribe to registry changes (skills added/removed, or enabled-state toggled). */
export function onSkillsChanged(listener: () => void): () => void {
	_onChangeListeners.add(listener)
	return () => { _onChangeListeners.delete(listener) }
}

/** Replace the set of user-level (~/.orbit/skills) skills. */
export function setUserSkills(skills: SkillDefinition[]): void {
	_userSkills = skills
	_fireChange()
}

/** Replace the set of project-level (.orbit/skills) skills. */
export function setProjectSkills(skills: SkillDefinition[]): void {
	_projectSkills = skills
	_fireChange()
}

/** Update which skills are disabled (by name). Persisted by the caller in settings. */
export function setDisabledSkills(names: string[]): void {
	const next = new Set(names)
	// Avoid spurious change events when nothing actually changed.
	if (next.size === _disabledSkillNames.size && [...next].every(n => _disabledSkillNames.has(n))) return
	_disabledSkillNames = next
	_fireChange()
}

/**
 * Returns all skills merged by priority (project > user > built-in), with the `enabled`
 * flag computed from the current disabled-set. Sorted: built-in skills first, then enabled
 * skills before disabled, then alphabetically by name.
 *
 * Built-in skills are shown first so they appear at the top of the slash-menu Skills
 * section, ahead of any user-imported or project-level skills.
 */
export function listSkills(): SkillDefinition[] {
	if (_cachedList) return _cachedList

	const byName = new Map<string, SkillDefinition>()
	const add = (skill: SkillDefinition) => { byName.set(skill.name, skill) }

	for (const s of BUILTIN_SKILLS) add(s)
	for (const s of _userSkills) add(s)
	for (const s of _projectSkills) add(s)

	const merged = [...byName.values()].map(s => ({
		...s,
		enabled: !_disabledSkillNames.has(s.name),
	}))

	const sourceOrder: Record<string, number> = { 'built-in': 0, 'user': 1, 'project': 2 }

	merged.sort((a, b) => {
		const srcA = sourceOrder[a.source] ?? 3
		const srcB = sourceOrder[b.source] ?? 3
		if (srcA !== srcB) return srcA - srcB
		if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
		return a.name.localeCompare(b.name)
	})

	_cachedList = merged
	return merged
}

/** Look up a single skill by name (respecting priority merge + enabled computation). */
export function getSkill(name: string): SkillDefinition | undefined {
	return listSkills().find(s => s.name === name)
}
