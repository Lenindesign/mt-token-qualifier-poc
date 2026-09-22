/**
 * WCAG 2.x contrast math. Zero dependencies.
 *
 * Every function here is deterministic and offline. This module is the reason
 * accessibility rules are Class D (code) and not Class J (Jev): contrast is
 * arithmetic, and a model would only make it slower and probabilistic.
 *
 * selfTest() runs on import in the CLI so a regression in this file cannot
 * silently change every accessibility verdict in the report.
 */

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() into [r,g,b,a]. */
export function parseColor(input) {
	if (typeof input !== 'string') return null;
	const value = input.trim().toLowerCase();

	if (value === 'transparent') return [0, 0, 0, 0];
	if (value === 'white') return [255, 255, 255, 1];
	if (value === 'black') return [0, 0, 0, 1];

	const hex = value.match(/^#([0-9a-f]{3,8})$/);
	if (hex) {
		const h = hex[1];
		if (h.length === 3 || h.length === 4) {
			const [r, g, b, a] = [...h].map((c) => parseInt(c + c, 16));
			return [r, g, b, h.length === 4 ? a / 255 : 1];
		}
		if (h.length === 6 || h.length === 8) {
			const n = parseInt(h.slice(0, 6), 16);
			const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
			return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, a];
		}
		return null;
	}

	const fn = value.match(/^rgba?\(([^)]+)\)$/);
	if (fn) {
		const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length < 3) return null;
		const [r, g, b] = parts.slice(0, 3).map((p) => {
			const n = parseFloat(p);
			return p.endsWith('%') ? Math.round((n / 100) * 255) : Math.round(n);
		});
		const a = parts[3] === undefined ? 1 : parseFloat(parts[3]) > 1 ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
		return [r, g, b, a];
	}

	return null;
}

/** Is this string a color we can reason about? */
export function isColor(input) {
	return parseColor(input) !== null;
}

export function toHex([r, g, b]) {
	return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Composite a foreground over an opaque background.
 * Tailwind's `/50` alpha modifiers mean a "disabled" color is rarely the
 * literal token value, so state-differentiation rules need this.
 */
export function composite(fg, bg, alphaOverride) {
	const f = parseColor(fg);
	const b = parseColor(bg);
	if (!f || !b) return null;
	const a = alphaOverride ?? f[3];
	return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
}

const channel = (v) => {
	const c = v / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance. */
export function luminance(color) {
	const rgb = Array.isArray(color) ? color : parseColor(color);
	if (!rgb) return null;
	return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/**
 * WCAG contrast ratio, 1..21. Both arguments must be opaque; composite() first
 * if either carries alpha.
 */
export function contrast(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	if (la === null || lb === null) return null;
	const hi = Math.max(la, lb);
	const lo = Math.min(la, lb);
	return (hi + 0.05) / (lo + 0.05);
}

export const THRESHOLDS = {
	/** SC 1.4.3 normal text */
	AA_NORMAL: 4.5,
	/** SC 1.4.3 large text (>=18.66px bold or >=24px) */
	AA_LARGE: 3,
	/** SC 1.4.6 enhanced normal text */
	AAA_NORMAL: 7,
	/** SC 1.4.11 non-text contrast: UI components, focus indicators, graphics */
	NON_TEXT: 3,
};

/**
 * Guards against the exact bug that corrupted this module's first draft:
 * `n & 255 >= 0` parses as `n & 1`, silently destroying the blue channel and
 * shifting every ratio in the report. Known-good values, checked on import.
 */
export function selfTest() {
	const cases = [
		['#000000', '#ffffff', 21.0],
		['#ffffff', '#ffffff', 1.0],
		['#767676', '#ffffff', 4.54],
		['#777777', '#ffffff', 4.48],
		['#0000ff', '#ffffff', 8.59], // isolates the blue channel
		['#00ff00', '#ffffff', 1.37], // isolates green
		['#ff0000', '#ffffff', 4.0], // isolates red
	];
	const failures = [];
	for (const [fg, bg, expected] of cases) {
		const actual = contrast(fg, bg);
		if (actual === null || Math.abs(actual - expected) > 0.01) {
			failures.push(`contrast(${fg}, ${bg}) = ${actual?.toFixed(2) ?? 'null'}, expected ${expected}`);
		}
	}
	if (failures.length) {
		throw new Error('WCAG self-test FAILED — every contrast result is suspect:\n  ' + failures.join('\n  '));
	}
	return true;
}
