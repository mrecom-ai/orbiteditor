/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { JSX, useMemo, useState, useEffect, useRef } from 'react'
import { marked, MarkedToken, Token } from 'marked'

import { convertToVscodeLang, detectLanguage } from '../../../../common/helpers/languageHelpers.js'
import { BlockCodeApplyWrapper } from './ApplyBlockHoverButtons.js'
import { useAccessor } from '../util/services.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { isAbsolute } from '../../../../../../../base/common/path.js'
import { separateOutFirstLine } from '../../../../common/helpers/util.js'
import { BlockCode } from '../util/inputs.js'
import { CodespanLocationLink } from '../../../../common/chatThreadServiceTypes.js'
import { getBasename, getRelative, voidOpenFileFn } from '../sidebar-tsx/SidebarChat.js'
import { Loader, Circle, CheckCircle2, XCircle } from 'lucide-react'


export type ChatMessageLocation = {
	threadId: string;
	messageIdx: number;
}

type ApplyBoxLocation = ChatMessageLocation & { tokenIdx: string }

export const getApplyBoxId = ({ threadId, messageIdx, tokenIdx }: ApplyBoxLocation) => {
	return `${threadId}-${messageIdx}-${tokenIdx}`
}

function isValidUri(s: string): boolean {
	return s.length > 5 && isAbsolute(s) && !s.includes('//') && !s.includes('/*') // common case that is a false positive is comments like //
}

// Mermaid diagram renderer
const MermaidRender = ({ code }: { code: string }) => {
	const [svg, setSvg] = useState<string>('')
	const [error, setError] = useState<string>('')
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let mounted = true

		const renderDiagram = async () => {
			try {
				// Try to dynamically import mermaid
				// Use eval to prevent bundler from trying to resolve at build time
				const importMermaid = new Function('return import("mermaid")')
				const mermaidModule = await importMermaid()
				const mermaid = mermaidModule.default || mermaidModule

				// Initialize mermaid with theme settings
				mermaid.initialize({
					startOnLoad: false,
					theme: 'base',
					themeVariables: {
						primaryColor: 'var(--vscode-button-background)',
						primaryTextColor: 'var(--vscode-button-foreground)',
						primaryBorderColor: 'var(--vscode-button-border)',
						lineColor: 'var(--vscode-foreground)',
						secondaryColor: 'var(--vscode-button-secondaryBackground)',
						tertiaryColor: 'var(--vscode-editor-background)',
						background: 'var(--vscode-editor-background)',
						mainBkg: 'var(--vscode-editor-background)',
						textColor: 'var(--vscode-foreground)',
						fontSize: '14px',
					},
					flowchart: {
						useMaxWidth: true,
						htmlLabels: true,
						curve: 'basis'
					}
				})

				// Generate unique ID for this diagram
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

				// Render the diagram
				const { svg: renderedSvg } = await mermaid.render(id, code)

				if (mounted) {
					setSvg(renderedSvg)
					setError('')
					setIsLoading(false)
				}
			} catch (err) {
				if (mounted) {
					const errorMsg = err instanceof Error ? err.message : 'Failed to render diagram'
					// Check if it's a module loading error
					if (errorMsg.includes('module') || errorMsg.includes('import')) {
						setError('Mermaid library not available. Please install dependencies: npm install')
					} else {
						setError(errorMsg)
					}
					setIsLoading(false)
				}
			}
		}

		renderDiagram()

		return () => {
			mounted = false
		}
	}, [code])

	if (error) {
		return (
			<div className="p-3 my-2 bg-void-bg-1 border border-void-border-1 rounded text-void-fg-2 text-sm">
				<div className="font-semibold mb-1">⚠️ Mermaid Diagram</div>
				<div className="text-xs text-void-fg-3 mb-2">{error}</div>
				<details className="mt-2">
					<summary className="cursor-pointer text-xs opacity-70 hover:opacity-100 select-none">Show diagram code</summary>
					<pre className="mt-2 text-xs overflow-x-auto p-2 bg-void-bg-2-alt/40 rounded border border-void-border-3/20">{code}</pre>
				</details>
			</div>
		)
	}

	if (isLoading || !svg) {
		return (
			<div className="p-3 my-2 bg-void-bg-1 border border-void-border-1 rounded flex items-center justify-center text-void-fg-3 text-sm">
				<span className="animate-pulse">Rendering diagram...</span>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className="mermaid-diagram my-3 p-3 bg-void-bg-1 border border-void-border-1 rounded overflow-x-auto"
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	)
}

// renders contiguous string of latex eg $e^{i\pi}$
const LatexRender = ({ latex }: { latex: string }) => {
	return <span className="katex-error text-red-500">{latex}</span>
	// try {
	// 	let formula = latex;
	// 	let displayMode = false;

	// 	// Extract the formula from delimiters
	// 	if (latex.startsWith('$') && latex.endsWith('$')) {
	// 		// Check if it's display math $$...$$
	// 		if (latex.startsWith('$$') && latex.endsWith('$$')) {
	// 			formula = latex.slice(2, -2);
	// 			displayMode = true;
	// 		} else {
	// 			formula = latex.slice(1, -1);
	// 		}
	// 	} else if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
	// 		formula = latex.slice(2, -2);
	// 	} else if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
	// 		formula = latex.slice(2, -2);
	// 		displayMode = true;
	// 	}

	// 	// Render LaTeX
	// 	const html = katex.renderToString(formula, {
	// 		displayMode: displayMode,
	// 		throwOnError: false,
	// 		output: 'html'
	// 	});

	// 	// Sanitize the HTML output with DOMPurify
	// 	const sanitizedHtml = dompurify.sanitize(html, {
	// 		RETURN_TRUSTED_TYPE: true,
	// 		USE_PROFILES: { html: true, svg: true, mathMl: true }
	// 	});

	// 	// Add proper styling based on mode
	// 	const className = displayMode
	// 		? 'katex-block my-2 text-center'
	// 		: 'katex-inline';

	// 	// Use the ref approach to avoid dangerouslySetInnerHTML
	// 	const mathRef = React.useRef<HTMLSpanElement>(null);

	// 	React.useEffect(() => {
	// 		if (mathRef.current) {
	// 			mathRef.current.innerHTML = sanitizedHtml as unknown as string;
	// 		}
	// 	}, [sanitizedHtml]);

	// 	return <span ref={mathRef} className={className}></span>;
	// } catch (error) {
	// 	console.error('KaTeX rendering error:', error);
	// 	return <span className="katex-error text-red-500">{latex}</span>;
	// }
}

const Codespan = ({ text, className, onClick, tooltip }: { text: string, className?: string, onClick?: () => void, tooltip?: string }) => {

	// TODO compute this once for efficiency. we should use `labels.ts/shorten` to display duplicates properly

	return <code
		className={`font-mono font-medium rounded bg-void-bg-2-alt/35 px-1.5 py-0.5 text-[12px] text-void-fg-1 ${className || ''}`}
		onClick={onClick}
		{...tooltip ? {
			'data-tooltip-id': 'orbit-tooltip',
			'data-tooltip-content': tooltip,
			'data-tooltip-place': 'top',
		} : {}}
	>
		{text}
	</code>

}

const CodespanWithLink = ({ text, rawText, chatMessageLocation }: { text: string, rawText: string, chatMessageLocation: ChatMessageLocation }) => {

	const accessor = useAccessor()

	const chatThreadService = accessor.get('IChatThreadService')
	const commandService = accessor.get('ICommandService')
	const editorService = accessor.get('ICodeEditorService')

	const { messageIdx, threadId } = chatMessageLocation

	const [didComputeCodespanLink, setDidComputeCodespanLink] = useState<boolean>(false)

	let link: CodespanLocationLink | undefined = undefined
	let tooltip: string | undefined = undefined
	let displayText = text


	if (rawText.endsWith('`')) {
		// get link from cache
		link = chatThreadService.getCodespanLink({ codespanStr: text, messageIdx, threadId })

		if (link === undefined) {
			// if no link, generate link and add to cache
			chatThreadService.generateCodespanLink({ codespanStr: text, threadId })
				.then(link => {
					chatThreadService.addCodespanLink({ newLinkText: text, newLinkLocation: link, messageIdx, threadId })
					setDidComputeCodespanLink(true) // rerender
				})
		}

		if (link?.displayText) {
			displayText = link.displayText
		}

		if (isValidUri(displayText)) {
			tooltip = getRelative(URI.file(displayText), accessor)  // Full path as tooltip
			displayText = getBasename(displayText)
		}
	}


	const onClick = () => {
		if (!link) return;
		// Use the updated voidOpenFileFn to open the file and handle selection
		if (link.selection)
			voidOpenFileFn(link.uri, accessor, [link.selection.startLineNumber, link.selection.endLineNumber]);
		else
			voidOpenFileFn(link.uri, accessor);
	}

	return <Codespan
		text={displayText}
		onClick={onClick}
		className={link ? 'underline hover:brightness-90 transition-all duration-200 cursor-pointer' : ''}
		tooltip={tooltip || undefined}
	/>
}


const paragraphToLatexSegments = (paragraphText: string) => {

	const segments: React.ReactNode[] = [];

	if (paragraphText
		&& !(paragraphText.includes('#') || paragraphText.includes('`')) // don't process latex if a codespan or header tag
		&& !/^[\w\s.()[\]{}]+$/.test(paragraphText) // don't process latex if string only contains alphanumeric chars, whitespace, periods, and brackets
	) {
		const rawText = paragraphText;
		// Regular expressions to match LaTeX delimiters
		const displayMathRegex = /\$\$(.*?)\$\$/g;  // Display math: $$...$$
		const inlineMathRegex = /\$((?!\$).*?)\$/g; // Inline math: $...$ (but not $$)

		// Check if the paragraph contains any LaTeX expressions
		if (displayMathRegex.test(rawText) || inlineMathRegex.test(rawText)) {
			// Reset the regex state (since we used .test earlier)
			displayMathRegex.lastIndex = 0;
			inlineMathRegex.lastIndex = 0;

			// Parse the text into segments of regular text and LaTeX
			let lastIndex = 0;
			let segmentId = 0;

			// First replace display math ($$...$$)
			let match;
			while ((match = displayMathRegex.exec(rawText)) !== null) {
				const [fullMatch, formula] = match;
				const matchIndex = match.index;

				// Add text before the LaTeX expression
				if (matchIndex > lastIndex) {
					const textBefore = rawText.substring(lastIndex, matchIndex);
					segments.push(
						<span key={`text-${segmentId++}`}>
							{textBefore}
						</span>
					);
				}

				// Add the LaTeX expression
				segments.push(
					<LatexRender key={`latex-${segmentId++}`} latex={fullMatch} />
				);

				lastIndex = matchIndex + fullMatch.length;
			}

			// Add any remaining text (which might contain inline math)
			if (lastIndex < rawText.length) {
				const remainingText = rawText.substring(lastIndex);

				// Process inline math in the remaining text
				lastIndex = 0;
				inlineMathRegex.lastIndex = 0;
				const inlineSegments: React.ReactNode[] = [];

				while ((match = inlineMathRegex.exec(remainingText)) !== null) {
					const [fullMatch] = match;
					const matchIndex = match.index;

					// Add text before the inline LaTeX
					if (matchIndex > lastIndex) {
						const textBefore = remainingText.substring(lastIndex, matchIndex);
						inlineSegments.push(
							<span key={`inline-text-${segmentId++}`}>
								{textBefore}
							</span>
						);
					}

					// Add the inline LaTeX
					inlineSegments.push(
						<LatexRender key={`inline-latex-${segmentId++}`} latex={fullMatch} />
					);

					lastIndex = matchIndex + fullMatch.length;
				}

				// Add any remaining text after all inline math
				if (lastIndex < remainingText.length) {
					inlineSegments.push(
						<span key={`inline-final-${segmentId++}`}>
							{remainingText.substring(lastIndex)}
						</span>
					);
				}

				segments.push(...inlineSegments);
			}


		}
	}


	return segments
}


export type RenderTokenOptions = { isApplyEnabled?: boolean, isLinkDetectionEnabled?: boolean }
const RenderToken = ({ token, inPTag, codeURI, chatMessageLocation, tokenIdx, ...options }: { token: Token | string, inPTag?: boolean, codeURI?: URI, chatMessageLocation?: ChatMessageLocation, tokenIdx: string, } & RenderTokenOptions): React.ReactNode => {
	const accessor = useAccessor()
	const languageService = accessor.get('ILanguageService')

	// deal with built-in tokens first (assume marked token)
	const t = token as MarkedToken

	if (t.raw.trim() === '') {
		return null;
	}

	if (t.type === 'space') {
		return <span>{t.raw}</span>
	}

	if (t.type === 'code') {
		const [firstLine, remainingContents] = separateOutFirstLine(t.text)
		const firstLineIsURI = isValidUri(firstLine) && !codeURI
		const contents = firstLineIsURI ? (remainingContents?.trimStart() || '') : t.text // exclude first-line URI from contents

		if (!contents) return null

		// Check for mermaid diagrams
		if (t.lang === 'mermaid') {
			return <MermaidRender code={contents} />
		}

		// figure out langauge and URI
		let uri: URI | null
		let language: string
		if (codeURI) {
			uri = codeURI
		}
		else if (firstLineIsURI) { // get lang from the uri in the first line of the markdown
			uri = URI.file(firstLine)
		}
		else {
			uri = null
		}

		if (t.lang) { // a language was provided. empty string is common so check truthy, not just undefined
			language = convertToVscodeLang(languageService, t.lang) // convert markdown language to language that vscode recognizes (eg markdown doesn't know bash but it does know shell)
		}
		else { // no language provided - fallback - get lang from the uri and contents
			language = detectLanguage(languageService, { uri, fileContents: contents })
		}

		if (options.isApplyEnabled && chatMessageLocation) {
			const isCodeblockClosed = t.raw.trimEnd().endsWith('```') // user should only be able to Apply when the code has been closed (t.raw ends with '```')

			const applyBoxId = getApplyBoxId({
				threadId: chatMessageLocation.threadId,
				messageIdx: chatMessageLocation.messageIdx,
				tokenIdx: tokenIdx,
			})
			return <BlockCodeApplyWrapper
				canApply={isCodeblockClosed}
				applyBoxId={applyBoxId}
				codeStr={contents}
				language={language}
				uri={uri || 'current'}
			>
				<BlockCode
					initValue={contents.trimEnd()} // \n\n adds a permanent newline which creates a flash
					language={language}
				/>
			</BlockCodeApplyWrapper>
		}

		return <BlockCode
			initValue={contents}
			language={language}
		/>
	}

	if (t.type === 'heading') {

		const HeadingTag = `h${t.depth}` as keyof JSX.IntrinsicElements

		return <HeadingTag>
			<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
		</HeadingTag>
	}

	if (t.type === 'table') {
		return (
			<div className="my-3 overflow-x-auto">
				<table className="min-w-full border-collapse">
					<thead>
						<tr className="border-b-2 border-void-border-1">
							{t.header.map((h, hIdx: number) => (
								<th
									key={hIdx}
									className="px-3 py-2 text-left font-semibold text-void-fg-1 text-sm bg-void-bg-1/30"
									style={{ textAlign: (t.align && t.align[hIdx]) || 'left' }}
								>
									<ChatMarkdownRender
										chatMessageLocation={chatMessageLocation}
										string={h.text}
										inPTag={true}
										codeURI={codeURI}
										{...options}
									/>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{t.rows.map((row, rowIdx: number) => (
							<tr
								key={rowIdx}
								className={`border-b border-void-border-3/20 ${rowIdx % 2 === 0 ? 'bg-void-bg-2-alt/20' : ''} hover:bg-void-bg-2-alt/40 transition-colors`}
							>
								{row.map((r, rIdx: number) => (
									<td
										key={rIdx}
										className="px-3 py-2 text-sm text-void-fg-1"
										style={{ textAlign: (t.align && t.align[rIdx]) || 'left' }}
									>
										<ChatMarkdownRender
											chatMessageLocation={chatMessageLocation}
											string={r.text}
											inPTag={true}
											codeURI={codeURI}
											{...options}
										/>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)
	}

	if (t.type === 'hr') {
		return <hr />
	}

	if (t.type === 'blockquote') {
		return <blockquote>{t.text}</blockquote>
	}

	if (t.type === 'list_item') {
		// Check if this is a numbered todo format: [STATUS] Content (strip ID comment if present)
		const numberedTodoMatch = t.text.match(/^\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]\s+(.+?)(?:\s*<!--.*?-->)?$/);

		if (numberedTodoMatch) {
			// Render numbered todo with animated icon
			const [, status, content] = numberedTodoMatch;

			let icon: JSX.Element;
			let iconColor: string;
			let textStyle: string = '';

			switch (status) {
				case 'IN_PROGRESS':
					icon = <Loader size={14} className="animate-spin flex-shrink-0" />;
					iconColor = 'text-blue-500';
					break;
				case '✓':
					icon = <CheckCircle2 size={14} className="flex-shrink-0" />;
					iconColor = 'text-green-500';
					textStyle = 'line-through opacity-70';
					break;
				case 'CANCELLED':
					icon = <XCircle size={14} className="flex-shrink-0" />;
					iconColor = 'text-gray-500';
					textStyle = 'line-through opacity-50';
					break;
				case 'PENDING':
				default:
					icon = <Circle size={14} className="flex-shrink-0" />;
					iconColor = 'text-amber-500';
					break;
			}

			return (
				<li className="flex items-start gap-2 py-0.5">
					<span className={`mt-0.5 ${iconColor}`}>
						{icon}
					</span>
					<span className={textStyle}>
						<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={content} inPTag={true} codeURI={codeURI} {...options} />
					</span>
				</li>
			);
		}

		// Default checkbox rendering for non-numbered todos
		return <li>
			<input type='checkbox' checked={t.checked} readOnly />
			<span>
				<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
			</span>
		</li>
	}

	if (t.type === 'list') {
		// Check if this is a numbered todo list (ordered list with status markers)
		const isNumberedTodoList = t.ordered && t.items.some((item: any) =>
			item.text && /^\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]\s/.test(item.text)
		);

		if (isNumberedTodoList) {
			// Render as icon-based todo list
			return (
				<ul className="list-none space-y-2 pl-0 my-3">
					{t.items.map((item: any, index) => {
						// Match status and content, stripping out ID comment if present
						const match = item.text.match(/^\[(PENDING|IN_PROGRESS|✓|CANCELLED)\]\s+(.+?)(?:\s*<!--.*?-->)?$/);

						if (!match) {
							// Fallback for non-matching items
							return (
								<li key={index} className="flex items-start gap-2">
									<span><ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={item.text} inPTag={true} {...options} /></span>
								</li>
							);
						}

						const [, status, content] = match;

						let icon: JSX.Element;
						let iconColor: string;
						let textStyle: string = '';

						switch (status) {
							case 'IN_PROGRESS':
								icon = <Loader size={14} className="animate-spin flex-shrink-0" />;
								iconColor = 'text-blue-500';
								break;
							case '✓':
								icon = <CheckCircle2 size={14} className="flex-shrink-0" />;
								iconColor = 'text-green-500';
								textStyle = 'line-through opacity-70';
								break;
							case 'CANCELLED':
								icon = <XCircle size={14} className="flex-shrink-0" />;
								iconColor = 'text-gray-500';
								textStyle = 'line-through opacity-50';
								break;
							case 'PENDING':
							default:
								icon = <Circle size={14} className="flex-shrink-0" />;
								iconColor = 'text-amber-500';
								break;
						}

						return (
							<li key={index} className="flex items-start gap-2 py-0.5">
								<span className={`mt-0.5 ${iconColor}`}>
									{icon}
								</span>
								<span className={`flex-1 ${textStyle}`}>
									<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={content} inPTag={true} codeURI={codeURI} {...options} />
								</span>
							</li>
						);
					})}
				</ul>
			);
		}

		// Regular list rendering for non-todo lists
		const ListTag = t.ordered ? 'ol' : 'ul'

		return (
			<ListTag start={t.start ? t.start : undefined}>
				{t.items.map((item, index) => (
					<li key={index}>
						{item.task && (
							<input type='checkbox' checked={item.checked} readOnly />
						)}
						<span>
							<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={item.text} inPTag={true} {...options} />
						</span>
					</li>
				))}
			</ListTag>
		)
	}

	if (t.type === 'paragraph') {

		// check for latex
		const latexSegments = paragraphToLatexSegments(t.raw)
		if (latexSegments.length !== 0) {
			if (inPTag) {
				return <span className='block'>{latexSegments}</span>;
			}
			return <p>{latexSegments}</p>;
		}

		// if no latex, default behavior
		const contents = <>
			{t.tokens.map((token, index) => (
				<RenderToken key={index}
					token={token}
					tokenIdx={`${tokenIdx ? `${tokenIdx}-` : ''}${index}`} // assign a unique tokenId to inPTag components
					chatMessageLocation={chatMessageLocation}
					inPTag={true}
					{...options}
				/>
			))}
		</>

		if (inPTag) return <span className='block'>{contents}</span>
		return <p>{contents}</p>
	}

	if (t.type === 'text' || t.type === 'escape') {
		return <span>{t.raw}</span>
	}

	if (t.type === 'html') {
		// Handle collapsible details/summary tags
		const htmlContent = t.raw.trim()

		// Check if this is a details block
		if (htmlContent.startsWith('<details>') || htmlContent.startsWith('<details ')) {
			// Extract content between details tags
			const detailsMatch = htmlContent.match(/<details[^>]*>([\s\S]*?)<\/details>/i)
			if (detailsMatch) {
				const innerContent = detailsMatch[1]
				const summaryMatch = innerContent.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
				const summaryText = summaryMatch ? summaryMatch[1].trim() : 'Details'
				const restContent = summaryMatch
					? innerContent.replace(summaryMatch[0], '').trim()
					: innerContent.trim()

				return (
					<details className="my-2 p-3 bg-void-bg-1/50 border border-void-border-3/30 rounded">
						<summary className="cursor-pointer font-medium text-void-fg-1 hover:text-void-fg-2 select-none">
							{summaryText}
						</summary>
						<div className="mt-2 pl-2">
							<ChatMarkdownRender
								chatMessageLocation={chatMessageLocation}
								string={restContent}
								inPTag={false}
								codeURI={codeURI}
								{...options}
							/>
						</div>
					</details>
				)
			}
		}

		// For other HTML, just render as text for safety
		return <span>{t.raw}</span>
	}

	if (t.type === 'def') {
		return <></> // Definitions are typically not rendered
	}

	if (t.type === 'link') {
		// Links can contain other tokens (like code, strong, em), need to render them
		const linkContent = ('tokens' in t && t.tokens) ? (
			t.tokens.map((token, index) => (
				<RenderToken
					key={index}
					token={token}
					tokenIdx={`${tokenIdx}-link-${index}`}
					chatMessageLocation={chatMessageLocation}
					inPTag={true}
					codeURI={codeURI}
					{...options}
				/>
			))
		) : t.text

		return (
			<a
				onClick={() => { window.open(t.href) }}
				href={t.href}
				title={t.title ?? undefined}
				className='underline cursor-pointer hover:brightness-90 transition-all duration-200 text-void-fg-2'
			>
				{linkContent}
			</a>
		)
	}

	if (t.type === 'image') {
		return <img
			src={t.href}
			alt={t.text}
			title={t.title ?? undefined}

		/>
	}

	if (t.type === 'strong') {
		// Strong tags can contain other tokens, need to render them
		if ('tokens' in t && t.tokens) {
			return <strong>
				{t.tokens.map((token, index) => (
					<RenderToken
						key={index}
						token={token}
						tokenIdx={`${tokenIdx}-strong-${index}`}
						chatMessageLocation={chatMessageLocation}
						inPTag={true}
						codeURI={codeURI}
						{...options}
					/>
				))}
			</strong>
		}
		return <strong>{t.text}</strong>
	}

	if (t.type === 'em') {
		// Em tags can contain other tokens, need to render them
		if ('tokens' in t && t.tokens) {
			return <em>
				{t.tokens.map((token, index) => (
					<RenderToken
						key={index}
						token={token}
						tokenIdx={`${tokenIdx}-em-${index}`}
						chatMessageLocation={chatMessageLocation}
						inPTag={true}
						codeURI={codeURI}
						{...options}
					/>
				))}
			</em>
		}
		return <em>{t.text}</em>
	}

	// inline code
	if (t.type === 'codespan') {

		if (options.isLinkDetectionEnabled && chatMessageLocation) {
			return <CodespanWithLink
				text={t.text}
				rawText={t.raw}
				chatMessageLocation={chatMessageLocation}
			/>

		}

		return <Codespan text={t.text} />
	}

	if (t.type === 'br') {
		return <br />
	}

	// strikethrough
	if (t.type === 'del') {
		// Del tags can contain other tokens, need to render them
		if ('tokens' in t && t.tokens) {
			return <del>
				{t.tokens.map((token, index) => (
					<RenderToken
						key={index}
						token={token}
						tokenIdx={`${tokenIdx}-del-${index}`}
						chatMessageLocation={chatMessageLocation}
						inPTag={true}
						codeURI={codeURI}
						{...options}
					/>
				))}
			</del>
		}
		return <del>{t.text}</del>
	}
	// default
	return (
		<div className='bg-orange-50 rounded-sm overflow-hidden p-2'>
			<span className='text-sm text-orange-500'>Unknown token rendered...</span>
		</div>
	)
}


export const ChatMarkdownRender = ({ string, inPTag = false, chatMessageLocation, ...options }: { string: string, inPTag?: boolean, codeURI?: URI, chatMessageLocation: ChatMessageLocation | undefined } & RenderTokenOptions) => {
	string = string.replaceAll('\n•', '\n\n•')
	const tokens = marked.lexer(string); // https://marked.js.org/using_pro#renderer
	return (
		<>
			{tokens.map((token, index) => (
				<RenderToken key={index} token={token} inPTag={inPTag} chatMessageLocation={chatMessageLocation} tokenIdx={index + ''} {...options} />
			))}
		</>
	)
}
