/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * VS Code–aligned design tokens for the tool approval consent card.
 * Modeled on `askQuestionTheme` so the two consent surfaces share a visual
 * language. Every value resolves to a VS Code CSS variable so the card
 * adapts to light/dark themes automatically.
 */
export const toolApprovalTheme = {
	// surfaces
	panelBg: 'var(--vscode-editor-background)',
	panelBorder: 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.3)',
	panelBorderActive: 'rgba(var(--vscode-void-border-2-rgb, 96, 96, 96), 0.5)',
	hoverBg: 'var(--vscode-list-hoverBackground)',
	toolbarHover: 'var(--vscode-toolbar-hoverBackground)',

	// text
	fg: 'var(--vscode-foreground)',
	descFg: 'var(--vscode-descriptionForeground)',

	// buttons
	buttonBg: 'var(--vscode-button-background)',
	buttonFg: 'var(--vscode-button-foreground)',
	buttonHover: 'var(--vscode-button-hoverBackground)',
	buttonSecondaryBg: 'var(--vscode-button-secondaryBackground)',
	buttonSecondaryFg: 'var(--vscode-button-secondaryForeground)',
	buttonSecondaryHover: 'var(--vscode-button-secondaryHoverBackground)',

	// focus / selection
	focusBorder: 'var(--vscode-focusBorder)',
	selectedBg: 'var(--vscode-list-activeSelectionBackground)',
	selectedFg: 'var(--vscode-list-activeSelectionForeground)',

	// terminal preview block
	terminalBg: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.4)',
	terminalBorder: 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.2)',

	// dividers
	subtleDivider: 'rgba(var(--vscode-void-border-3-rgb, 64, 64, 64), 0.2)',

	// awaiting badge
	awaitingBadgeBg: 'rgba(var(--vscode-void-bg-2-rgb, 16, 16, 16), 0.5)',
	awaitingBadgeFg: 'var(--vscode-descriptionForeground)',
} as const;