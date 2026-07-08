/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AskQuestionItem, AskQuestionOption, AskQuestionUserAnswer } from './chatThreadServiceTypes.js';

export const ASK_QUESTION_MAX_TITLE_LENGTH = 120;
export const ASK_QUESTION_MAX_PROMPT_LENGTH = 500;
export const ASK_QUESTION_MAX_LABEL_LENGTH = 200;
export const ASK_QUESTION_MAX_QUESTIONS = 10;

/** Reserved for the UI "Other…" synthetic option — must not appear in model-provided options */
export const ASK_QUESTION_RESERVED_OTHER_OPTION_ID = '__other__';

export const validateAskQuestionItems = (
	raw: unknown,
): { valid: true; items: AskQuestionItem[] } | { valid: false; error: string } => {
	if (!Array.isArray(raw)) {
		return { valid: false, error: 'questions must be an array' };
	}
	if (raw.length === 0) {
		return { valid: false, error: 'questions must have at least 1 item' };
	}
	if (raw.length > ASK_QUESTION_MAX_QUESTIONS) {
		return { valid: false, error: `questions must have at most ${ASK_QUESTION_MAX_QUESTIONS} items` };
	}
	const seenIds = new Set<string>();
	const items: AskQuestionItem[] = [];
	for (let i = 0; i < raw.length; i++) {
		const q: any = raw[i];
		if (!q || typeof q !== 'object') {
			return { valid: false, error: `Question ${i + 1} is not an object` };
		}
		if (typeof q.id !== 'string' || !q.id.trim()) {
			return { valid: false, error: `Question ${i + 1} missing id` };
		}
		const questionId = q.id.trim();
		if (seenIds.has(questionId)) {
			return { valid: false, error: `Duplicate question id "${questionId}"` };
		}
		seenIds.add(questionId);
		const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
		if (!prompt) {
			return { valid: false, error: `Question ${i + 1} missing prompt` };
		}
		if (prompt.length > ASK_QUESTION_MAX_PROMPT_LENGTH) {
			return { valid: false, error: `Question ${i + 1} prompt too long` };
		}
		if (!Array.isArray(q.options) || q.options.length < 2) {
			return { valid: false, error: `Question ${i + 1} needs at least 2 options` };
		}
		const seenOptIds = new Set<string>();
		const options: AskQuestionOption[] = [];
		for (let j = 0; j < q.options.length; j++) {
			const o: any = q.options[j];
			if (!o || typeof o !== 'object') {
				return { valid: false, error: `Question ${i + 1} option ${j + 1} not an object` };
			}
			if (typeof o.id !== 'string' || !o.id.trim()) {
				return { valid: false, error: `Question ${i + 1} option ${j + 1} missing id` };
			}
			const optionId = o.id.trim();
			if (optionId === ASK_QUESTION_RESERVED_OTHER_OPTION_ID) {
				return { valid: false, error: `Question ${i + 1} option id "${ASK_QUESTION_RESERVED_OTHER_OPTION_ID}" is reserved` };
			}
			if (seenOptIds.has(optionId)) {
				return { valid: false, error: `Question ${i + 1} has duplicate option id "${optionId}"` };
			}
			seenOptIds.add(optionId);
			const label = typeof o.label === 'string' ? o.label.trim() : '';
			if (!label) {
				return { valid: false, error: `Question ${i + 1} option ${j + 1} missing label` };
			}
			if (label.length > ASK_QUESTION_MAX_LABEL_LENGTH) {
				return { valid: false, error: `Question ${i + 1} option ${j + 1} label too long` };
			}
			options.push({ id: optionId, label });
		}
		items.push({
			id: questionId,
			prompt,
			options,
			allow_multiple: q.allow_multiple === true,
		});
	}
	return { valid: true, items };
};

export const normalizeAnswer = (
	q: AskQuestionItem,
	rawAnswer: { selectedOptionIds: string[]; otherText?: string } | undefined,
): AskQuestionUserAnswer => {
	if (!rawAnswer) {
		return { questionId: q.id, selectedOptionIds: [] };
	}
	const validIds = new Set(q.options.map((o) => o.id));
	const rawSelected = rawAnswer.selectedOptionIds ?? [];
	const hadOther = rawSelected.includes(ASK_QUESTION_RESERVED_OTHER_OPTION_ID);
	const selected = rawSelected.filter((id) => validIds.has(id));
	const deduped = q.allow_multiple ? Array.from(new Set(selected)) : selected.slice(0, 1);
	const otherTextTrimmed = rawAnswer.otherText?.trim();
	const otherText = hadOther && otherTextTrimmed ? otherTextTrimmed : undefined;
	return {
		questionId: q.id,
		selectedOptionIds: deduped,
		otherText,
	};
};

export const formatAnswersForLLM = (
	title: string | null,
	questions: AskQuestionItem[],
	answers: AskQuestionUserAnswer[],
	wasSkipped: boolean,
): string => {
	if (wasSkipped) {
		return `The user skipped the question form${title ? ` titled "${title}"` : ''}. No answers were provided. Proceed with reasonable defaults or your best judgment, and clearly state the assumption you made.`;
	}
	const out: string[] = [];
	if (title) {
		out.push(`# ${title}`);
	}
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i]!;
		const a = answers.find((x) => x.questionId === q.id);
		out.push(`Q${i + 1}: ${q.prompt}`);
		if (!a || (a.selectedOptionIds.length === 0 && !a.otherText)) {
			out.push(`A: (skipped)`);
		} else if (a.selectedOptionIds.length === 0 && a.otherText) {
			out.push(`A: ${a.otherText}`);
		} else {
			const labels = a.selectedOptionIds
				.map((id) => q.options.find((o) => o.id === id)?.label)
				.filter((l): l is string => !!l);
			out.push(`A: ${labels.join(', ')}`);
			if (a.otherText) {
				out.push(`   User note: ${a.otherText}`);
			}
		}
		out.push('');
	}
	return out.join('\n').trim();
};