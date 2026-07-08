/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Picker scripts executed inside the embedded `WebContentsView` for the element selector.
 *
 * The hover/pick logic is a faithful port of the original
 * `extensions/simple-browser/src/automation/elementSelection.ts` so selector output stays
 * compatible with the existing `void.addBrowserElementSelection` chat integration.
 *
 * Each builder returns a self-contained JavaScript string that resolves to a plain JSON
 * value when evaluated via `webContents.executeJavaScript`.
 */

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const sanitizePoint = (x: number, y: number) => ({
	x: clampNumber(Math.round(x), 0, Number.MAX_SAFE_INTEGER),
	y: clampNumber(Math.round(y), 0, Number.MAX_SAFE_INTEGER),
});

/**
 * Returns a script that, evaluated in the page, returns the bounding box + label of the
 * element currently under `(x, y)`. Used to drive the hover highlight shown in the editor
 * toolbar while the picker is active.
 */
export const buildHoverScript = (x: number, y: number): string => {
	const p = sanitizePoint(x, y);

	return `(() => {
		const __x = ${p.x};
		const __y = ${p.y};
		const __el = document.elementFromPoint(__x, __y);
		if (!__el) return { boundingBox: null, label: null };
		const __rect = __el.getBoundingClientRect();
		const __tag = (__el.tagName || '').toLowerCase();
		const __id = (__el.id ? '#' + __el.id : '');
		return {
			boundingBox: { x: __rect.x, y: __rect.y, width: __rect.width, height: __rect.height },
			label: __tag + __id
		};
	})()`;
};

/**
 * Returns a script that, evaluated in the page, returns the full element pick payload
 * (selector, attributes, html, bounding box, sensitivity flag) for the element under
 * `(x, y)`. Output shape matches `IElementPickData` in `browserView.ts`.
 */
export const buildPickScript = (x: number, y: number): string => {
	const p = sanitizePoint(x, y);

	return `(() => {
		const __MAX_TEXT = 500;
		const __MAX_HTML = 2000;

		const __truncate = (str, maxLen) => {
			if (!str) return '';
			const s = String(str);
			return s.length > maxLen ? s.slice(0, maxLen) : s;
		};

		const __cssEscape = (value) => {
			try {
				if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(value));
			} catch {
				// ignore
			}
			return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\\\' + ch);
		};

		const __cssStringEscape = (value) => String(value).replace(/\\\\/g, '\\\\\\\\').replace(/\\\"/g, '\\\\\\\"');

		const __isUnique = (root, selector) => {
			try {
				return root.querySelectorAll(selector).length === 1;
			} catch {
				return false;
			}
		};

		const __getStableAttributes = (el) => {
			const attrs = [];
			const priority = [
				'data-testid',
				'data-test-id',
				'data-test',
				'data-qa',
				'data-cy',
				'data-id',
				'data-automation-id',
				'aria-label',
				'name',
				'role',
				'title',
				'alt',
				'placeholder'
			];

			for (const name of priority) {
				const val = el.getAttribute?.(name);
				if (val && String(val).trim() && String(val).length <= 120) {
					attrs.push([name, String(val)]);
				}
			}

			try {
				for (const a of Array.from(el.attributes || [])) {
					if (!a?.name) continue;
					const n = String(a.name);
					if (!n.startsWith('data-') && !n.startsWith('aria-')) continue;
					if (priority.includes(n)) continue;
					if (n === 'data-v-app') continue;
					const v = a.value;
					if (!v || String(v).length > 120) continue;
					attrs.push([n, String(v)]);
				}
			} catch {
				// ignore
			}

			return attrs;
		};

		const __isStableClass = (className) => {
			if (!className) return false;
			const c = String(className);
			if (c.length < 2 || c.length > 40) return false;
			if (/[0-9]{4,}/.test(c)) return false;
			if (/^css-/.test(c)) return false;
			if (/^sc-/.test(c)) return false;
			return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
		};

		const __selectorWithinRoot = (el, root) => {
			const tag = (el.tagName || '').toLowerCase();

			if (el.id) {
				const idSel = '#' + __cssEscape(el.id);
				if (__isUnique(root, idSel)) return idSel;
			}

			for (const [name, value] of __getStableAttributes(el)) {
				const sel = '[' + name + '=\"' + __cssStringEscape(value) + '\"]';
				if (__isUnique(root, sel)) return sel;
				if (tag) {
					const tagSel = tag + sel;
					if (__isUnique(root, tagSel)) return tagSel;
				}
			}

			const classes = Array.from(el.classList || []).filter(__isStableClass).slice(0, 6);
			if (classes.length) {
				for (const c of classes) {
					const sel = '.' + __cssEscape(c);
					if (__isUnique(root, sel)) return sel;
					if (tag) {
						const tagSel = tag + sel;
						if (__isUnique(root, tagSel)) return tagSel;
					}
				}

				for (let i = 0; i < classes.length; i++) {
					for (let j = i + 1; j < classes.length; j++) {
						const sel = '.' + __cssEscape(classes[i]) + '.' + __cssEscape(classes[j]);
						if (__isUnique(root, sel)) return sel;
						if (tag) {
							const tagSel = tag + sel;
							if (__isUnique(root, tagSel)) return tagSel;
						}
					}
				}
			}

			const parts = [];
			let curr = el;
			while (curr && curr !== root && curr.nodeType === Node.ELEMENT_NODE) {
				const t = (curr.tagName || '').toLowerCase();
				if (!t) break;
				let part = t;

				if (curr.id) {
					part += '#' + __cssEscape(curr.id);
					parts.unshift(part);
					const candidate = parts.join(' > ');
					if (__isUnique(root, candidate)) return candidate;
					curr = curr.parentElement;
					continue;
				}

				const parent = curr.parentElement;
				if (parent) {
					const sameTagSiblings = Array.from(parent.children).filter((c) => c.tagName === curr.tagName);
					if (sameTagSiblings.length > 1) {
						const idx = sameTagSiblings.indexOf(curr) + 1;
						part += ':nth-of-type(' + idx + ')';
					}
				}

				parts.unshift(part);
				const candidate = parts.join(' > ');
				if (__isUnique(root, candidate)) return candidate;
				curr = curr.parentElement;
			}

			return parts.join(' > ') || tag || '';
		};

		const __getSelectorChain = (el) => {
			const chain = [];
			let curr = el;

			while (curr) {
				const root = curr.getRootNode ? curr.getRootNode() : document;
				chain.unshift(__selectorWithinRoot(curr, root));

				try {
					if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
						curr = root.host;
						continue;
					}
				} catch {
					// ignore
				}

				break;
			}

			return chain.filter(Boolean);
		};

		const __x = ${p.x};
		const __y = ${p.y};
		const __el = document.elementFromPoint(__x, __y);
		const __viewport = { width: window.innerWidth || 0, height: window.innerHeight || 0 };

		if (!__el) {
			return {
				pageUrl: location.href,
				selector: '',
				selectorChain: [],
				elementData: { tagName: '', id: null, classes: [], attributes: {}, text: '', html: '' },
				boundingBox: null,
				viewport: __viewport,
				isSensitive: false
			};
		}

		const __tagName = (__el.tagName || '').toLowerCase();
		const __id = __el.id ? String(__el.id) : null;
		const __classes = Array.from(__el.classList || []).map(String);

		const __isSensitive = __tagName === 'input' && String(__el.getAttribute?.('type') || (__el.type || '')).toLowerCase() === 'password';

		const __attributes = {};
		try {
			for (const a of Array.from(__el.attributes || [])) {
				if (!a?.name) continue;
				const n = String(a.name);
				if (n === 'value') continue;
				if (!n.startsWith('data-') && !n.startsWith('aria-')) continue;
				__attributes[n] = String(a.value ?? '');
			}
		} catch {
			// ignore
		}

		const __text = __isSensitive ? '' : __truncate((__el.innerText || __el.textContent || '').trim(), __MAX_TEXT);
		let __safeOuterHTML = __isSensitive ? '' : String((__el.outerHTML || '')).trim();
		if (!__isSensitive) {
			try {
				const __tag = (__el.tagName || '').toLowerCase();
				if (__tag === 'input') {
					const __clone = __el.cloneNode(true);
					if (__clone && __clone.removeAttribute) __clone.removeAttribute('value');
					__safeOuterHTML = String((__clone && __clone.outerHTML) || __safeOuterHTML);
				} else if (__tag === 'textarea') {
					const __clone = __el.cloneNode(true);
					if (__clone) {
						__clone.textContent = '';
						if (__clone.removeAttribute) __clone.removeAttribute('value');
					}
					__safeOuterHTML = String((__clone && __clone.outerHTML) || __safeOuterHTML);
				}
			} catch {
				// ignore
			}
			__safeOuterHTML = __safeOuterHTML.replace(/\\svalue=\"[^\"]*\"/gi, '');
		}
		const __html = __truncate(__safeOuterHTML, __MAX_HTML);

		const __selectorChain = __getSelectorChain(__el);
		const __selector = __selectorChain.length ? __selectorChain.join(' >>> ') : '';
		const __rect = __el.getBoundingClientRect();

		return {
			pageUrl: location.href,
			selector: __selector,
			selectorChain: __selectorChain,
			elementData: {
				tagName: __tagName,
				id: __id,
				classes: __classes,
				attributes: __attributes,
				text: __text,
				html: __html
			},
			boundingBox: { x: __rect.x, y: __rect.y, width: __rect.width, height: __rect.height },
			viewport: __viewport,
			isSensitive: __isSensitive
		};
	})()`;
};

/**
 * Installs a live overlay (highlight box + crosshair cursor + Esc handler) into the page.
 * While the overlay is active, the page intercepts mousemove to update the highlight and
 * click to capture the picked element, then removes itself. Esc cancels.
 *
 * `callbackName` is the name of a `window` function injected beforehand that receives the
 * JSON payloads `{ type: 'hover', ... } | { type: 'pick', ... } | { type: 'cancel' }`.
 *
 * Returns the script string to execute once to install the overlay.
 */
export const buildPickerOverlayScript = (callbackName: string): string => {
	const cb = JSON.stringify(callbackName);

	return `(() => {
		const __cb = window[${cb}];
		if (typeof __cb !== 'function') return false;

		if (window.__orbitPickerActive) {
			return true;
		}
		window.__orbitPickerActive = true;

		const __box = document.createElement('div');
		__box.id = '__orbit-picker-box';
		__box.style.cssText = [
			'position:fixed',
			'z-index:2147483647',
			'pointer-events:none',
			'border:2px solid #007acc',
			'background:rgba(0,122,204,0.12)',
			'border-radius:2px',
			'transition:all 60ms linear',
			'display:none',
			'left:0',
			'top:0',
			'width:0',
			'height:0'
		].join(';');
		(document.body || document.documentElement).appendChild(__box);

		const __label = document.createElement('div');
		__label.id = '__orbit-picker-label';
		__label.style.cssText = [
			'position:fixed',
			'z-index:2147483647',
			'pointer-events:none',
			'background:#007acc',
			'color:#fff',
			'font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
			'padding:2px 6px',
			'border-radius:2px',
			'max-width:60vw',
			'overflow:hidden',
			'text-overflow:ellipsis',
			'white-space:nowrap',
			'display:none',
			'left:0',
			'top:0'
		].join(';');
		(document.body || document.documentElement).appendChild(__label);

		const __cssEscape = (value) => {
			try { if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(value)); } catch {}
			return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\\\' + ch);
		};

		const __describe = (el) => {
			if (!el) return null;
			const tag = (el.tagName || '').toLowerCase();
			const id = el.id ? '#' + __cssEscape(el.id) : '';
			const cls = Array.from(el.classList || []).filter(c => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)).slice(0, 2).map(c => '.' + c).join('');
			const label = (tag + id + cls) || tag || 'element';
			const rect = el.getBoundingClientRect();
			return { label, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		};

		const __move = (e) => {
			const info = __describe(document.elementFromPoint(e.clientX, e.clientY));
			if (!info) {
				__box.style.display = 'none';
				__label.style.display = 'none';
				__cb({ type: 'hover', boundingBox: null, label: null });
				return;
			}
			__box.style.display = 'block';
			__box.style.left = info.x + 'px';
			__box.style.top = info.y + 'px';
			__box.style.width = info.width + 'px';
			__box.style.height = info.height + 'px';
			__label.style.display = 'block';
			__label.style.left = info.x + 'px';
			__label.style.top = Math.max(0, info.y - 18) + 'px';
			__label.textContent = info.label;
			__cb({ type: 'hover', boundingBox: { x: info.x, y: info.y, width: info.width, height: info.height }, label: info.label });
		};

		let __stopped = false;
		const __stop = (cancel) => {
			if (__stopped) return;
			__stopped = true;
			window.__orbitPickerActive = false;
			document.removeEventListener('mousemove', __move, true);
			document.removeEventListener('keydown', __key, true);
			document.removeEventListener('click', __click, true);
			if (__box.parentNode) __box.parentNode.removeChild(__box);
			if (__label.parentNode) __label.parentNode.removeChild(__label);
			try { document.documentElement.style.cursor = ''; } catch {}
			__cb({ type: cancel ? 'cancel' : 'pick', x: __lastX, y: __lastY });
		};

		// Chain onto whatever cleanup the callback bridge already installed (it only drops
		// the page->main callback reference) so external teardown (toolbar toggle-off,
		// pane dispose) also removes these listeners instead of leaking them forever.
		const __priorCleanup = window.__orbitPickerCleanup;
		window.__orbitPickerCleanup = () => {
			__stop(true);
			try { if (typeof __priorCleanup === 'function') __priorCleanup(); } catch {}
		};

		let __lastX = 0;
		let __lastY = 0;

		const __click = (e) => {
			e.preventDefault();
			e.stopPropagation();
			__lastX = e.clientX;
			__lastY = e.clientY;
			__stop(false);
		};

		const __key = (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				__stop(true);
			}
		};

		document.addEventListener('mousemove', __move, true);
		document.addEventListener('keydown', __key, true);
		// Use capture + preventDefault so the page never receives the picking click.
		document.addEventListener('click', __click, true);

		// Cursor cue without permanently restyling interactive elements.
		try {
			document.documentElement.style.cursor = 'crosshair';
		} catch {}

		return true;
	})()`;
};

/**
 * Removes the picker overlay from the page (e.g. when the editor pane is closed or the
 * picker is toggled off programmatically).
 */
export const buildPickerTeardownScript = (): string => `(() => {
	if (typeof window.__orbitPickerCleanup === 'function') {
		// Routes through the picker's own __stop(), which removes the mousemove/keydown/click
		// capture listeners it installed — not just the visual box/label. Without this, a
		// cancelled-via-toolbar pick leaves a capture-phase click listener on the page that
		// preventDefault/stopPropagation's every future click.
		try { window.__orbitPickerCleanup(); } catch {}
		return true;
	}
	if (!window.__orbitPickerActive) return false;
	window.__orbitPickerActive = false;
	const __box = document.getElementById('__orbit-picker-box');
	if (__box && __box.parentNode) __box.parentNode.removeChild(__box);
	const __label = document.getElementById('__orbit-picker-label');
	if (__label && __label.parentNode) __label.parentNode.removeChild(__label);
	try { document.documentElement.style.cursor = ''; } catch {}
	return true;
})()`;

/**
 * Best-effort guard run after page loads to clear a stale picker flag left behind when
 * navigation interrupted an in-flight pick without running teardown.
 */
export const buildPickerGuardScript = (): string => `(() => {
	if (!window.__orbitPickerActive) {
		return false;
	}
	const hasBox = !!document.getElementById('__orbit-picker-box');
	const hasCleanup = typeof window.__orbitPickerCleanup === 'function';
	if (!hasBox && !hasCleanup) {
		window.__orbitPickerActive = false;
		try { document.documentElement.style.cursor = ''; } catch {}
		return true;
	}
	return false;
})()`;
