/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ElementBoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ElementSelectionHoverData {
	boundingBox: ElementBoundingBox | null;
	label: string | null;
}

export interface ElementSelectionPickData {
	pageUrl: string;
	selector: string;
	selectorChain?: string[];
	elementData: {
		tagName: string;
		id: string | null;
		classes: string[];
		attributes: Record<string, string>;
		text: string;
		html: string;
	};
	boundingBox: ElementBoundingBox | null;
	viewport: { width: number; height: number };
	isSensitive: boolean;
}

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sanitizePoint = (x: number, y: number) => ({
	x: clampNumber(Math.round(x), 0, Number.MAX_SAFE_INTEGER),
	y: clampNumber(Math.round(y), 0, Number.MAX_SAFE_INTEGER),
});

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
				// eslint-disable-next-line no-undef
				if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(value));
			} catch {
				// ignore
			}
			return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\\\' + ch);
		};

		const __cssStringEscape = (value) => String(value).replace(/\\\\/g, '\\\\\\\\').replace(/\"/g, '\\\\\"');

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

			// Include other data-* and aria-* attributes (lower priority)
			try {
				for (const a of Array.from(el.attributes || [])) {
					if (!a?.name) continue;
					const n = String(a.name);
					if (!n.startsWith('data-') && !n.startsWith('aria-')) continue;
					if (priority.includes(n)) continue;
					if (n === 'data-v-app') continue; // common Vue marker, rarely stable
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
			// Heuristic: avoid obviously generated classes
			if (/[0-9]{4,}/.test(c)) return false;
			if (/^css-/.test(c)) return false;
			if (/^sc-/.test(c)) return false;
			return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
		};

		const __selectorWithinRoot = (el, root) => {
			const tag = (el.tagName || '').toLowerCase();

			// 1) ID
			if (el.id) {
				const idSel = '#' + __cssEscape(el.id);
				if (__isUnique(root, idSel)) return idSel;
			}

			// 2) Stable attributes
			for (const [name, value] of __getStableAttributes(el)) {
				const sel = '[' + name + '=\"' + __cssStringEscape(value) + '\"]';
				if (__isUnique(root, sel)) return sel;
				if (tag) {
					const tagSel = tag + sel;
					if (__isUnique(root, tagSel)) return tagSel;
				}
			}

			// 3) Class combos
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

				// Try pairs
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

			// 4) Fallback path with nth-of-type
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

				// Walk out of shadow roots (if any)
				try {
					// eslint-disable-next-line no-undef
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
			// Always strip value attributes as a safety measure
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
