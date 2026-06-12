/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Vexelity Ai, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { basename, dirname, extname } from '../../../../base/common/resources.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IChatThreadService } from './chatThreadService.js';
import { IPlanTodoSyncService } from './planTodoSyncService.js';
import { IVoidSettingsService } from '../common/orbitSettingsService.js';
import { PlanDraft, PLAN_DIR, buildPlanContentFromDraft, preparePlanDraftSave, syncPlanChecklistToThreadTodos } from '../common/planDraftHelpers.js';
import { planFileLock } from '../common/planFileLock.js';
import { syncPlanStatus } from '../common/planTemplate.js';
import { TodoItem } from '../common/chatThreadServiceTypes.js';
import { VOID_PLAN_EDITOR_ID } from './planEditorConstants.js';

export type SavePlanDraftResult = {
	planPath: string;
	planName: string;
	content: string;
};

async function getAvailablePlanUri(fileService: IFileService, proposedUri: URI): Promise<URI> {
	if (!(await fileService.exists(proposedUri))) {
		return proposedUri;
	}

	const parent = dirname(proposedUri);
	const fileName = basename(proposedUri);
	const extension = extname(proposedUri) || '.md';
	const stem = fileName.endsWith(extension)
		? fileName.slice(0, -extension.length)
		: fileName;

	for (let index = 2; index < 1000; index += 1) {
		const candidate = URI.joinPath(parent, `${stem}-${index}${extension}`);
		if (!(await fileService.exists(candidate))) {
			return candidate;
		}
	}

	throw new Error('Could not find an available plan filename.');
}

export async function savePlanDraftToWorkspace(deps: {
	threadId: string;
	draft: PlanDraft;
	fileService: IFileService;
	workspaceContextService: IWorkspaceContextService;
	chatThreadService: IChatThreadService;
	planTodoSyncService: IPlanTodoSyncService;
	settingsService: IVoidSettingsService;
	editorService: IEditorService;
	openEditor?: boolean;
}): Promise<SavePlanDraftResult> {
	const folders = deps.workspaceContextService.getWorkspace().folders;
	if (folders.length === 0) {
		throw new Error('No workspace folder open. Please open a folder to save the plan.');
	}

	const workspaceRoot = folders[0].uri;
	const model = deps.settingsService.state.modelSelectionOfFeature.Chat?.modelName;
	const { content, planUri: proposedPlanUri, planName } = preparePlanDraftSave(deps.draft, workspaceRoot, model);

	const plansDirUri = URI.joinPath(workspaceRoot, PLAN_DIR);
	try {
		await deps.fileService.createFolder(plansDirUri);
	} catch {
		// folder may already exist
	}

	const planUri = deps.draft.savedPlanPath
		? URI.file(deps.draft.savedPlanPath)
		: await getAvailablePlanUri(deps.fileService, proposedPlanUri);

	await planFileLock.withLock(planUri.fsPath, async () => {
		await deps.fileService.writeFile(planUri, VSBuffer.fromString(content));
	});

	deps.chatThreadService.setLinkedPlanPath(deps.threadId, planUri.fsPath);
	const threadTodos = syncPlanChecklistToThreadTodos(content);
	deps.chatThreadService.setThreadTodoList(deps.threadId, threadTodos);
	deps.planTodoSyncService.watchThreadTodos(deps.threadId, planUri.fsPath);

	const savedDraft: PlanDraft = {
		...deps.draft,
		savedPlanPath: planUri.fsPath,
		updatedAt: new Date().toISOString(),
	};
	deps.chatThreadService.setThreadPlanDraft(deps.threadId, savedDraft);

	if (deps.openEditor !== false) {
		await deps.editorService.openEditor({
			resource: planUri,
			options: {
				override: VOID_PLAN_EDITOR_ID,
				preserveFocus: false,
				pinned: true,
			},
		});
	}

	return { planPath: planUri.fsPath, planName, content };
}

export async function buildPlanFromThread(deps: {
	threadId: string;
	todos: TodoItem[];
	planPath: string;
	planTitle: string;
	overview: string;
	fileService: IFileService;
	chatThreadService: IChatThreadService;
	planTodoSyncService: IPlanTodoSyncService;
	settingsService: IVoidSettingsService;
}): Promise<void> {
	const planUri = URI.file(deps.planPath);

	deps.chatThreadService.setLinkedPlanPath(deps.threadId, deps.planPath);
	deps.planTodoSyncService.watchThreadTodos(deps.threadId, deps.planPath);
	deps.chatThreadService.setThreadTodoList(deps.threadId, deps.todos);
	deps.chatThreadService.clearThreadPlanDraft(deps.threadId);

	await deps.settingsService.setGlobalSetting('chatMode', 'agent');

	try {
		await planFileLock.withLock(deps.planPath, async () => {
			const currentContent = await deps.fileService.readFile(planUri);
			const statusUpdated = syncPlanStatus(currentContent.value.toString());
			if (statusUpdated !== currentContent.value.toString()) {
				await deps.fileService.writeFile(planUri, VSBuffer.fromString(statusUpdated));
			}
		});
	} catch (error) {
		console.warn('[PlanBuild] Failed to update plan status:', error);
	}

	const messageContent = `I've created a plan: "${deps.planTitle}"

## Overview
${deps.overview}

## Tasks (${deps.todos.length})
${deps.todos.map((t, i) => `${i + 1}. [${t.status.toUpperCase()}] ${t.content}`).join('\n')}

Let's implement this plan.`;

	await deps.chatThreadService.addUserMessageAndStreamResponse({
		userMessage: messageContent,
		threadId: deps.threadId,
	});
}

export function getActivePlanDraftForThread(chatThreadService: IChatThreadService, threadId: string): PlanDraft | undefined {
	return chatThreadService.getThreadPlanDraft(threadId);
}

export function getPlanContentForBuild(draft: PlanDraft, settingsService: IVoidSettingsService): string {
	return buildPlanContentFromDraft(
		draft,
		'approved',
		settingsService.state.modelSelectionOfFeature.Chat?.modelName,
	);
}
