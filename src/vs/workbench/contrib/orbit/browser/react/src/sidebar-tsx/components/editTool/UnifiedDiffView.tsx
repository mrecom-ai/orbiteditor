/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { URI } from '../../../../../../../../../base/common/uri.js';
import { CodeEditorWidget } from '../../../../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { Range } from '../../../../../../../../../editor/common/core/range.js';
import { ITextModel } from '../../../../../../../../../editor/common/model.js';
import { detectLanguage } from '../../../../../../common/helpers/languageHelpers.js';
import { WidgetComponent } from '../../../util/inputs.js';
import { useAccessor } from '../../../util/services.js';
import { buildDiffModelContent, computeUnifiedDiffLines, UnifiedDiffLine } from './unifiedDiffUtils.js';

const getLineDecorationClass = (type: UnifiedDiffLine['type']): string | undefined => {
	if (type === 'added') {
		return 'unified-diff-line-added';
	}
	if (type === 'removed') {
		return 'unified-diff-line-removed';
	}
	return undefined;
};

const applyLineDecorations = (editor: CodeEditorWidget, lines: UnifiedDiffLine[], decorationIds: string[]): string[] => {
	const decorations = lines
		.map((line, index) => {
			const className = getLineDecorationClass(line.type);
			if (!className) {
				return null;
			}
			return {
				range: new Range(index + 1, 1, index + 1, 1),
				options: {
					isWholeLine: true,
					className,
					description: 'unified-diff-line',
				},
			};
		})
		.filter((decoration): decoration is NonNullable<typeof decoration> => decoration !== null);

	return editor.deltaDecorations(decorationIds, decorations);
};

export const UnifiedDiffView = ({
	uri,
	oldString,
	newString,
	language,
	maxHeight,
}: {
	uri?: URI;
	oldString: string;
	newString: string;
	language?: string;
	maxHeight?: number;
}) => {
	const accessor = useAccessor();
	const instantiationService = accessor.get('IInstantiationService');
	const modelService = accessor.get('IModelService');
	const languageService = accessor.get('ILanguageService');

	const divRef = useRef<HTMLDivElement | null>(null);
	const editorRef = useRef<CodeEditorWidget | null>(null);
	const modelRef = useRef<ITextModel | null>(null);
	const decorationIdsRef = useRef<string[]>([]);

	const diffLines = useMemo(() => computeUnifiedDiffLines(oldString, newString), [oldString, newString]);
	const modelContent = useMemo(() => buildDiffModelContent(diffLines), [diffLines]);

	const resolvedLanguage = useMemo(() => {
		if (language) {
			return language;
		}
		return detectLanguage(languageService, { uri: uri ?? null, fileContents: newString || oldString });
	}, [language, languageService, uri, newString, oldString]);

	const languageRef = useRef(resolvedLanguage);
	const contentRef = useRef(modelContent);

	useEffect(() => {
		languageRef.current = resolvedLanguage;
		modelRef.current?.setLanguage(resolvedLanguage);
	}, [resolvedLanguage]);

	useEffect(() => {
		contentRef.current = modelContent;
		modelRef.current?.setValue(modelContent);
		if (editorRef.current) {
			decorationIdsRef.current = applyLineDecorations(editorRef.current, diffLines, decorationIdsRef.current);
			const parentNode = editorRef.current.getDomNode()?.parentElement;
			if (parentNode) {
				const height = Math.min(editorRef.current.getScrollHeight() + 1, maxHeight ?? Infinity);
				parentNode.style.height = `${height}px`;
				parentNode.style.maxHeight = maxHeight !== undefined ? `${maxHeight}px` : 'none';
				editorRef.current.layout();
			}
		}
	}, [modelContent, diffLines, maxHeight]);

	const MAX_HEIGHT = maxHeight ?? 600;
	const hasDiffContent = diffLines.length > 0;

	return (
		<div
			ref={divRef}
			className="w-full overflow-hidden"
			style={{
				background: 'var(--vscode-editor-background)',
				minHeight: hasDiffContent ? '32px' : undefined,
			}}
		>
			<WidgetComponent
				className="@@bg-editor-style-override unified-diff-editor"
				ctor={useCallback((container) => {
					return instantiationService.createInstance(
						CodeEditorWidget,
						container,
						{
							automaticLayout: true,
							wordWrap: 'off',
							scrollbar: {
								alwaysConsumeMouseWheel: false,
								vertical: maxHeight !== undefined ? 'auto' : 'hidden',
								verticalScrollbarSize: maxHeight !== undefined ? 8 : 0,
								horizontal: 'auto',
								horizontalScrollbarSize: 8,
								ignoreHorizontalScrollbarInContentHeight: true,
							},
							scrollBeyondLastLine: false,
							lineNumbers: 'off',
							readOnly: true,
							domReadOnly: true,
							readOnlyMessage: { value: '' },
							minimap: { enabled: false },
							hover: { enabled: false },
							selectionHighlight: false,
							renderLineHighlight: 'none',
							folding: false,
							lineDecorationsWidth: 0,
							overviewRulerLanes: 0,
							hideCursorInOverviewRuler: true,
							overviewRulerBorder: false,
							glyphMargin: false,
							stickyScroll: { enabled: false },
							padding: { top: 4, bottom: 4 },
						},
						{ isSimpleWidget: true },
					);
				}, [instantiationService, maxHeight])}

				onCreateInstance={useCallback((editor: CodeEditorWidget) => {
					editorRef.current = editor;

					const model = modelService.createModel(contentRef.current, {
						languageId: languageRef.current,
						onDidChange: () => ({ dispose: () => { } }),
					});
					modelRef.current = model;
					editor.setModel(model);
					decorationIdsRef.current = applyLineDecorations(editor, computeUnifiedDiffLines(oldString, newString), []);

					const parentNode = editor.getDomNode()?.parentElement;
					const resize = () => {
						const height = Math.min(editor.getScrollHeight() + 1, MAX_HEIGHT);
						if (parentNode) {
							parentNode.style.height = `${height}px`;
							parentNode.style.maxHeight = `${MAX_HEIGHT}px`;
							editor.layout();
						}
					};

					resize();
					requestAnimationFrame(() => { resize(); });
					const disposable = editor.onDidContentSizeChange(() => { resize(); });

					return [disposable, model];
				}, [modelService, oldString, newString, MAX_HEIGHT])}

				dispose={useCallback((editor: CodeEditorWidget) => {
					editorRef.current = null;
					decorationIdsRef.current = [];
					editor.dispose();
				}, [])}

				propsFn={useCallback(() => [], [])}
			/>
		</div>
	);
};
