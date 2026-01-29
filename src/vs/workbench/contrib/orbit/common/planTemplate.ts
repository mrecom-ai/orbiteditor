/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Plan Template Infrastructure
 *
 * This module provides utilities for creating and manipulating implementation plan files
 * stored as Markdown with YAML frontmatter in .void/plans/
 */

import { PlanTodoItem as TodoItem } from './toolsServiceTypes.js';
import { generateUuid } from '../../../../base/common/uuid.js';

// Re-export TodoItem for convenience
export { TodoItem };

// Plan status types
export type PlanStatus = 'planning' | 'approved' | 'in-progress' | 'completed';

// Plan metadata stored in YAML frontmatter
export interface PlanMetadata {
	title: string;
	created: string;
	updated: string;
	status: PlanStatus;
	model?: string;
}

// Valid section names in a plan file
export type PlanSection = 'overview' | 'files' | 'steps' | 'checklist' | 'testing' | 'notes';

// Section markers in the Markdown file
export const PLAN_SECTION_MARKERS: Record<PlanSection, string> = {
	overview: '## Overview',
	files: '## Files to Modify',
	steps: '## Implementation Steps',
	checklist: '## Implementation Checklist',
	testing: '## Testing Strategy',
	notes: '## Notes & Considerations',
};

// Order of sections in the plan file
const SECTION_ORDER: PlanSection[] = ['overview', 'files', 'steps', 'checklist', 'testing', 'notes'];

/**
 * Validation result interface
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Options for creating a new plan file (legacy)
 */
export interface CreatePlanOptions {
	planName: string;
	overview: string;
	initialFiles?: string[];
	metadata: PlanMetadata;
}

/**
 * Options for creating an atomic plan file (Cursor AI style)
 */
export interface CreateAtomicPlanOptions {
	name: string;
	overview: string;
	plan: string;
	todos: TodoItem[];
	metadata: PlanMetadata;
}

/**
 * Parsed plan file structure
 */
export interface ParsedPlan {
	metadata: PlanMetadata;
	sections: Record<PlanSection, string>;
	rawContent: string;
}

/**
 * Creates the content for a new plan file
 */
export function createPlanContent(opts: CreatePlanOptions): string {
	const { planName, overview, initialFiles, metadata } = opts;

	const filesSection = initialFiles && initialFiles.length > 0
		? initialFiles.map(f => `- \`${f}\``).join('\n')
		: '_Files to be identified during planning..._';

	return `---
title: ${escapeYamlString(planName)}
created: ${metadata.created}
updated: ${metadata.updated}
status: ${metadata.status}
${metadata.model ? `model: ${metadata.model}` : ''}
---

# Implementation Plan: ${planName}

## Overview

${overview}

## Files to Modify

${filesSection}

## Implementation Steps

_Steps to be defined..._

## Implementation Checklist

- [ ] Initial planning complete

## Testing Strategy

_Testing approach to be defined..._

## Notes & Considerations

_Additional context and considerations..._
`;
}

/**
 * Escapes a string for safe YAML inclusion
 */
function escapeYamlString(str: string): string {
	// If the string contains special characters, wrap in quotes
	if (/[:\{\}\[\],&*#?|\-<>=!%@`]/.test(str) || str.includes('\n')) {
		return `"${str.replace(/"/g, '\\"')}"`;
	}
	return str;
}

/**
 * Parses a plan file and extracts metadata and sections
 */
export function parsePlanFile(content: string): ParsedPlan {
	const metadata = parseYamlFrontmatter(content);
	const sections = parseSections(content);

	return {
		metadata,
		sections,
		rawContent: content,
	};
}

/**
 * Parses YAML frontmatter from the plan content
 */
function parseYamlFrontmatter(content: string): PlanMetadata {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return {
			title: 'Untitled Plan',
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			status: 'planning',
		};
	}

	const frontmatter = frontmatterMatch[1];
	const metadata: PlanMetadata = {
		title: 'Untitled Plan',
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		status: 'planning',
	};

	// Parse each line of YAML
	const lines = frontmatter.split('\n');
	for (const line of lines) {
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;

		const key = line.substring(0, colonIndex).trim();
		let value = line.substring(colonIndex + 1).trim();

		// Remove quotes if present
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		switch (key) {
			case 'title':
				metadata.title = value;
				break;
			case 'created':
				metadata.created = value;
				break;
			case 'updated':
				metadata.updated = value;
				break;
			case 'status':
				if (['planning', 'approved', 'in-progress', 'completed'].includes(value)) {
					metadata.status = value as PlanStatus;
				}
				break;
			case 'model':
				metadata.model = value;
				break;
		}
	}

	return metadata;
}

/**
 * Parses sections from the plan content
 */
function parseSections(content: string): Record<PlanSection, string> {
	const sections: Record<PlanSection, string> = {
		overview: '',
		files: '',
		steps: '',
		checklist: '',
		testing: '',
		notes: '',
	};

	// Remove frontmatter for section parsing
	const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

	for (const sectionName of SECTION_ORDER) {
		const marker = PLAN_SECTION_MARKERS[sectionName];
		const markerIndex = contentWithoutFrontmatter.indexOf(marker);

		if (markerIndex === -1) continue;

		// Find the start of section content (after the marker line)
		const contentStart = contentWithoutFrontmatter.indexOf('\n', markerIndex) + 1;
		if (contentStart === 0) continue;

		// Find the end of section (next section marker or end of file)
		let contentEnd = contentWithoutFrontmatter.length;
		for (const nextSectionName of SECTION_ORDER) {
			if (nextSectionName === sectionName) continue;
			const nextMarker = PLAN_SECTION_MARKERS[nextSectionName];
			const nextMarkerIndex = contentWithoutFrontmatter.indexOf(nextMarker, contentStart);
			if (nextMarkerIndex !== -1 && nextMarkerIndex < contentEnd) {
				contentEnd = nextMarkerIndex;
			}
		}

		sections[sectionName] = contentWithoutFrontmatter.substring(contentStart, contentEnd).trim();
	}

	return sections;
}

/**
 * Updates a specific section in the plan content
 */
export function updatePlanSection(currentContent: string, sectionName: PlanSection, newContent: string): string {
	const marker = PLAN_SECTION_MARKERS[sectionName];
	const markerIndex = currentContent.indexOf(marker);

	if (markerIndex === -1) {
		// Section doesn't exist, append it at the end
		return currentContent.trimEnd() + `\n\n${marker}\n${newContent}\n`;
	}

	// Find the content boundaries
	const contentStart = currentContent.indexOf('\n', markerIndex) + 1;
	if (contentStart === 0) {
		return currentContent; // Malformed, return as-is
	}

	// Find the end of the section (next section marker or end of file)
	let contentEnd = currentContent.length;
	for (const nextSectionName of SECTION_ORDER) {
		if (nextSectionName === sectionName) continue;
		const nextMarker = PLAN_SECTION_MARKERS[nextSectionName];
		const nextMarkerIndex = currentContent.indexOf(nextMarker, contentStart);
		if (nextMarkerIndex !== -1 && nextMarkerIndex < contentEnd) {
			contentEnd = nextMarkerIndex;
		}
	}

	// Update the updated timestamp in frontmatter
	const updatedContent = updateFrontmatterTimestamp(currentContent);

	// Replace the section content
	return updatedContent.substring(0, contentStart) + newContent + '\n\n' + updatedContent.substring(contentEnd);
}

/**
 * Updates the 'updated' timestamp in the frontmatter
 */
function updateFrontmatterTimestamp(content: string): string {
	const newTimestamp = new Date().toISOString();
	return content.replace(
		/^(---\n[\s\S]*?)updated:\s*[^\n]*(\n[\s\S]*?---)/,
		`$1updated: ${newTimestamp}$2`
	);
}

/**
 * Detects if checklist uses numbered format (1. [STATUS]) or checkbox format (- [ ])
 */
function detectChecklistFormat(checklistContent: string): 'numbered' | 'checkbox' {
	const numberedRegex = /^\d+\.\s+\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]/m;
	const checkboxRegex = /^- \[[\sxX]\]/m;

	if (numberedRegex.test(checklistContent)) return 'numbered';
	if (checkboxRegex.test(checklistContent)) return 'checkbox';

	// Default to numbered for new checklists
	return 'numbered';
}

/**
 * Adds a TODO item to the plan's checklist section
 * Supports both checkbox and numbered formats
 */
export function addTodoToChecklist(currentContent: string, todoText: string, category?: string): { content: string; todoCount: number } {
	const marker = PLAN_SECTION_MARKERS.checklist;
	const markerIndex = currentContent.indexOf(marker);

	if (markerIndex === -1) {
		// No checklist section, create one with numbered format
		const newChecklist = `\n\n${marker}\n1. [PENDING] ${todoText}\n`;
		return {
			content: updateFrontmatterTimestamp(currentContent.trimEnd() + newChecklist),
			todoCount: 1,
		};
	}

	// Find the content boundaries for checklist section
	const contentStart = currentContent.indexOf('\n', markerIndex) + 1;
	let contentEnd = currentContent.length;
	for (const nextSectionName of SECTION_ORDER) {
		if (nextSectionName === 'checklist') continue;
		const nextMarker = PLAN_SECTION_MARKERS[nextSectionName];
		const nextMarkerIndex = currentContent.indexOf(nextMarker, contentStart);
		if (nextMarkerIndex !== -1 && nextMarkerIndex < contentEnd) {
			contentEnd = nextMarkerIndex;
		}
	}

	// Get current checklist content
	const checklistContent = currentContent.substring(contentStart, contentEnd).trim();

	// Detect format
	const format = detectChecklistFormat(checklistContent);

	let existingTodos = 0;
	let newTodo = '';

	if (format === 'numbered') {
		// Count existing numbered todos
		const numberedMatches = checklistContent.match(/^\d+\.\s+\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]/gm);
		existingTodos = numberedMatches ? numberedMatches.length : 0;
		newTodo = `${existingTodos + 1}. [PENDING] ${todoText}`;
	} else {
		// Count existing checkbox todos
		const checkboxMatches = checklistContent.match(/^- \[[\sxX]\]/gm);
		existingTodos = checkboxMatches ? checkboxMatches.length : 0;
		newTodo = `- [ ] ${todoText}`;
	}

	// Add category header if provided and not already present
	if (category) {
		const categoryHeader = `### ${category}`;
		if (!checklistContent.includes(categoryHeader)) {
			newTodo = `\n${categoryHeader}\n${newTodo}`;
		}
	}

	// Append the new todo
	const newChecklistContent = checklistContent + '\n' + newTodo;

	// Update the content
	const updatedContent = updateFrontmatterTimestamp(currentContent);
	return {
		content: updatedContent.substring(0, contentStart) + newChecklistContent + '\n\n' + updatedContent.substring(contentEnd),
		todoCount: existingTodos + 1,
	};
}

/**
 * Marks a TODO item as complete in the checklist section
 * @param currentContent The current plan file content
 * @param itemIndex 1-based index of the item to mark complete
 */
export function markTodoComplete(currentContent: string, itemIndex: number): { content: string; completedItem: string } {
	const marker = PLAN_SECTION_MARKERS.checklist;
	const markerIndex = currentContent.indexOf(marker);

	if (markerIndex === -1) {
		throw new Error('No checklist section found in plan');
	}

	const lines = currentContent.split('\n');

	// Detect format by checking lines
	const checkboxRegex = /^- \[\s\] (.*)$/;
	const numberedRegex = /^(\d+)\.\s+\[(PENDING|IN_PROGRESS)\]\s+(.+)$/;

	let uncheckedIndex = 0;
	let targetLineIndex = -1;
	let completedItem = '';
	let isNumberedFormat = false;

	// Find target line and detect format
	for (let i = 0; i < lines.length; i++) {
		const checkboxMatch = lines[i].match(checkboxRegex);
		const numberedMatch = lines[i].match(numberedRegex);

		if (checkboxMatch) {
			uncheckedIndex++;
			if (uncheckedIndex === itemIndex) {
				targetLineIndex = i;
				completedItem = checkboxMatch[1];
				isNumberedFormat = false;
				break;
			}
		} else if (numberedMatch) {
			uncheckedIndex++;
			if (uncheckedIndex === itemIndex) {
				targetLineIndex = i;
				completedItem = numberedMatch[3];
				isNumberedFormat = true;
				break;
			}
		}
	}

	if (targetLineIndex === -1) {
		throw new Error(`TODO item #${itemIndex} not found. There are ${uncheckedIndex} unchecked items.`);
	}

	// Mark the item as complete based on format
	if (isNumberedFormat) {
		lines[targetLineIndex] = lines[targetLineIndex].replace(
			/^(\d+)\.\s+\[(PENDING|IN_PROGRESS)\]\s+/,
			'$1. [✓] '
		);
	} else {
		lines[targetLineIndex] = lines[targetLineIndex].replace(/^- \[\s\] /, '- [x] ');
	}

	const updatedContent = updateFrontmatterTimestamp(lines.join('\n'));
	return {
		content: updatedContent,
		completedItem,
	};
}

/**
 * Updates the plan status in the frontmatter
 */
export function updatePlanStatus(currentContent: string, newStatus: PlanStatus): string {
	const updatedContent = currentContent.replace(
		/^(---\n[\s\S]*?)status:\s*[^\n]*(\n[\s\S]*?---)/,
		`$1status: ${newStatus}$2`
	);
	return updateFrontmatterTimestamp(updatedContent);
}

/**
 * Generates a slug from a plan name for use in filenames
 */
export function generatePlanSlug(planName: string): string {
	return planName
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.substring(0, 50)
		.replace(/^-|-$/g, '');
}

/**
 * Generates a plan filename with timestamp and slug
 * Format: YYYY-MM-DD-HHMMSS-slug.md
 */
export function generatePlanFileName(planName?: string): string {
	const now = new Date();
	const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
	const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS

	const slug = planName ? generatePlanSlug(planName) : 'plan';
	return `${dateStr}-${timeStr}-${slug}.md`;
}

/**
 * Validates that a section name is valid
 */
export function isValidSectionName(name: string): name is PlanSection {
	return ['overview', 'files', 'steps', 'checklist', 'testing', 'notes'].includes(name);
}

/**
 * Gets the display name for a section
 */
export function getSectionDisplayName(section: PlanSection): string {
	const displayNames: Record<PlanSection, string> = {
		overview: 'Overview',
		files: 'Files to Modify',
		steps: 'Implementation Steps',
		checklist: 'Implementation Checklist',
		testing: 'Testing Strategy',
		notes: 'Notes & Considerations',
	};
	return displayNames[section];
}

/**
 * Calculates the appropriate plan status based on todo completion
 * @param content The plan file content
 * @returns The calculated status: planning, in-progress, or completed
 */
export function calculatePlanStatus(content: string): PlanStatus {
	const { total, completed } = countTodoItems(content);

	// No todos yet - still in planning phase
	if (total === 0) return 'planning';

	// All todos completed
	if (completed === total) return 'completed';

	// Some todos done or in progress - actively working
	if (completed > 0) return 'in-progress';

	// Has todos but none started - could be planning or in-progress
	// If it was already approved/in-progress, keep that status
	const currentMetadata = parseYamlFrontmatter(content);
	if (currentMetadata.status === 'in-progress' || currentMetadata.status === 'approved') {
		return currentMetadata.status;
	}

	return 'planning';
}

/**
 * Synchronizes plan status based on todo completion
 * Auto-updates status if it should change based on progress
 * @param content The current plan file content
 * @returns Updated content with synced status, or original if no change needed
 */
export function syncPlanStatus(content: string): string {
	const currentMetadata = parseYamlFrontmatter(content);
	const calculatedStatus = calculatePlanStatus(content);

	// No change needed
	if (currentMetadata.status === calculatedStatus) {
		return content;
	}

	// Update status to match current progress
	return updatePlanStatus(content, calculatedStatus);
}

/**
 * Counts the total and completed TODO items in the checklist
 * Supports both checkbox format (- [ ]) and numbered format (1. [PENDING])
 */
export function countTodoItems(content: string): { total: number; completed: number; pending: number } {
	// Checkbox format - Case-insensitive matching for [x] or [X]
	const checkboxCompleted = /^- \[[xX]\]/gm;
	// Match any single whitespace character for unchecked
	const checkboxPending = /^- \[\s\]/gm;

	// Numbered format - Match completed/cancelled todos
	const numberedCompleted = /^\d+\.\s+\[(?:✓|CANCELLED)\]/gm;
	// Match pending/in-progress todos
	const numberedPending = /^\d+\.\s+\[(?:PENDING|IN_PROGRESS)\]/gm;

	// Combine matches from both formats
	const completedMatches = [
		...(content.match(checkboxCompleted) || []),
		...(content.match(numberedCompleted) || [])
	];

	const pendingMatches = [
		...(content.match(checkboxPending) || []),
		...(content.match(numberedPending) || [])
	];

	return {
		total: completedMatches.length + pendingMatches.length,
		completed: completedMatches.length,
		pending: pendingMatches.length,
	};
}

// ========================================
// Atomic Plan Creation (Cursor AI Style)
// ========================================

/**
 * Validates todo ID format (lowercase, hyphens, alphanumeric only)
 */
export function validateTodoId(id: string): boolean {
	return /^[a-z0-9-]+$/.test(id);
}

/**
 * Validates plan content according to Cursor AI rules
 */
export function validatePlanContent(content: string): ValidationResult {
	const lines = content.split('\n');
	const firstLine = lines[0].trim();

	// Rule 1: First line must be # heading
	if (!firstLine.startsWith('# ')) {
		return {
			valid: false,
			error: 'Plan must start with level 1 heading (# Title)',
		};
	}

	// Rule 2: No markdown tables
	const hasTable = content.includes('|---') || content.includes('| ---');
	if (hasTable) {
		return {
			valid: false,
			error: 'Markdown tables not allowed. Use bullet lists instead.',
		};
	}

	return { valid: true };
}

/**
 * Validates todos array structure and IDs
 */
export function validateTodos(todos: TodoItem[]): ValidationResult {
	// Check unique IDs
	const ids = todos.map(t => t.id);
	const uniqueIds = new Set(ids);
	if (uniqueIds.size !== ids.length) {
		return {
			valid: false,
			error: 'Todo IDs must be unique',
		};
	}

	// Check ID format (lowercase, hyphens, alphanumeric)
	for (const todo of todos) {
		if (!validateTodoId(todo.id)) {
			return {
				valid: false,
				error: `Invalid todo ID "${todo.id}". Use lowercase, hyphens, and alphanumeric only.`,
			};
		}
	}

	// Check content not empty
	for (const todo of todos) {
		if (!todo.content?.trim()) {
			return {
				valid: false,
				error: `Todo "${todo.id}" has empty content`,
			};
		}
	}

	return { valid: true };
}

/**
 * Converts todos array to markdown checklist with ID comments (legacy format)
 */
export function todosToMarkdown(todos: TodoItem[]): string {
	if (todos.length === 0) {
		return '';
	}
	return todos.map(todo =>
		`- [ ] ${todo.content} <!-- id:${todo.id} -->`
	).join('\n');
}

/**
 * Converts todos with status to numbered markdown format
 * Format: 1. [STATUS] Content <!-- id:xxx -->
 * Includes ID comments for persistence across sync cycles
 */
export function todosToNumberedMarkdown(todos: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }[]): string {
	if (todos.length === 0) {
		return '';
	}
	return todos.map((todo, idx) => {
		const statusMarker =
			todo.status === 'completed' ? '✓' :
				todo.status === 'in_progress' ? 'IN_PROGRESS' :
					todo.status === 'cancelled' ? 'CANCELLED' : 'PENDING';
		return `${idx + 1}. [${statusMarker}] ${todo.content} <!-- id:${todo.id} -->`;
	}).join('\n');
}

/**
 * Parses numbered todo markdown format
 * Format: 1. [STATUS] Content (optionally with <!-- id:xxx --> comment)
 * Preserves existing IDs from comments, generates new UUIDs only if needed
 */
export function parseNumberedTodoMarkdown(content: string): { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }[] {
	const todos: { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled' }[] = [];
	const lines = content.split('\n');

	// Regex to match: 1. [STATUS] Content with optional ID comment
	const todoRegex = /^\d+\.\s+\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]\s+(.+?)(?:\s*<!--\s*id:([a-z0-9-]+)\s*-->)?$/;

	for (const line of lines) {
		const trimmed = line.trim();
		const match = trimmed.match(todoRegex);
		if (match) {
			const [, statusMarker, todoContent, existingId] = match;
			let status: 'pending' | 'in_progress' | 'completed' | 'cancelled' = 'pending';

			if (statusMarker === '✓') status = 'completed';
			else if (statusMarker === 'IN_PROGRESS') status = 'in_progress';
			else if (statusMarker === 'CANCELLED') status = 'cancelled';

			todos.push({
				id: existingId || generateUuid(), // Use existing ID if present, otherwise generate new
				content: todoContent.trim(),
				status
			});
		}
	}

	return todos;
}

/**
 * Derives active form (gerund) from content
 * Simple heuristic: if starts with verb, add "ing"
 */
export function deriveActiveForm(content: string): string | undefined {
	const trimmed = content.trim();
	if (!trimmed) return undefined;

	// Extract first word
	const firstWord = trimmed.split(/\s+/)[0].toLowerCase();

	// Common verbs that should get "ing" form
	const verbTransforms: Record<string, string> = {
		'add': 'Adding',
		'create': 'Creating',
		'update': 'Updating',
		'delete': 'Deleting',
		'implement': 'Implementing',
		'fix': 'Fixing',
		'refactor': 'Refactoring',
		'test': 'Testing',
		'write': 'Writing',
		'read': 'Reading',
		'parse': 'Parsing',
		'validate': 'Validating',
		'build': 'Building',
		'compile': 'Compiling',
		'run': 'Running',
		'execute': 'Executing',
		'install': 'Installing',
		'configure': 'Configuring',
		'setup': 'Setting up',
		'deploy': 'Deploying',
		'migrate': 'Migrating',
		'sync': 'Syncing',
		'merge': 'Merging',
		'integrate': 'Integrating',
		'debug': 'Debugging',
		'optimize': 'Optimizing',
		'improve': 'Improving',
		'enhance': 'Enhancing',
		'modify': 'Modifying',
		'remove': 'Removing',
		'check': 'Checking',
		'verify': 'Verifying',
		'ensure': 'Ensuring',
	};

	if (verbTransforms[firstWord]) {
		return verbTransforms[firstWord] + trimmed.substring(firstWord.length);
	}

	// Default: return undefined and use content as-is
	return undefined;
}

/**
 * Converts plan todo (from plan file) to execution todo (for thread)
 */
export function convertPlanTodoToExecutionTodo(
	planTodo: { id: string; content: string; status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' },
	index: number
): { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled'; activeForm?: string } {
	return {
		id: planTodo.id,
		content: planTodo.content,
		status: planTodo.status || 'pending',
		activeForm: deriveActiveForm(planTodo.content)
	};
}

/**
 * Parses todos with IDs from markdown content
 */
export function parseTodosFromMarkdown(content: string): TodoItem[] {
	const todos: TodoItem[] = [];
	const lines = content.split('\n');

	// Regex to match todos with ID comments: - [ ] Text <!-- id:todo-id -->
	const todoRegex = /^- \[[\s\-xX]\] (.+?) <!-- id:([a-z0-9-]+) -->$/;

	for (const line of lines) {
		const match = line.match(todoRegex);
		if (match) {
			const [, content, id] = match;
			todos.push({ id, content });
		}
	}

	return todos;
}

/**
 * Creates complete atomic plan content (Cursor AI style)
 * Accepts full plan markdown + todos, validates, and generates final content
 */
export function createAtomicPlanContent(opts: CreateAtomicPlanOptions): string {
	const { name, plan, todos, metadata } = opts;

	// Validate plan content
	const contentValidation = validatePlanContent(plan);
	if (!contentValidation.valid) {
		throw new Error(`Plan content validation failed: ${contentValidation.error}`);
	}

	// Validate todos if provided
	if (todos.length > 0) {
		const todosValidation = validateTodos(todos);
		if (!todosValidation.valid) {
			throw new Error(`Todos validation failed: ${todosValidation.error}`);
		}
	}

	// Build YAML frontmatter
	const frontmatter = `---
title: ${escapeYamlString(name)}
created: ${metadata.created}
updated: ${metadata.updated}
status: ${metadata.status}
${metadata.model ? `model: ${metadata.model}` : ''}
---

`;

	// Check if plan already has a dedicated todos/tasks/checklist section
	// Be more specific - only match sections that are specifically for todos/tasks/checklists
	// Don't match general "Implementation" sections like "Implementation Steps" or "Implementation Details"
	const hasTodosSection = /^##\s+(?:implementation\s+(?:tasks?|checklist)|tasks?|checklist|todos?)\s*$/im.test(plan);

	// If todos provided and no todos section exists, append todos section
	let finalContent = plan;
	if (todos.length > 0 && !hasTodosSection) {
		// Convert PlanTodoItem[] to format with status (all start as pending)
		const todosWithStatus = todos.map(todo => ({
			id: todo.id,
			content: todo.content,
			status: 'pending' as const
		}));

		// Use numbered format for new plans
		const todosMarkdown = todosToNumberedMarkdown(todosWithStatus);
		finalContent = `${plan.trimEnd()}

## Implementation Checklist

${todosMarkdown}
`;
	}

	// Combine frontmatter + plan content
	return frontmatter + finalContent;
}
