/**
 * Map IDS component styling back to tokens.
 *
 * IDS styles with `cva()` lists of Tailwind utility classes, so a token is used
 * by a component only indirectly: `bg-primary-2` implies `--color-primary-2`.
 * Recovering those edges is what makes two things possible:
 *
 *  - component impact analysis ("what breaks if I change this token")
 *  - AX-03, which needs to pair a focus ring with its offset colour, and can
 *    only do so by reading the class list
 *
 * This is intentionally a lexical scan rather than a TS parse: class strings in
 * `cva()` are literals, and a parser would add a dependency without adding
 * accuracy for this input.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Utility prefixes that take a colour token, longest-first so `ring-offset-` beats `ring-`. */
const COLOR_UTILITIES = [
	'ring-offset-',
	'outline-offset-',
	'decoration-',
	'placeholder-',
	'divide-',
	'border-x-',
	'border-y-',
	'border-t-',
	'border-r-',
	'border-b-',
	'border-l-',
	'shadow-',
	'accent-',
	'caret-',
	'stroke-',
	'border-',
	'outline-',
	'ring-',
	'fill-',
	'from-',
	'via-',
	'text-',
	'bg-',
	'to-',
];

/** Known IDS colour ramp roots, so `text-pretty` is not mistaken for a colour. */
const COLOR_ROOTS = /^(primary|secondary|neutral|error|info|success|warning)-\d+$/;

/**
 * Signals that a component renders a focusable element. Used to scope AX-03:
 * a focus-indicator rule applied to a non-interactive component is noise.
 */
const INTERACTIVE_MARKERS = [
	/<(button|a|input|select|textarea)\b/,
	/\bas=['"](button|a|input)['"]/,
	/\brole=['"](button|link|checkbox|radio|switch|tab|menuitem|option|slider)['"]/,
	/\bonClick\b/,
	/\btabIndex\b/,
	/'cursor-pointer'/,
	/\bhref\b/,
];

/**
 * Split a Tailwind class into its variant chain and base utility.
 * `focus-visible:dark:ring-secondary-3` → { variants: ['focus-visible','dark'], base: 'ring-secondary-3' }
 */
export function splitVariants(cls) {
	const parts = cls.split(':');
	return { variants: parts.slice(0, -1), base: parts[parts.length - 1] };
}

/**
 * Resolve a class to a token reference, or null if it is not colour-bearing.
 * Handles Tailwind's `/alpha` modifier, which matters because a disabled state
 * is usually `token/50` rather than the literal token.
 */
export function classToToken(cls) {
	const { variants, base } = splitVariants(cls);

	for (const prefix of COLOR_UTILITIES) {
		if (!base.startsWith(prefix)) continue;
		let rest = base.slice(prefix.length);
		if (!rest) return null;

		let alpha = null;
		const slash = rest.indexOf('/');
		if (slash !== -1) {
			const raw = rest.slice(slash + 1);
			rest = rest.slice(0, slash);
			const n = Number(raw);
			if (!Number.isNaN(n)) alpha = n / 100;
		}

		if (!COLOR_ROOTS.test(rest)) return null;

		return {
			class: cls,
			utility: prefix.replace(/-$/, ''),
			token: `color-${rest}`,
			alpha,
			variants,
			state: variants.find((v) => /^(hover|focus|focus-visible|active|disabled|aria-disabled|visited)$/.test(v)) ?? 'default',
			scheme: variants.includes('dark') ? 'dark' : 'light',
		};
	}
	return null;
}

/** Extract every string literal from a source file, where cva class lists live. */
function stringLiterals(source) {
	const out = [];
	for (const m of source.matchAll(/'([^'\n\\]*)'|"([^"\n\\]*)"/g)) {
		const v = m[1] ?? m[2];
		if (v) out.push(v);
	}
	return out;
}

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(variants|styles)\.(tsx?|jsx?)$/.test(entry) || /\.tsx$/.test(entry)) out.push(full);
	}
	return out;
}

/**
 * Scan components for token usage.
 *
 * @returns {{ components: Map<string, Usage>, byToken: Map<string, Set<string>> }}
 */
export function scanComponents(componentsDir, { include = null } = {}) {
	const components = new Map();
	const byToken = new Map();

	let files;
	try {
		files = walk(componentsDir);
	} catch {
		return { components, byToken };
	}

	for (const file of files) {
		const rel = relative(componentsDir, file);
		const component = rel.split(sep)[0];
		if (include && !include.includes(component)) continue;

		const source = readFileSync(file, 'utf8');
		const isStory = /\.stories\./.test(rel);

		const entry = components.get(component) ?? {
			name: component,
			files: new Set(),
			storyFiles: new Set(),
			usages: [],
			rawValues: [],
			interactive: false,
			interactiveInStories: false,
		};

		// Stories are demo code, not shipped styling. Counting their classes would
		// inflate impact analysis and, worse, report demo-only hardcoded values as
		// component defects — Card's twelve `88px` literals all live in stories.
		// They are still useful as evidence of how a component is actually used.
		if (isStory) {
			entry.storyFiles.add(rel);
			if (INTERACTIVE_MARKERS.some((re) => re.test(source))) entry.interactiveInStories = true;
			components.set(component, entry);
			continue;
		}

		entry.files.add(rel);

		// Does this component render something focusable? AX-03 must only apply to
		// interactive components: demanding a focus ring on a text-rendering
		// component like Typography is a false positive that trains people to
		// ignore the rule.
		if (INTERACTIVE_MARKERS.some((re) => re.test(source))) entry.interactive = true;

		for (const literal of stringLiterals(source)) {
			// cva lists are one class per literal, but handle space-separated too.
			for (const cls of literal.split(/\s+/)) {
				if (!cls) continue;
				const usage = classToToken(cls);
				if (!usage) continue;
				entry.usages.push({ ...usage, file: rel });
				if (!byToken.has(usage.token)) byToken.set(usage.token, new Set());
				byToken.get(usage.token).add(component);
			}

			// Arbitrary values bypass tokens entirely — the R7 class of problem.
			for (const m of literal.matchAll(/\[(#[0-9a-fA-F]{3,8}|-?\d+(?:\.\d+)?(?:px|rem|em))\]/g)) {
				entry.rawValues.push({ value: m[1], class: literal, file: rel });
			}
		}

		components.set(component, entry);
	}

	return { components, byToken };
}

/**
 * Pair focus-ring colours with their offset colours, per colour scheme.
 * AX-03 needs both halves to evaluate SC 1.4.11, and they are declared as two
 * independent classes that only mean something together.
 */
export function focusPairs(usage) {
	const pairs = new Map();
	for (const u of usage) {
		if (u.state !== 'focus-visible' && u.state !== 'focus') continue;
		const key = u.scheme;
		const pair = pairs.get(key) ?? { scheme: key, ring: null, offset: null };
		if (u.utility === 'ring-offset') pair.offset = u;
		else if (u.utility === 'ring' || u.utility === 'outline') pair.ring = u;
		pairs.set(key, pair);
	}
	return [...pairs.values()].filter((p) => p.ring || p.offset);
}
