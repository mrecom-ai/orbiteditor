/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { ASK_QUESTION_RESERVED_OTHER_OPTION_ID } from '../../../../../../../common/askQuestionToolHelpers.js';
import { AskQuestionItem, AskQuestionUserAnswer } from '../../../../../../../common/chatThreadServiceTypes.js';

export type DraftAnswer = {
	selectedOptionIds: string[];
	otherText: string;
};

export const OTHER_OPTION_ID = ASK_QUESTION_RESERVED_OTHER_OPTION_ID;

export type AskQuestionCardProps = {
	title: string | null;
	questions: AskQuestionItem[];
	toolId: string;
	isInteractive: boolean;
	isStreaming: boolean;
	onSubmit: (answers: AskQuestionUserAnswer[]) => void;
	onSkip: () => void;
};