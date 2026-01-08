/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect } from 'react';
import { URI } from '../../../../../../../base/common/uri.js';
import { ParsedPlan, parsePlanFile } from '../../../../common/planTemplate.js';
import { useIsDark } from '../util/services.js';
import '../styles.css';

export interface PlanEditorProps {
	plan: ParsedPlan;
	resource: URI;
	onSave?: (content: string) => Promise<void>;
	onContentChange?: (content: string) => void;
	initialViewMode?: 'preview' | 'markdown';
}

export const PlanEditor: React.FC<PlanEditorProps> = ({
	plan: initialPlan,
	resource,
	onSave,
	onContentChange,
	initialViewMode = 'preview'
}) => {
	const isDark = useIsDark();
	const [viewMode, setViewMode] = useState<'preview' | 'markdown'>(initialViewMode);
	const [rawContent, setRawContent] = useState(initialPlan.rawContent);
	const [isDirty, setIsDirty] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setViewMode(initialViewMode);
	}, [initialViewMode]);

	const handleContentChange = useCallback((newContent: string) => {
		setRawContent(newContent);
		setIsDirty(true);
		onContentChange?.(newContent);
	}, [onContentChange]);

	const handleSave = useCallback(async () => {
		if (!onSave || isSaving) return;
		setIsSaving(true);
		try {
			await onSave(rawContent);
			setIsDirty(false);
		} catch (error) {
			console.error('Save error:', error);
		} finally {
			setIsSaving(false);
		}
	}, [onSave, rawContent, isSaving]);

	// Auto-save
	useEffect(() => {
		if (!isDirty) return;
		const timer = setTimeout(() => handleSave(), 2000);
		return () => clearTimeout(timer);
	}, [rawContent, isDirty, handleSave]);

	// Get content without frontmatter
	const displayContent = rawContent.replace(/^---\n[\s\S]*?\n---\n*/, '');

	// Render markdown as formatted HTML
	const renderMarkdown = useCallback(() => {
		const lines = displayContent.split('\n');
		const elements: JSX.Element[] = [];
		let inCodeBlock = false;
		let codeLines: string[] = [];

		lines.forEach((line, i) => {
			// Code blocks
			if (line.startsWith('```')) {
				if (inCodeBlock) {
					elements.push(
						<pre key={`code-${i}`} className="bg-void-bg-2 border border-void-border-4 rounded p-4 my-4 overflow-x-auto">
							<code className="text-sm font-mono">{codeLines.join('\n')}</code>
						</pre>
					);
					codeLines = [];
				}
				inCodeBlock = !inCodeBlock;
				return;
			}

			if (inCodeBlock) {
				codeLines.push(line);
				return;
			}

			// Headers
			if (line.startsWith('### ')) {
				elements.push(<h3 key={i} className="text-lg font-semibold mt-6 mb-3">{line.slice(4)}</h3>);
			} else if (line.startsWith('## ')) {
				elements.push(<h2 key={i} className="text-xl font-semibold mt-8 mb-4">{line.slice(3)}</h2>);
			} else if (line.startsWith('# ')) {
				elements.push(<h1 key={i} className="text-3xl font-bold mt-2 mb-6">{line.slice(2)}</h1>);
			}
			// Bullets and checkboxes
			else if (line.match(/^[\s]*[-*]\s+\[[ xX]\]/)) {
				const checked = line.includes('[x]') || line.includes('[X]');
				const indent = line.match(/^(\s*)/)?.[1].length || 0;
				const text = line.replace(/^[\s]*[-*]\s+\[[xX\s]\]\s*/, '');
				elements.push(
					<div key={i} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: `${indent * 16}px` }}>
						<span className={`mt-1 ${checked ? 'text-green-400' : 'text-void-fg-3'}`}>
							{checked ? '✓' : '○'}
						</span>
						<span className={checked ? 'line-through text-void-fg-3' : ''}>{text}</span>
					</div>
				);
			}
			// Regular bullets
			else if (line.match(/^[\s]*[-*]\s+/)) {
				const indent = line.match(/^(\s*)/)?.[1].length || 0;
				const text = line.replace(/^[\s]*[-*]\s+/, '');
				elements.push(
					<div key={i} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: `${indent * 16}px` }}>
						<span className="text-void-fg-3 mt-1">•</span>
						<span>{text}</span>
					</div>
				);
			}
			// Bold text
			else if (line.includes('**')) {
				const parts = line.split('**');
				elements.push(
					<p key={i} className="py-1">
						{parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>)}
					</p>
				);
			}
			// Empty lines
			else if (line.trim() === '') {
				elements.push(<div key={i} className="h-3"></div>);
			}
			// Regular text
			else {
				elements.push(<p key={i} className="py-1 leading-relaxed">{line}</p>);
			}
		});

		return elements;
	}, [displayContent]);

	if (viewMode === 'markdown') {
		return (
			<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
				<div className="flex flex-col h-full bg-void-bg-3 text-void-fg-1">
					<div className="flex-1 overflow-auto">
						<textarea
							value={rawContent}
							onChange={(e) => handleContentChange(e.target.value)}
							className="w-full h-full p-8 font-mono text-sm bg-transparent focus:outline-none resize-none"
							spellCheck={false}
							style={{ userSelect: 'text', minHeight: '100%' }}
						/>
					</div>
				</div>
			</div>
		);
	}

	// Beautiful Preview - Formatted like the image
	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%' }}>
			<div className="flex flex-col h-full bg-void-bg-3 text-void-fg-1">
				<div className="flex-1 overflow-auto">
					<div className="max-w-4xl mx-auto px-12 py-12" style={{ userSelect: 'text' }}>
						{renderMarkdown()}
					</div>
				</div>
			</div>
		</div>
	);
};
