/**
 * Parse IDS Tailwind v4 CSS into a token graph.
 *
 * Deliberately dependency-free. The IDS token surface is ~54 tokens across four
 * small authored files, so a full PostCSS pipeline would be more moving parts
 * than the problem needs, and `npm run tokens:qualify` should work before
 * `npm install` has ever run.
 *
 * Two things this must get right, because rules depend on them:
 *
 *  1. `var()` references are collected from the WHOLE stylesheet, not just from
 *     token declarations. F2 (`var(--colors-neutral-4)`) lives inside an
 *     `@utility` block, so a declarations-only scan would miss it entirely.
 *
 *  2. Layer precedence is modelled. `ids.css` declares tokens in `@theme`;
 *     `themes/<brand>.css` overrides them in `@layer base`. Tailwind v4 orders
 *     `theme` before `base`, so the brand file wins. Without this, every brand
 *     colour resolves to the wrong value.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const DECL = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
const VAR_REF = /var\(\s*--([a-zA-Z0-9_-]+)/g;

/** Line number of a character offset, 1-indexed. */
function lineAt(text, index) {
	let line = 1;
	for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
	return line;
}

/**
 * Which at-rule block encloses this offset. Tracks `@theme` / `@utility` /
 * `@layer` by brace depth so we can tell a token declaration from a utility
 * that merely consumes tokens.
 */
function contextAt(text, index) {
	const before = text.slice(0, index);
	const opens = [...before.matchAll(/@(theme|utility|layer|keyframes|media|supports)\b([^{;]*)\{/g)];
	let depth = 0;
	const stack = [];
	let cursor = 0;

	for (const m of opens) {
		for (let i = cursor; i < m.index; i++) {
			if (before[i] === '{') depth++;
			else if (before[i] === '}') {
				depth--;
				while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
			}
		}
		cursor = m.index + m[0].length;
		depth++;
		stack.push({ name: m[1], args: m[2].trim(), depth });
	}
	for (let i = cursor; i < before.length; i++) {
		if (before[i] === '{') depth++;
		else if (before[i] === '}') {
			depth--;
			while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
		}
	}
	return stack[stack.length - 1] ?? null;
}

/** Infer a token's category from its name. */
export function categorize(name) {
	if (name.startsWith('color-')) return 'color';
	if (name.startsWith('font-')) return 'typography';
	if (name.startsWith('text-') || name.startsWith('leading-') || name.startsWith('tracking-')) return 'typography';
	if (name.startsWith('spacing') || name.startsWith('space-')) return 'spacing';
	if (name.startsWith('breakpoint-') || name.startsWith('screen-')) return 'breakpoint';
	if (name.startsWith('container-')) return 'breakpoint';
	if (name.startsWith('animate-')) return 'animation';
	if (name.startsWith('aspect-')) return 'layout';
	if (name.startsWith('radius-') || name.startsWith('rounded-')) return 'border';
	if (name.startsWith('shadow-')) return 'elevation';
	return 'other';
}

/**
 * Tier, per the brief's primitive / semantic / component split.
 *
 * IDS is a single flat tier by design, so almost everything lands on
 * 'primitive'. That is not a parser limitation — it is the finding. The
 * declared tier here is only a hypothesis; rule NM-03 asks Jev to classify
 * tier from meaning, precisely because prefixes cannot settle it.
 */
export function declaredTier(name, value) {
	if (name.endsWith('-default')) return 'primitive';
	if (/^color-(primary|secondary)-\d+$/.test(name)) return 'semantic';
	if (/^color-(error|info|success|warning)-\d+$/.test(name)) return 'semantic';
	if (/^color-neutral-\d+$/.test(name)) return 'primitive';
	if (typeof value === 'string' && value.includes('var(')) return 'semantic';
	return 'primitive';
}

/** Parse one CSS file into declarations and every var() reference it contains. */
export function parseFile(path) {
	const text = readFileSync(path, 'utf8');
	const file = basename(path);
	const declarations = [];
	const references = [];

	for (const m of text.matchAll(DECL)) {
		const ctx = contextAt(text, m.index);
		// Skip declarations inside @keyframes — they are animation state, not tokens.
		if (ctx?.name === 'keyframes') continue;
		declarations.push({
			name: m[1],
			value: m[2].trim().replace(/\s+/g, ' '),
			file,
			line: lineAt(text, m.index),
			layer: ctx?.name === 'theme' ? 'theme' : ctx?.name === 'layer' ? ctx.args.split(/\s+/)[0] || 'base' : 'other',
			context: ctx?.name ?? 'root',
			inlineTheme: ctx?.name === 'theme' && ctx.args.includes('inline'),
		});
	}

	for (const m of text.matchAll(VAR_REF)) {
		const ctx = contextAt(text, m.index);
		references.push({
			name: m[1],
			file,
			line: lineAt(text, m.index),
			context: ctx ? `@${ctx.name}${ctx.args ? ' ' + ctx.args : ''}` : 'root',
		});
	}

	return { file, path, text, declarations, references };
}

/**
 * Build a token graph for one brand theme.
 *
 * `themeFiles` are applied after `baseFiles` so `@layer base` overrides
 * `@theme`, matching Tailwind v4's layer order. Pass no theme file to model the
 * un-themed default, which is what rule ST-05 inspects.
 */
export function buildGraph({ baseFiles = [], themeFiles = [], theme = 'none' } = {}) {
	const parsed = [...baseFiles, ...themeFiles].map(parseFile);
	const tokens = new Map();
	const references = [];
	const shadowed = [];

	for (const f of parsed) {
		references.push(...f.references);
		for (const d of f.declarations) {
			const existing = tokens.get(d.name);
			if (existing) shadowed.push({ name: d.name, from: existing, to: d });
			tokens.set(d.name, {
				name: d.name,
				value: d.value,
				file: d.file,
				line: d.line,
				layer: d.layer,
				context: d.context,
				category: categorize(d.name),
				tier: declaredTier(d.name, d.value),
				overrides: existing ?? null,
			});
		}
	}

	return { theme, tokens, references, shadowed, files: parsed };
}
