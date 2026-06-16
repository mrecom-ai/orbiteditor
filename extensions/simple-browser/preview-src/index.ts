/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onceDocumentLoaded } from './events';

const vscode = acquireVsCodeApi();

function getSettings() {
	const element = document.getElementById('simple-browser-settings');
	if (element) {
		const data = element.getAttribute('data-settings');
		if (data) {
			return JSON.parse(data);
		}
	}

	throw new Error(`Could not load settings`);
}

const settings = getSettings();

const iframe = document.querySelector('iframe')!;
const header = document.querySelector('.header')!;
const input = header.querySelector<HTMLInputElement>('.url-input')!;
const forwardButton = header.querySelector<HTMLButtonElement>('.forward-button')!;
const backButton = header.querySelector<HTMLButtonElement>('.back-button')!;
const reloadButton = header.querySelector<HTMLButtonElement>('.reload-button')!;
const homeButton = header.querySelector<HTMLButtonElement>('.home-button')!;
const selectElementButton = header.querySelector<HTMLButtonElement>('.select-element-button')!;
const openExternalButton = header.querySelector<HTMLButtonElement>('.open-external-button')!;

// URL bar elements
const securityIcon = header.querySelector<HTMLElement>('.security-icon')!;
const clearButton = header.querySelector<HTMLButtonElement>('.clear-button')!;

// Navigation constants
const homeUrl = 'https://www.google.com/';
const searchEngineUrl = 'https://www.google.com/search?q=';

// URL tracking for sync detection
let lastKnownUrl: string = '';
let lastReportedUrl: string = '';
let urlBarMayBeStale = false;
let initialIframeLoadDone = false;

// Client-side history management (fallback only - Puppeteer is source of truth)
let historyStack: string[] = [];
let historyIndex = -1;
let navigationStateOverride: { canGoBack: boolean; canGoForward: boolean } | undefined;

// Check if input is a valid URL
function isValidUrl(input: string): boolean {
	try {
		const url = new URL(input);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		// Check if it looks like a domain (contains a dot and no spaces)
		if (!input.includes(' ') && input.includes('.')) {
			const parts = input.split('.');
			const lastPart = parts[parts.length - 1].split('/')[0];
			// Check if TLD is at least 2 characters
			if (lastPart.length >= 2) {
				return true;
			}
		}
		return false;
	}
}

// Convert input to URL (either direct URL or search)
function inputToUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		return homeUrl;
	}

	if (isValidUrl(trimmed)) {
		try {
			new URL(trimmed);
			return trimmed;
		} catch {
			// Probably a domain without protocol
			return `https://${trimmed}`;
		}
	}

	// It's a search query
	return searchEngineUrl + encodeURIComponent(trimmed);
}

// Update URL bar stale indicator
function updateUrlBarStaleIndicator(): void {
	input.classList.toggle('url-may-be-stale', urlBarMayBeStale);
	if (urlBarMayBeStale) {
		input.title = 'Address bar may be outdated after in-page navigation. Enter the current URL and press Enter.';
	} else {
		input.title = '';
	}
}

function updateUrlBar(url: string, stale: boolean = false): void {
	input.value = url;
	lastKnownUrl = url;
	urlBarMayBeStale = stale;
	updateSecurityIcon(url);
	updateUrlBarStaleIndicator();
}

// Update security icon based on URL
function updateSecurityIcon(url: string): void {
	const iconElement = securityIcon.querySelector('i')!;

	try {
		const urlObj = new URL(url);
		if (urlObj.protocol === 'https:') {
			securityIcon.classList.add('secure');
			securityIcon.classList.remove('insecure');
			securityIcon.title = 'Connection is secure';
			iconElement.className = 'codicon codicon-lock';
		} else {
			securityIcon.classList.remove('secure');
			securityIcon.classList.add('insecure');
			securityIcon.title = 'Connection is not secure';
			iconElement.className = 'codicon codicon-unlock';
		}
	} catch {
		securityIcon.classList.remove('secure', 'insecure');
		securityIcon.title = '';
		iconElement.className = 'codicon codicon-globe';
	}
}

// Update navigation button states
function updateNavigationButtons(): void {
	if (navigationStateOverride) {
		backButton.disabled = !navigationStateOverride.canGoBack;
		forwardButton.disabled = !navigationStateOverride.canGoForward;
		return;
	}
	backButton.disabled = historyIndex <= 0;
	forwardButton.disabled = historyIndex >= historyStack.length - 1;
}

// Navigate to a URL
function navigateToUrl(url: string, source: 'user' | 'extension' | 'iframe' = 'user', addToHistory: boolean = true): void {
	iframe.src = url;
	updateUrlBar(url, false);

	// Only notify extension for user-initiated or iframe-initiated navigation
	// Extension-initiated navigation is already known to extension
	if (source === 'user') {
		vscode.postMessage({ type: 'navigate', url, source: 'user-action' });
	} else if (source === 'iframe') {
		vscode.postMessage({ type: 'urlChanged', url, source: 'iframe-navigation' });
	} else {
		// Extension-initiated - just update UI
		vscode.postMessage({ type: 'didNavigate', url });
	}

	if (addToHistory) {
		// Fallback history for UI button states
		historyStack = historyStack.slice(0, historyIndex + 1);
		historyStack.push(url);
		historyIndex = historyStack.length - 1;
	}

	updateNavigationButtons();
}

// Go back in history
function goBack(): void {
	// Send message to extension to handle via Puppeteer
	vscode.postMessage({ type: 'goBack' });

	// Optimistic UI update (fallback)
	if (historyIndex > 0) {
		historyIndex--;
		updateNavigationButtons();
	}
}

// Go forward in history
function goForward(): void {
	// Send message to extension to handle via Puppeteer
	vscode.postMessage({ type: 'goForward' });

	// Optimistic UI update (fallback)
	if (historyIndex < historyStack.length - 1) {
		historyIndex++;
		updateNavigationButtons();
	}
}

// Reload current page
function reload(): void {
	reloadButton.classList.remove('active');

	// Send message to extension to handle via Puppeteer
	vscode.postMessage({ type: 'reload' });

	// Refresh iframe without creating a new history entry
	if (lastKnownUrl) {
		navigateToUrl(lastKnownUrl, 'extension', false);
	}
}

const automationOverlay = document.getElementById('automation-overlay')!;
const automationAction = automationOverlay.querySelector<HTMLElement>('.automation-action')!;
const automationDetails = automationOverlay.querySelector<HTMLElement>('.automation-details')!;
let automationTimeout: number | undefined;

function showAutomationOverlay(action: string, details?: string, timeoutMs: number = 0): void {
	if (automationTimeout) {
		clearTimeout(automationTimeout);
		automationTimeout = undefined;
	}

	automationAction.textContent = action;
	automationDetails.textContent = details ?? '';
	automationOverlay.classList.add('visible');

	if (timeoutMs > 0) {
		automationTimeout = window.setTimeout(() => {
			automationTimeout = undefined;
			automationOverlay.classList.remove('visible');
		}, timeoutMs);
	}
}

// --- Element selection overlay state ---
const elementSelectionOverlay = document.getElementById('element-selection-overlay')!;
const elementSelectionImage = document.getElementById('element-selection-image') as HTMLImageElement;
const elementSelectionImageWrapper = document.getElementById('element-selection-image-wrapper')!;
const elementSelectionHighlight = document.getElementById('element-selection-highlight')!;
const elementSelectionStatus = document.getElementById('element-selection-status')!;

type ElementSelectionUiState = 'disabled' | 'loading' | 'ready' | 'picking' | 'error';

let elementSelectionUiState: ElementSelectionUiState = 'disabled';
let activeSelectionGeneration = 0;
let latestScreenshotDims: { width: number; height: number } | null = null;
let hoverRaf: number | undefined;
let pendingHoverPoint: { x: number; y: number } | null = null;
let scrollDebounce: number | undefined;
let resizeDebounce: number | undefined;
let accumulatedScrollDelta = 0;
let lastSelectionViewport = { width: 0, height: 0 };
let screenshotObjectUrl: string | undefined;
let screenshotLoadTimeout: number | undefined;

function isElementSelectionActive(): boolean {
	return elementSelectionUiState !== 'disabled';
}

function isElementSelectionInteractive(): boolean {
	return elementSelectionUiState === 'ready';
}

function setElementSelectionUiState(state: ElementSelectionUiState): void {
	elementSelectionUiState = state;
	elementSelectionOverlay.dataset.state = state;
	if (state === 'disabled') {
		selectElementButton.classList.remove('active');
		elementSelectionOverlay.classList.remove('active');
		elementSelectionOverlay.setAttribute('aria-hidden', 'true');
	} else {
		selectElementButton.classList.add('active');
		elementSelectionOverlay.classList.add('active');
		elementSelectionOverlay.setAttribute('aria-hidden', 'false');
	}
}

function setElementSelectionStatus(text: string): void {
	elementSelectionStatus.textContent = text;
}

function clearScreenshotLoadTimeout(): void {
	if (screenshotLoadTimeout) {
		clearTimeout(screenshotLoadTimeout);
		screenshotLoadTimeout = undefined;
	}
}

function revokeScreenshotObjectUrl(): void {
	if (screenshotObjectUrl) {
		URL.revokeObjectURL(screenshotObjectUrl);
		screenshotObjectUrl = undefined;
	}
}

function startScreenshotLoadTimeout(): void {
	clearScreenshotLoadTimeout();
	screenshotLoadTimeout = window.setTimeout(() => {
		screenshotLoadTimeout = undefined;
		if (!isElementSelectionActive()) {
			return;
		}
		if (elementSelectionUiState === 'loading' || elementSelectionUiState === 'picking') {
			setElementSelectionUiState('error');
			setElementSelectionStatus('Preview timed out. Click Select Element to retry.');
		}
	}, 15000);
}

function setScreenshotBase64(base64: string): void {
	revokeScreenshotObjectUrl();
	elementSelectionImage.removeAttribute('src');
	try {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: 'image/png' });
		screenshotObjectUrl = URL.createObjectURL(blob);
		elementSelectionImage.src = screenshotObjectUrl;
	} catch {
		elementSelectionImage.src = `data:image/png;base64,${base64}`;
	}
	startScreenshotLoadTimeout();
}

function clearElementSelectionTimers(): void {
	clearScreenshotLoadTimeout();
	if (hoverRaf) {
		window.cancelAnimationFrame(hoverRaf);
		hoverRaf = undefined;
	}
	if (scrollDebounce) {
		clearTimeout(scrollDebounce);
		scrollDebounce = undefined;
	}
	if (resizeDebounce) {
		clearTimeout(resizeDebounce);
		resizeDebounce = undefined;
	}
	pendingHoverPoint = null;
}

function resetElementSelectionVisuals(): void {
	setHighlight(null);
	latestScreenshotDims = null;
	revokeScreenshotObjectUrl();
	elementSelectionImage.removeAttribute('src');
}

function isCurrentSelectionGeneration(generation: unknown): boolean {
	return typeof generation === 'number' && generation === activeSelectionGeneration;
}

function acceptSelectionMessage(generation: unknown): boolean {
	if (!isElementSelectionActive()) {
		return false;
	}
	return isCurrentSelectionGeneration(generation);
}

elementSelectionImage.addEventListener('load', () => {
	clearScreenshotLoadTimeout();
	if (!isElementSelectionActive()) {
		return;
	}
	if (elementSelectionImage.naturalWidth && elementSelectionImage.naturalHeight) {
		latestScreenshotDims = { width: elementSelectionImage.naturalWidth, height: elementSelectionImage.naturalHeight };
	} else {
		latestScreenshotDims = null;
	}
	if (elementSelectionUiState === 'loading' || elementSelectionUiState === 'picking') {
		setElementSelectionUiState('ready');
		setElementSelectionStatus('Hover to highlight. Click to add to chat.');
	}
});

elementSelectionImage.addEventListener('error', () => {
	clearScreenshotLoadTimeout();
	if (!isElementSelectionActive()) {
		return;
	}
	latestScreenshotDims = null;
	setElementSelectionUiState('error');
	setElementSelectionStatus('Failed to load preview. Click Select Element to retry.');
});

function setHighlight(box: { x: number; y: number; width: number; height: number } | null): void {
	if (!box || !latestScreenshotDims) {
		elementSelectionHighlight.classList.remove('visible');
		return;
	}

	// Use the actual image's bounding rect, not the wrapper's, to match getPointInScreenshot()
	const imageRect = elementSelectionImage.getBoundingClientRect();
	const scaleX = imageRect.width / latestScreenshotDims.width;
	const scaleY = imageRect.height / latestScreenshotDims.height;

	// Position relative to the image's actual position
	const left = Math.max(0, imageRect.left - elementSelectionImageWrapper.getBoundingClientRect().left + box.x * scaleX);
	const top = Math.max(0, imageRect.top - elementSelectionImageWrapper.getBoundingClientRect().top + box.y * scaleY);
	const width = Math.max(0, box.width * scaleX);
	const height = Math.max(0, box.height * scaleY);

	elementSelectionHighlight.style.left = `${left}px`;
	elementSelectionHighlight.style.top = `${top}px`;
	elementSelectionHighlight.style.width = `${width}px`;
	elementSelectionHighlight.style.height = `${height}px`;
	elementSelectionHighlight.classList.add('visible');
}

function getPointInScreenshot(e: MouseEvent): { x: number; y: number } | null {
	const rect = elementSelectionImage.getBoundingClientRect();
	const naturalWidth = elementSelectionImage.naturalWidth;
	const naturalHeight = elementSelectionImage.naturalHeight;

	if (!naturalWidth || !naturalHeight || rect.width <= 0 || rect.height <= 0) {
		return null;
	}

	const x = (e.clientX - rect.left) * (naturalWidth / rect.width);
	const y = (e.clientY - rect.top) * (naturalHeight / rect.height);

	// Reject coordinates outside rendered screenshot bounds
	if (x < 0 || y < 0 || x >= naturalWidth || y >= naturalHeight) {
		return null;
	}

	return { x, y };
}

function requestSelectionScreenshot(): void {
	if (!isElementSelectionActive()) {
		return;
	}

	const url = lastKnownUrl || input.value;
	const viewport = { width: Math.max(1, iframe.clientWidth), height: Math.max(1, iframe.clientHeight) };
	setElementSelectionUiState('loading');
	setElementSelectionStatus('Loading preview…');
	resetElementSelectionVisuals();
	vscode.postMessage({ type: 'elementSelection.start', url, viewport, generation: activeSelectionGeneration });
}

function enableElementSelection(): void {
	clearElementSelectionTimers();
	resetElementSelectionVisuals();
	activeSelectionGeneration = 0;
	lastSelectionViewport = { width: Math.max(1, iframe.clientWidth), height: Math.max(1, iframe.clientHeight) };
	setElementSelectionUiState('loading');
	setElementSelectionStatus('Loading preview…');
	requestSelectionScreenshot();
}

function disableElementSelection(): void {
	clearElementSelectionTimers();
	resetElementSelectionVisuals();
	activeSelectionGeneration = 0;
	setElementSelectionUiState('disabled');
	setElementSelectionStatus('');
	vscode.postMessage({ type: 'elementSelection.stop' });
}

function toggleElementSelection(): void {
	if (elementSelectionUiState === 'error') {
		enableElementSelection();
		return;
	}
	if (isElementSelectionActive()) {
		disableElementSelection();
	} else {
		enableElementSelection();
	}
}

window.addEventListener('message', e => {
	switch (e.data.type) {
		case 'focus':
			iframe.focus();
			break;
		case 'didChangeFocusLockIndicatorEnabled':
			toggleFocusLockIndicatorEnabled(e.data.enabled);
			break;
		case 'updateUrlBar': {
			if (typeof e.data.url === 'string') {
				updateUrlBar(e.data.url, !!e.data.stale);
			} else if (typeof e.data.stale === 'boolean') {
				urlBarMayBeStale = e.data.stale;
				updateUrlBarStaleIndicator();
			}
			break;
		}
		case 'navigate':
			// Navigate from extension (e.g., when show is called with new URL or Puppeteer navigates)
			navigateToUrl(e.data.url, 'extension');
			break;
		case 'updateNavigationState':
			// Update back/forward button states from Puppeteer history
			if (!navigationStateOverride) {
				navigationStateOverride = { canGoBack: false, canGoForward: false };
			}
			if (typeof e.data.canGoBack === 'boolean') {
				navigationStateOverride.canGoBack = e.data.canGoBack;
			}
			if (typeof e.data.canGoForward === 'boolean') {
				navigationStateOverride.canGoForward = e.data.canGoForward;
			}
			updateNavigationButtons();
			break;
		case 'navigationError':
			// Revert to previous URL on navigation failure
			if (typeof e.data.previousUrl === 'string') {
				iframe.src = e.data.previousUrl;
				input.value = e.data.previousUrl;
				updateSecurityIcon(e.data.previousUrl);
				lastKnownUrl = e.data.previousUrl;
			}
			if (typeof e.data.error === 'string') {
				console.error('Navigation failed:', e.data.error);
			}
			break;
		case 'automation-activity':
			// Disabled for production - no automation overlays
			// showAutomationActivity(e.data.action, e.data.details);
			break;
		case 'sessionRecovering':
			reloadButton.classList.remove('active');
			showAutomationOverlay('Reconnecting automation session...', 'Restoring automation controls');
			break;
		case 'sessionRecovered':
			reloadButton.classList.remove('active');
			showAutomationOverlay('Automation session restored', undefined, 1500);
			break;
		case 'sessionRecoveryFailed':
			reloadButton.classList.add('active');
			showAutomationOverlay('Automation session lost', 'Press Reload to retry', 5000);
			break;
		case 'elementSelection.screenshot': {
			if (!isElementSelectionActive()) break;
			const generation = e.data.generation;
			if (typeof generation !== 'number') break;
			if (generation < activeSelectionGeneration) break;
			activeSelectionGeneration = generation;
			const base64 = e.data.data as string | undefined;
			if (!base64) break;
			setHighlight(null);
			setElementSelectionUiState('loading');
			setElementSelectionStatus('Loading preview…');
			setScreenshotBase64(base64);
			break;
		}
		case 'elementSelection.hoverResult': {
			if (!acceptSelectionMessage(e.data.generation)) break;
			if (!isElementSelectionInteractive()) break;
			const data = e.data.data as { boundingBox: { x: number; y: number; width: number; height: number } | null; label: string | null } | undefined;
			if (!data) break;
			setHighlight(data.boundingBox);
			if (data.label) {
				setElementSelectionStatus(data.label);
			}
			break;
		}
		case 'elementSelection.picked': {
			if (!acceptSelectionMessage(e.data.generation)) break;
			const data = e.data.data as { label?: string; selector?: string } | undefined;
			const label = data?.selector || data?.label || 'Element added';
			setElementSelectionUiState('ready');
			setElementSelectionStatus(`Added: ${label}`);
			break;
		}
		case 'elementSelection.error': {
			if (!isElementSelectionActive()) break;
			const generation = e.data.generation;
			if (typeof generation === 'number' && generation < activeSelectionGeneration) break;
			if (typeof generation === 'number') {
				activeSelectionGeneration = generation;
			}
			const msg = (e.data.message as string | undefined) || 'Element selection error';
			setElementSelectionUiState('error');
			setElementSelectionStatus(msg);
			break;
		}
		case 'elementSelection.stopped': {
			if (!isElementSelectionActive()) break;
			clearElementSelectionTimers();
			resetElementSelectionVisuals();
			activeSelectionGeneration = 0;
			setElementSelectionUiState('disabled');
			setElementSelectionStatus('');
			break;
		}
	}
});

onceDocumentLoaded(() => {
	setInterval(() => {
		const iframeFocused = document.activeElement?.tagName === 'IFRAME';
		document.body.classList.toggle('iframe-focused', iframeFocused);
	}, 50);

	// Detect iframe navigation (user clicks links, submits forms, etc.)
	iframe.addEventListener('load', () => {
		let iframeUrl: string | undefined;
		try {
			const href = iframe.contentWindow?.location.href;
			if (href && href !== 'about:blank') {
				iframeUrl = href;
			}
		} catch {
			// Cross-origin — parent cannot read iframe URL (expected for external sites)
		}

		if (iframeUrl && iframeUrl !== lastKnownUrl) {
			if (iframeUrl === lastReportedUrl) {
				return;
			}
			lastReportedUrl = iframeUrl;
			updateUrlBar(iframeUrl, false);
			vscode.postMessage({ type: 'iframeLoaded', url: iframeUrl, crossOrigin: false });
		} else if (!iframeUrl && initialIframeLoadDone) {
			urlBarMayBeStale = true;
			updateUrlBarStaleIndicator();
			vscode.postMessage({ type: 'iframeLoaded', crossOrigin: true });
		}

		initialIframeLoadDone = true;
	});

	input.addEventListener('change', e => {
		const inputValue = (e.target as HTMLInputElement).value;
		const url = inputToUrl(inputValue);
		navigateToUrl(url, 'user');
	});

	// Handle Enter key press
	input.addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			const url = inputToUrl(input.value);
			navigateToUrl(url, 'user');
			input.blur();
		} else if (e.key === 'Escape') {
			input.blur();
		}
	});

	// Select all text when focusing the input
	input.addEventListener('focus', () => {
		setTimeout(() => input.select(), 0);
	});

	// Clear button handler
	clearButton.addEventListener('click', () => {
		input.value = '';
		input.focus();
	});

	forwardButton.addEventListener('click', () => {
		goForward();
	});

	backButton.addEventListener('click', () => {
		goBack();
	});

	homeButton.addEventListener('click', () => {
		navigateToUrl(homeUrl, 'user');
	});

	selectElementButton.addEventListener('click', () => {
		toggleElementSelection();
	});

	openExternalButton.addEventListener('click', () => {
		vscode.postMessage({
			type: 'openExternal',
			url: input.value
		});
	});

	reloadButton.addEventListener('click', () => {
		reload();
	});

	// Initial page load
	const initialUrl = settings.url || homeUrl;
	navigateToUrl(initialUrl, 'extension');

	toggleFocusLockIndicatorEnabled(settings.focusLockEnabled);
});

function toggleFocusLockIndicatorEnabled(enabled: boolean) {
	document.body.classList.toggle('enable-focus-lock-indicator', enabled);
}

// Element selection interactions (hover + click + scroll)
elementSelectionImageWrapper.addEventListener('mousemove', (e) => {
	if (!isElementSelectionInteractive()) return;
	const pt = getPointInScreenshot(e);
	if (!pt) return;
	pendingHoverPoint = pt;

	if (hoverRaf) return;
	hoverRaf = window.requestAnimationFrame(() => {
		hoverRaf = undefined;
		if (!pendingHoverPoint || !isElementSelectionInteractive()) return;
		vscode.postMessage({
			type: 'elementSelection.hover',
			x: pendingHoverPoint.x,
			y: pendingHoverPoint.y,
			generation: activeSelectionGeneration,
		});
		pendingHoverPoint = null;
	});
});

elementSelectionImageWrapper.addEventListener('mouseleave', () => {
	if (!isElementSelectionActive()) return;
	setHighlight(null);
});

elementSelectionImageWrapper.addEventListener('click', (e) => {
	if (!isElementSelectionInteractive()) return;
	const pt = getPointInScreenshot(e);
	if (!pt) return;
	setElementSelectionUiState('picking');
	setElementSelectionStatus('Selecting element…');
	vscode.postMessage({
		type: 'elementSelection.pick',
		x: pt.x,
		y: pt.y,
		generation: activeSelectionGeneration,
	});
});

elementSelectionOverlay.addEventListener('wheel', (e) => {
	if (!isElementSelectionInteractive()) return;
	e.preventDefault();
	e.stopPropagation();

	accumulatedScrollDelta += e.deltaY;
	if (scrollDebounce) {
		clearTimeout(scrollDebounce);
	}
	scrollDebounce = window.setTimeout(() => {
		scrollDebounce = undefined;
		const deltaY = accumulatedScrollDelta;
		accumulatedScrollDelta = 0;
		if (!deltaY) return;

		setElementSelectionUiState('loading');
		setElementSelectionStatus('Scrolling…');
		vscode.postMessage({
			type: 'elementSelection.scroll',
			deltaY,
			generation: activeSelectionGeneration,
		});
	}, 100);
}, { passive: false });

// Also capture wheel on the image wrapper for better scroll hit area
elementSelectionImageWrapper.addEventListener('wheel', (e) => {
	if (!isElementSelectionInteractive()) return;
	e.preventDefault();
	e.stopPropagation();
}, { passive: false });

window.addEventListener('keydown', (e) => {
	if (!isElementSelectionActive()) return;
	if (e.key === 'Escape') {
		disableElementSelection();
	}
});

// Refresh screenshot when iframe viewport changes significantly during selection
const resizeObserver = new ResizeObserver(() => {
	if (!isElementSelectionActive()) return;
	const width = Math.max(1, iframe.clientWidth);
	const height = Math.max(1, iframe.clientHeight);
	if (Math.abs(width - lastSelectionViewport.width) < 50 && Math.abs(height - lastSelectionViewport.height) < 50) {
		return;
	}
	lastSelectionViewport = { width, height };
	if (resizeDebounce) {
		clearTimeout(resizeDebounce);
	}
	resizeDebounce = window.setTimeout(() => {
		resizeDebounce = undefined;
		requestSelectionScreenshot();
	}, 300);
});
resizeObserver.observe(iframe);
