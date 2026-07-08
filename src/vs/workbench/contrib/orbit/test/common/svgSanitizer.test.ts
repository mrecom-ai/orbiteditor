/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orbit Editor. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { sanitizeSvgForRender, _isDangerousTag, _isDangerousUrlAttr } from '../../browser/react/src/markdown/svgSanitizer.js';

suite('sanitizeSvgForRender (C9)', () => {
	test('returns empty string for empty input', () => {
		assert.strictEqual(sanitizeSvgForRender(''), '');
	});

	test('passes through a benign Mermaid-style SVG', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g><path d="M0 0L100 100" stroke="black"/></g></svg>';
		const out = sanitizeSvgForRender(svg);
		// Should still contain the structural elements.
		assert.ok(out.includes('<svg'));
		assert.ok(out.includes('<path'));
		// Should not have introduced any script tag.
		assert.ok(!out.toLowerCase().includes('<script'));
	});

	test('strips <script> tag with content', () => {
		const svg = '<svg><script>alert(1)</script><path d="x"/></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!out.toLowerCase().includes('<script'));
		assert.ok(!out.toLowerCase().includes('alert'));
	});

	test('strips <foreignObject>', () => {
		const svg = '<svg><foreignObject><div onclick="x">hi</div></foreignObject></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!out.toLowerCase().includes('foreignobject'));
	});

	test('strips on* event handler attributes', () => {
		const svg = '<svg><g onclick="alert(1)" onload="x()" onbegin="y"><path d="M0 0"/></g></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!/\bonclick\b/i.test(out));
		assert.ok(!/\bonload\b/i.test(out));
		assert.ok(!/\bonbegin\b/i.test(out));
	});

	test('strips javascript: URLs from href / xlink:href', () => {
		const svg = '<svg><a href="javascript:alert(1)" xlink:href="javascript:bad()"><text>go</text></a></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!/javascript:/i.test(out));
	});

	test('preserves safe href like http(s):', () => {
		const svg = '<svg><a href="https://example.com"><text>x</text></a></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(out.includes('https://example.com'));
	});

	test('handles self-closing dangerous tags', () => {
		const svg = '<svg><script src="evil.js" /><path d="x"/></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!out.toLowerCase().includes('<script'));
	});

	test('handles mixed case dangerous tags', () => {
		const svg = '<svg><SCRIPT>alert(1)</SCRIPT></svg>';
		const out = sanitizeSvgForRender(svg);
		assert.ok(!out.toLowerCase().includes('<script'));
	});

	test('_isDangerousTag and _isDangerousUrlAttr exports', () => {
		assert.strictEqual(_isDangerousTag('script'), true);
		assert.strictEqual(_isDangerousTag('IFRAME'), true);
		assert.strictEqual(_isDangerousTag('div'), false);
		assert.strictEqual(_isDangerousUrlAttr('href'), true);
		assert.strictEqual(_isDangerousUrlAttr('xlink:href'), true);
		assert.strictEqual(_isDangerousUrlAttr('src'), false);
	});
});
