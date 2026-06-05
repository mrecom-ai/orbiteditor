/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import {
	FileCode,
	FileJson,
	FileText,
	File,
	Image,
	FileArchive,
	Database,
	Settings,
	Lock,
	Terminal,
	FileType
} from 'lucide-react';

/**
 * Get the appropriate file icon component based on file extension
 * Returns a Lucide React icon component
 */
export const getFileIcon = (filename: string | undefined, size: number = 13): React.ReactNode => {
	if (!filename) {
		return <File size={size} className="text-void-fg-4/50 flex-shrink-0" strokeWidth={1.8} />;
	}

	// Get extension
	const ext = filename.toLowerCase().split('.').pop() || '';
	const lowerFilename = filename.toLowerCase();

	// Determine icon and color based on extension
	let IconComponent = File;
	let colorClass = 'text-void-fg-4/50';

	// TypeScript/JavaScript
	if (['ts', 'tsx'].includes(ext)) {
		IconComponent = FileType;
		colorClass = 'text-[#3178c6]/70';
	}
	else if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
		IconComponent = FileType;
		colorClass = 'text-[#f7df1e]/70';
	}
	// Python
	else if (['py', 'pyw', 'pyx'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#3776ab]/70';
	}
	// Java/Kotlin/Scala
	else if (ext === 'java') {
		IconComponent = FileCode;
		colorClass = 'text-[#b07219]/70';
	}
	else if (['kt', 'kts'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#7f52ff]/70';
	}
	else if (ext === 'scala') {
		IconComponent = FileCode;
		colorClass = 'text-[#dc322f]/70';
	}
	// C/C++
	else if (['c', 'h'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#555555]/70';
	}
	else if (['cpp', 'cc', 'cxx', 'hpp'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#f34b7d]/70';
	}
	// Go/Rust
	else if (ext === 'go') {
		IconComponent = FileCode;
		colorClass = 'text-[#00add8]/70';
	}
	else if (ext === 'rs') {
		IconComponent = FileCode;
		colorClass = 'text-[#dea584]/70';
	}
	// Ruby/PHP
	else if (ext === 'rb') {
		IconComponent = FileCode;
		colorClass = 'text-[#701516]/70';
	}
	else if (ext === 'php') {
		IconComponent = FileCode;
		colorClass = 'text-[#4f5d95]/70';
	}
	// Web
	else if (['html', 'htm'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#e34c26]/70';
	}
	else if (ext === 'css') {
		IconComponent = FileCode;
		colorClass = 'text-[#1572b6]/70';
	}
	else if (['scss', 'sass'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-[#cc6699]/70';
	}
	// JSON
	else if (['json', 'jsonc', 'json5'].includes(ext) || lowerFilename.endsWith('package.json') || lowerFilename.endsWith('tsconfig.json')) {
		IconComponent = FileJson;
		colorClass = 'text-[#f7df1e]/70';
	}
	// YAML
	else if (['yaml', 'yml'].includes(ext)) {
		IconComponent = Settings;
		colorClass = 'text-[#cb171e]/70';
	}
	// XML/SVG
	else if (ext === 'xml') {
		IconComponent = FileCode;
		colorClass = 'text-[#e34c26]/70';
	}
	else if (ext === 'svg') {
		IconComponent = Image;
		colorClass = 'text-[#ffb13b]/70';
	}
	// Markdown/Text
	else if (['md', 'mdx'].includes(ext)) {
		IconComponent = FileText;
		colorClass = 'text-void-fg-4/60';
	}
	else if (ext === 'txt') {
		IconComponent = FileText;
		colorClass = 'text-void-fg-4/50';
	}
	// Images
	else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext)) {
		IconComponent = Image;
		colorClass = 'text-void-fg-4/50';
	}
	// Archives
	else if (['zip', 'tar', 'gz', 'rar', '7z', 'tgz'].includes(ext)) {
		IconComponent = FileArchive;
		colorClass = 'text-void-fg-4/50';
	}
	// Shell scripts
	else if (['sh', 'bash', 'zsh', 'fish', 'ps1'].includes(ext)) {
		IconComponent = Terminal;
		colorClass = 'text-[#89e051]/70';
	}
	// Database
	else if (['sql', 'db', 'sqlite'].includes(ext)) {
		IconComponent = Database;
		colorClass = 'text-[#e38c00]/70';
	}
	// Lock files
	else if (ext === 'lock' || lowerFilename.includes('lock')) {
		IconComponent = Lock;
		colorClass = 'text-void-fg-4/50';
	}
	// Config files
	else if (lowerFilename.includes('.env') || lowerFilename.includes('config') || lowerFilename.includes('dockerfile')) {
		IconComponent = Settings;
		colorClass = 'text-void-fg-4/55';
	}
	// Code files
	else if (['vim', 'lua', 'el', 'clj', 'hs', 'ml', 'ex', 'erl'].includes(ext)) {
		IconComponent = FileCode;
		colorClass = 'text-void-fg-4/60';
	}

	return <IconComponent size={size} className={`${colorClass} flex-shrink-0`} strokeWidth={1.8} />;
};

/**
 * Get just the file extension for display purposes
 */
export const getFileExtension = (filename: string | undefined): string => {
	if (!filename) return '';
	const ext = filename.toLowerCase().split('.').pop() || '';
	return ext ? `.${ext}` : '';
};

/**
 * Get a descriptive label for the file type
 */
export const getFileTypeLabel = (filename: string | undefined): string => {
	if (!filename) return 'File';

	const ext = filename.toLowerCase().split('.').pop() || '';

	const labels: Record<string, string> = {
		'ts': 'TypeScript',
		'tsx': 'TypeScript React',
		'js': 'JavaScript',
		'jsx': 'React',
		'py': 'Python',
		'html': 'HTML',
		'css': 'CSS',
		'json': 'JSON',
		'md': 'Markdown',
		'sql': 'SQL',
		'sh': 'Shell Script',
		'go': 'Go',
		'rs': 'Rust',
		'java': 'Java',
		'cpp': 'C++',
		'c': 'C',
	};

	return labels[ext] || 'File';
};
