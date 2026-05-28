/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ToolPolicy } from './sendLLMMessageTypes.js';
import type { ChatMessage } from './chatThreadServiceTypes.js';
import type { RawToolCallObj } from './sendLLMMessageTypes.js';

// ── Task Lifecycle Types (inspired by Claude Code Task.ts) ──────────────────

/**
 * The kind of task running in the subagent system.
 * Each type may carry type-specific state fields.
 */
export type SubAgentTaskType =
	| 'local_agent'      // Background subagent (explore, general, etc.)
	| 'local_shell'      // Future: background shell command
	| 'local_workflow'   // Future: multi-step workflow
	| 'monitor'          // Future: MCP monitor

/**
 * Canonical task status covering every lifecycle endpoint.
 * `killed` is the user-initiated force-stop; `canceled` comes from timeout or orchestrator.
 */
export type SubAgentTaskStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'timed_out'
	| 'canceled'
	| 'killed'

/**
 * Returns true when a task has reached a terminal state and cannot transition further.
 * Used to guard against injecting messages into dead sessions, evicting
 * finished tasks from state, and orphan-cleanup paths.
 */
export function isTerminalTaskStatus(status: SubAgentTaskStatus): boolean {
	return status === 'completed'
		|| status === 'failed'
		|| status === 'timed_out'
		|| status === 'canceled'
		|| status === 'killed'
}

// ── Subagent Modes & Reason Codes ───────────────────────────────────────────

export type SubAgentMode = 'subagent' | 'primary' | 'all'

export type SubAgentReasonCode =
	| 'feature_disabled'
	| 'unknown_agent'
	| 'invalid_agent_mode'
	| 'session_not_found'
	| 'stage_timed_out'
	| 'task_timed_out'
	| 'task_canceled'
	| 'task_failed'
	| 'task_completed'
	| 'task_killed'

export type SubAgentParentState =
	| 'idle'
	| 'subagents_running'
	| 'done'
	| 'fallback_parent'

export type SubAgentChildState =
	| 'queued'
	| 'running_llm'
	| 'running_tool'
	| 'summarizing'
	| 'completed'
	| 'failed'
	| 'timed_out'
	| 'canceled'
	| 'killed'

export type SubAgentTaskTemplate = string

// ── Progress Tracking (inspired by Claude Code ProgressTracker) ─────────────

/**
 * A single tool invocation recorded for progress tracking.
 */
export type SubAgentToolActivity = {
	toolName: string;
	/** Pre-computed activity description, e.g. "Reading src/foo.ts" */
	activityDescription?: string;
	/** True if this is a search operation (grep, glob, etc.) */
	isSearch?: boolean;
	/** True if this is a read operation (read_file, cat, etc.) */
	isRead?: boolean;
}

/**
 * Aggregated progress state for a running subagent.
 * Mirrors Claude Code's AgentProgress / ProgressTracker.
 */
export type SubAgentProgress = {
	/** Number of tool calls executed so far */
	toolUseCount: number;
	/**
	 * Token count for this task.
	 * Input tokens are kept as latest value (cumulative in API),
	 * output tokens are summed per-turn.
	 */
	latestInputTokens: number;
	cumulativeOutputTokens: number;
	/** Total combined token count */
	totalTokenCount: number;
	/** Most recent tool activities (capped at 5) */
	recentActivities: SubAgentToolActivity[];
	/** Last activity for quick display */
	lastActivity?: SubAgentToolActivity;
	/** Summary text (set by periodic summarization) */
	summary?: string;
}

/**
 * Create a fresh zero-state progress tracker.
 */
export function createSubAgentProgress(): SubAgentProgress {
	return {
		toolUseCount: 0,
		latestInputTokens: 0,
		cumulativeOutputTokens: 0,
		totalTokenCount: 0,
		recentActivities: [],
	}
}

// ── Evidence & Reports ──────────────────────────────────────────────────────

export type SubAgentEvidence = {
	path: string;
	rationale: string;
}

export type SubAgentChildReport = {
	childId: string;
	taskTemplate: SubAgentTaskTemplate;
	title: string;
	status: Extract<SubAgentChildState, 'completed' | 'failed' | 'timed_out' | 'canceled' | 'killed'>;
	rawResponse: string;
	summaryBullets: string[];
	evidence: SubAgentEvidence[];
	openQuestions: string[];
	confidence: number;
	tokenUsageEstimate?: number;
	error?: string;
	durationMs: number;
	// ── Production-readiness extensions (all optional for back-compat). ─────
	/** One-sentence answer to the original objective. Surfaces in UI subtitle. */
	oneLineSummary?: string;
	/** Files the sub-agent inspected (derived from evidence + tool history). */
	filesInspected?: string[];
	/** Files the sub-agent changed (must be empty for read_only/safe_read agents). */
	filesChanged?: string[];
	/** Commands the sub-agent ran (only meaningful for terminal_safe+). */
	commandsRun?: string[];
	/** Risks/uncertainties the sub-agent flagged. */
	risks?: string[];
	/** Hard blockers the sub-agent encountered. */
	blockers?: string[];
	/** Recommended next actions the parent should consider. */
	recommendations?: string[];
	/** Tool calls that were rejected by the policy guard. */
	blockedActions?: BlockedToolCall[];
	/** True when the validator triggered a repair pass. */
	wasRepaired?: boolean;
	/** Validator-supplied confidence band, derived from `confidence` if missing. */
	confidenceBand?: 'low' | 'medium' | 'high';
}

// ── Agent Definition ────────────────────────────────────────────────────────

/**
 * Named permission tiers for sub-agents. The orchestrator resolves each tier
 * to a concrete ToolPolicy + extra runtime guards (terminal/path safety).
 */
export type AgentPermissionMode =
	| 'read_only'         // search + read only; no MCP mutations; no terminal
	| 'safe_write'        // read + edit + create file; no terminal; no destructive ops
	| 'terminal_safe'     // safe_write + run_command (denylist enforced)
	| 'full_with_approval' // any tool but every effectful call must be approved

/**
 * How the parent context flows into the sub-agent. Future-extension: the
 * builder is not yet implemented; defaults to 'minimal' meaning only the
 * task prompt and agent system contract reach the sub-agent.
 */
export type AgentContextPolicy =
	| 'minimal'
	| 'research'
	| 'implementation'
	| 'review'
	| 'verification'

/**
 * Per-agent output contract. Drives the structural validator: a contract
 * field set to true means the report MUST contain that section; failing
 * fields are repair-eligible.
 */
export type AgentOutputContract = {
	requireFindings?: boolean;
	requireEvidence?: boolean;
	requireFilesInspected?: boolean;
	forbidFilesChanged?: boolean;
	requireOneLineSummary?: boolean;
	requireConfidence?: boolean;
	requireRisks?: boolean;
	requireRecommendations?: boolean;
	requireCommandsRun?: boolean;
	requireFilesChanged?: boolean;
}

export type SubAgentDefinition = {
	name: string;
	mode: SubAgentMode;
	description: string;
	prompt: string;
	permission: ToolPolicy;
	model?: {
		providerID: string;
		modelID: string;
	};
	temperature?: number;
	topP?: number;
	steps?: number;
	hidden?: boolean;
	color?: string;
	native?: boolean;

	// ── New (production-readiness) fields. All optional for back-compat. ────
	/** Short sentence telling the parent agent when to delegate to this agent. */
	whenToUse?: string;
	/** Named permission tier. Source of truth for runtime guards in M3+. */
	permissionMode?: AgentPermissionMode;
	/** Allowed built-in tools (mirrors permission.allowedBuiltinTools but kept on the definition for clarity). */
	allowedTools?: string[];
	/** Disallowed built-in tools (deny-first). */
	disallowedTools?: string[];
	/** Context-policy hint for future context-builder work. */
	contextPolicy?: AgentContextPolicy;
	/** Validation contract for the result. */
	outputContract?: AgentOutputContract;
	canRunInParallel?: boolean;
	maxRuntimeMs?: number;
	maxToolCalls?: number;
	maxContextTokens?: number;
	riskLevel?: 'low' | 'medium' | 'high';
	enabled?: boolean;
}

// ── Tool Params ─────────────────────────────────────────────────────────────

export type SubAgentTaskToolParams = {
	subagent_type: string;
	description: string;
	prompt: string;
	/** Recommended for visible agents: one-sentence outcome the parent expects. */
	objective?: string | null;
	/** Recommended for visible agents: short description of the desired report shape. */
	expected_output?: string | null;
	/** Optional list (newline-separated) of acceptance criteria. */
	acceptance_criteria?: string | null;
	/** Optional file/area scope hint. */
	scope?: string | null;
	task_id?: string | null;
	command?: string | null;
}

// ── Blocked Action / Audit ──────────────────────────────────────────────────

export type BlockedToolCall = {
	toolName: string;
	reason:
		| 'tier'
		| 'terminal_unsafe'
		| 'path_unsafe'
		| 'budget'
		| 'mcp_mutation'
		| 'delegation'
		| 'unknown_tool';
	detail: string;
	ts: number;
}

// ── View Models ─────────────────────────────────────────────────────────────

export type SubAgentChildViewModel = {
	childId: string;
	taskId?: string;
	sessionId?: string;
	title: string;
	taskTemplate: SubAgentTaskTemplate;
	state: SubAgentChildState;
	activityText: string;
	activityLog?: string[];
	activeToolCall?: RawToolCallObj;
	summaryBullets: string[];
	error?: string;
	/** Progress tracking — token counts, tool usage, recent activities */
	progress?: SubAgentProgress;
	startedAt?: number;
	updatedAt?: number;
	// ── M6 view fields (populated when the run terminates) ──────────────────
	oneLineSummary?: string;
	filesInspected?: string[];
	filesChanged?: string[];
	risks?: string[];
	recommendations?: string[];
	confidenceBand?: 'low' | 'medium' | 'high';
	wasRepaired?: boolean;
	blockedActionsCount?: number;
	statusKind?: 'success' | 'partial' | 'failed';
}

export type SubAgentStageViewModel = {
	stageId: string;
	threadId: string;
	turnSequence: number;
	parentState: SubAgentParentState;
	reasonCode?: SubAgentReasonCode;
	sessionId: string;
	agentName: string;
	children: SubAgentChildViewModel[];
	startedAt: number;
	updatedAt: number;
}

// ── Task Tool Result ────────────────────────────────────────────────────────

export type SubAgentTaskToolResult = {
	title: string;
	metadata: {
		taskId: string;
		sessionId: string;
		agent: string;
		status: SubAgentChildReport['status'];
		model: {
			modelID: string;
			providerID: string;
		};
	};
	fullText: string;
	report: SubAgentChildReport;
	stage: SubAgentStageViewModel;
}

// ── Task Record (enhanced with Claude Code patterns) ────────────────────────

/**
 * Base fields shared across all task types.
 * Mirrors Claude Code's TaskStateBase pattern.
 */
export type SubAgentTaskRecordBase = {
	taskId: string;
	threadId: string;
	sessionId: string | null;
	agentName: string;
	taskTemplate: SubAgentTaskTemplate;
	title: string;
	description: string;
	prompt: string;
	command: string | null;
	status: SubAgentTaskStatus;
	createdAt: number;
	updatedAt: number;
	startedAt: number | null;
	completedAt: number | null;
	turnSequence: number;
	latestStage?: SubAgentStageViewModel;
	report?: SubAgentChildReport;
	fullText?: string;
	error?: string;
}

/**
 * Extended fields for background-capable tasks.
 * Inspired by Claude Code's LocalAgentTaskState.
 */
export type SubAgentBackgroundFields = {
	/**
	 * Whether the task is backgrounded (true) or running in foreground (false).
	 * Tasks start as foreground and may be backgrounded after a configurable timeout
	 * or manual user action.
	 */
	isBackgrounded: boolean;

	/**
	 * Messages queued mid-turn for inter-task communication.
	 * Drained at tool-round boundaries by the orchestrator.
	 */
	pendingMessages: string[];

	/**
	 * Whether the UI is holding this task (blocks eviction, enables stream-append).
	 * Set by the view layer. Separate from "what I'm looking at" — retain is
	 * "what I'm holding."
	 */
	retained: boolean;

	/**
	 * Whether task output has been bootstrapped from disk.
	 * One-shot per retain cycle; after this, stream appends new data.
	 */
	diskLoaded: boolean;

	/**
	 * Visibility deadline for the panel. undefined = no deadline (running or retained);
	 * timestamp = hide + GC-eligible after this time. Set at terminal transition,
	 * cleared on retain.
	 */
	evictAfter?: number;

	/**
	 * Whether this task's completion has been notified to the parent.
	 * Prevents duplicate notification delivery.
	 */
	notified: boolean;

	/**
	 * Aggregated progress for running tasks.
	 */
	progress?: SubAgentProgress;
}

/**
 * Full task record – backward-compatible superset of the old SubAgentTaskRecord.
 * Adds background lifecycle, progress tracking, and eviction fields.
 */
export type SubAgentTaskRecord = SubAgentTaskRecordBase & Partial<SubAgentBackgroundFields>

// ── Background Task Utilities (inspired by Claude Code tasks/types.ts) ──────

/**
 * Check if a task should be considered a background task.
 * A task is "background" when it is actively running and has been explicitly backgrounded.
 */
export function isBackgroundTask(task: SubAgentTaskRecord): boolean {
	if (task.status !== 'running' && task.status !== 'pending') {
		return false
	}
	// Foreground tasks (isBackgrounded === false) are NOT background tasks
	if (task.isBackgrounded === false) {
		return false
	}
	return true
}

// ── Task Lifecycle Utilities (inspired by Claude Code framework.ts) ─────────

/** Duration to display killed/stopped tasks before eviction (ms) */
export const STOPPED_DISPLAY_MS = 3_000

/** Grace period for terminal tasks in the panel (ms) */
export const PANEL_GRACE_MS = 30_000

/**
 * Apply default background fields for a newly registered task.
 * Called when a task is first created — avoids having to specify all fields inline.
 */
export function applyBackgroundDefaults(
	task: SubAgentTaskRecord,
	opts?: { isBackgrounded?: boolean }
): SubAgentTaskRecord {
	return {
		...task,
		isBackgrounded: opts?.isBackgrounded ?? true,
		pendingMessages: task.pendingMessages ?? [],
		retained: task.retained ?? false,
		diskLoaded: task.diskLoaded ?? false,
		notified: task.notified ?? false,
	}
}

/**
 * Transition a task to a terminal status.
 * Handles setting endTime, evictAfter, and clearing runtime fields.
 */
export function transitionToTerminal(
	task: SubAgentTaskRecord,
	terminalStatus: Extract<SubAgentTaskStatus, 'completed' | 'failed' | 'timed_out' | 'canceled' | 'killed'>,
	error?: string,
): SubAgentTaskRecord {
	const now = Date.now()
	return {
		...task,
		status: terminalStatus,
		completedAt: now,
		updatedAt: now,
		error: error ?? task.error,
		evictAfter: task.retained ? undefined : now + PANEL_GRACE_MS,
	}
}

/**
 * Queue a message for mid-turn delivery to a running task.
 */
export function queuePendingMessage(task: SubAgentTaskRecord, message: string): SubAgentTaskRecord {
	return {
		...task,
		pendingMessages: [...(task.pendingMessages ?? []), message],
	}
}

/**
 * Drain all pending messages from a task, returning them and clearing the queue.
 */
export function drainPendingMessages(task: SubAgentTaskRecord): { drained: string[]; task: SubAgentTaskRecord } {
	const drained = task.pendingMessages ?? []
	if (drained.length === 0) return { drained: [], task }
	return {
		drained,
		task: { ...task, pendingMessages: [] },
	}
}

/**
 * Mark a task as backgrounded.
 * Returns the updated task or the original if already backgrounded.
 */
export function backgroundTask(task: SubAgentTaskRecord): SubAgentTaskRecord {
	if (task.isBackgrounded === true) return task
	return { ...task, isBackgrounded: true }
}

/**
 * Bring a backgrounded task back to the foreground.
 */
export function foregroundTask(task: SubAgentTaskRecord): SubAgentTaskRecord {
	if (task.isBackgrounded === false) return task
	return { ...task, isBackgrounded: false }
}

/**
 * Set the retain flag on a task — blocks eviction and enables stream-append.
 */
export function retainTask(task: SubAgentTaskRecord): SubAgentTaskRecord {
	return { ...task, retained: true, evictAfter: undefined }
}

/**
 * Release the retain flag. If the task is terminal, set evictAfter.
 */
export function releaseTask(task: SubAgentTaskRecord): SubAgentTaskRecord {
	const isTerminal = isTerminalTaskStatus(task.status)
	return {
		...task,
		retained: false,
		evictAfter: isTerminal ? Date.now() + PANEL_GRACE_MS : undefined,
	}
}

/**
 * Check if a terminal task is eligible for eviction from state.
 */
export function isEvictable(task: SubAgentTaskRecord): boolean {
	if (!isTerminalTaskStatus(task.status)) return false
	if (task.notified === false) return false
	if (task.retained) return false
	if (task.evictAfter !== undefined && task.evictAfter > Date.now()) return false
	return true
}

/**
 * Mark a task as notified. Returns the task unchanged if already notified.
 * Uses atomic check-and-set pattern to prevent duplicate notifications.
 */
export function markNotified(task: SubAgentTaskRecord): { task: SubAgentTaskRecord; wasAlreadyNotified: boolean } {
	if (task.notified) {
		return { task, wasAlreadyNotified: true }
	}
	return {
		task: { ...task, notified: true },
		wasAlreadyNotified: false,
	}
}

// ── Session Snapshot ────────────────────────────────────────────────────────

export type SubAgentSessionSnapshot = {
	sessionId: string;
	taskId: string;
	threadId: string;
	agentName: string;
	taskTemplate: SubAgentTaskTemplate;
	title: string;
	history: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}

// ── Store State ─────────────────────────────────────────────────────────────

export type SubAgentTaskStoreState = {
	version: 1;
	tasksById: Record<string, SubAgentTaskRecord>;
	taskIdsByThread: Record<string, string[]>;
	sessionsById: Record<string, SubAgentSessionSnapshot>;
}
