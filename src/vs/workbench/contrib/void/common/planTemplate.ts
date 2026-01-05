/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Plan Template Infrastructure
 *
 * This module provides utilities for creating and manipulating implementation plan files
 * stored as Markdown with YAML frontmatter in .void/plans/
 */

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
 * Options for creating a new plan file
 */
export interface CreatePlanOptions {
	planName: string;
	overview: string;
	initialFiles?: string[];
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
 * Adds a TODO item to the plan's checklist section
 */
export function addTodoToChecklist(currentContent: string, todoText: string, category?: string): { content: string; todoCount: number } {
	const marker = PLAN_SECTION_MARKERS.checklist;
	const markerIndex = currentContent.indexOf(marker);

	if (markerIndex === -1) {
		// No checklist section, create one
		const newChecklist = `\n\n${marker}\n- [ ] ${todoText}\n`;
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

	// Count existing TODOs (match both checked [xX] and unchecked [\s])
	const existingTodos = (checklistContent.match(/^- \[[\sxX]\]/gm) || []).length;

	// Add category header if provided and not already present
	let newTodo = `- [ ] ${todoText}`;
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

	// Find all unchecked TODO items (match any single whitespace character)
	const todoRegex = /^- \[\s\] (.*)$/gm;
	const lines = currentContent.split('\n');
	let uncheckedIndex = 0;
	let targetLineIndex = -1;
	let completedItem = '';

	for (let i = 0; i < lines.length; i++) {
		if (todoRegex.test(lines[i])) {
			uncheckedIndex++;
			if (uncheckedIndex === itemIndex) {
				targetLineIndex = i;
				// Extract the item text
				const match = lines[i].match(/^- \[\s\] (.*)$/);
				completedItem = match ? match[1] : lines[i];
				break;
			}
		}
		// Reset regex lastIndex for next test
		todoRegex.lastIndex = 0;
	}

	if (targetLineIndex === -1) {
		throw new Error(`TODO item #${itemIndex} not found. There are ${uncheckedIndex} unchecked items.`);
	}

	// Mark the item as complete - replace any whitespace with x
	lines[targetLineIndex] = lines[targetLineIndex].replace(/^- \[\s\] /, '- [x] ');

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
 * Counts the total and completed TODO items in the checklist
 */
export function countTodoItems(content: string): { total: number; completed: number; pending: number } {
	// Case-insensitive matching for [x] or [X]
	const checkedRegex = /^- \[[xX]\]/gm;
	// Match any single whitespace character for unchecked
	const uncheckedRegex = /^- \[\s\]/gm;

	const checkedMatches = content.match(checkedRegex) || [];
	const uncheckedMatches = content.match(uncheckedRegex) || [];

	return {
		total: checkedMatches.length + uncheckedMatches.length,
		completed: checkedMatches.length,
		pending: uncheckedMatches.length,
	};
}
