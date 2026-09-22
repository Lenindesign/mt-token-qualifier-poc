#!/usr/bin/env node
/**
 * IDS → HDS migration analysis.
 *
 * This is the proof-of-concept deliverable for the migration decision, not a
 * gate. It answers the question the team actually has to plan against: what
 * does moving MotorTrend from Ignition to the Hearst Design System actually
 * cost, and where does it break?
 *
 * The headline it exists to make unavoidable: the migration is not a rename.
 * Ignition names colours by position in a ramp; HDS names them by role
 * (`bg-brand`, `txt-default`, `border-subtle`). One IDS token fans out into
 * many HDS roles, and most HDS tokens have no IDS ancestor at all.
 *
 *   node tools/token-qualifier/bin/migrate.mjs            human report
 *   node tools/token-qualifier/bin/migrate.mjs --json     machine-readable
 *
 * Needs a local `fre` checkout for the HDS build; degrades with a clear
 * message when absent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrast, isColor, THRESHOLDS } from '../src/color/wcag.mjs';
import { buildGraph } from '../src/parse/ids-css.mjs';
import { resolveAll, STATUS } from '../src/parse/resolve.mjs';
import { loadConfig } from '../src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const asJson = process.argv.includes('--json');

const config = loadConfig(repoRoot);
const hdsPath = config.sources.hdsCss;

if (!existsSync(hdsPath)) {
	process.stderr.write(
		`HDS build not found at:\n  ${hdsPath}\n\n` +
			`This analysis compares Ignition against the Hearst Design System, so it needs a local\n` +
			`fre checkout with node_modules installed. Set sources.hdsCss in config/qualifier.json\n` +
			`if yours lives elsewhere.\n`,
	);
	process.exit(2);
}

/* ---------------------------------------------------------------- parse HDS */

const hdsCss = readFileSync(hdsPath, 'utf8');
const H = new Map();
for (const m of hdsCss.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g)) H.set(m[1], m[2].trim());

function hdsResolve(name, depth = 0) {
	if (depth > 16) return null;
	const v = H.get(name);
	if (!v) return null;
	const m = v.match(/var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*([^)]*))?\)/);
	if (!m) return v;
	const inner = hdsResolve(m[1], depth + 1);
	if (inner) return inner;
	return m[2] ? m[2].trim() : null;
}

/** Every token this one passes through, for brand-reachability. */
function hdsChain(name, seen = new Set()) {
	if (seen.has(name)) return [];
	seen.add(name);
	const v = H.get(name);
	if (!v) return [];
	const refs = [...v.matchAll(/var\(\s*--([a-zA-Z0-9_-]+)/g)].map((x) => x[1]);
	return refs.flatMap((r) => [r, ...hdsChain(r, seen)]);
}

const isBrandHook = (n) => /^color-palette-brand-\d+$/.test(n);
const brandReachable = new Set();
for (const k of H.keys()) if (hdsChain(k).some(isBrandHook)) brandReachable.add(k);

/* ---------------------------------------------------------------- parse IDS */

const theme = config.primaryTheme;
const graph = buildGraph({
	baseFiles: config.sources.base.map((f) => `${repoRoot}/${f}`),
	themeFiles: (config.sources.themes[theme] ?? []).map((f) => `${repoRoot}/${f}`),
	theme,
});
const idsRes = resolveAll(graph);

const idsColors = [...idsRes.entries()]
	.filter(([n, r]) => graph.tokens.get(n)?.category === 'color' && !n.endsWith('-default') && r.status === STATUS.RESOLVED && /^#/.test(r.value ?? ''))
	.map(([n, r]) => ({ name: n, value: r.value.toLowerCase() }));

/* ---------------------------------------------------------------- matching */

const rgb = (h) => {
	const s = h.replace('#', '');
	const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s.slice(0, 6);
	const n = parseInt(full, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const dist = (a, b) => {
	const [x, y, z] = rgb(a);
	const [p, q, r] = rgb(b);
	return Math.sqrt((x - p) ** 2 + (y - q) ** 2 + (z - r) ** 2);
};
const hueSpread = (h) => {
	const [r, g, b] = rgb(h);
	return Math.max(r, g, b) - Math.min(r, g, b);
};

// HDS primitives are the honest comparison target: the semantic layer is
// role-named, so value-matching against it would invent mappings that mean
// nothing.
const hdsPrimitives = [...H.keys()]
	.filter((k) => /^_palette-/.test(k))
	.map((k) => ({ name: k, value: (hdsResolve(k) ?? '').toLowerCase() }))
	.filter((x) => /^#/.test(x.value));

const matches = idsColors.map((t) => {
	const ranked = hdsPrimitives.map((h) => ({ ...h, d: dist(t.value, h.value) })).sort((a, b) => a.d - b.d);
	const best = ranked[0];
	return {
		ids: t.name,
		idsValue: t.value,
		hds: best?.name ?? null,
		hdsValue: best?.value ?? null,
		delta: best ? Math.round(best.d) : null,
		exact: best ? best.d < 1 : false,
		tint: hueSpread(t.value),
	};
});

/* ---------------------------------------------------------------- report */

const analysis = {
	generatedAt: new Date().toISOString(),
	theme,
	scale: {
		idsTokens: graph.tokens.size,
		hdsTokens: H.size,
		ratio: Math.round(H.size / graph.tokens.size),
	},
	brandReach: {
		hooks: [...H.keys()].filter(isBrandHook).length,
		reachable: brandReachable.size,
		total: H.size,
		percent: Number(((brandReachable.size / H.size) * 100).toFixed(1)),
	},
	colorMatches: matches,
	exactMatches: matches.filter((m) => m.exact).length,
	categories: {
		color: { ids: idsColors.length, hds: [...H.keys()].filter((k) => k.startsWith('color-')).length },
		typography: { ids: 0, hds: [...H.keys()].filter((k) => k.startsWith('type-')).length, note: 'IDS typography is utility classes, not tokens' },
		spacing: { ids: 0, hds: [...H.keys()].filter((k) => /^dim-space-/.test(k)).length, note: 'IDS has no spacing tokens at all' },
		component: { ids: 0, hds: [...H.keys()].filter((k) => k.startsWith('comp-')).length, note: 'IDS has no component tier' },
	},
	breakpoints: (() => {
		const ids = config.approvedScales.breakpoints;
		const hds = config.approvedScales.hdsBreakpoints;
		const px = (v) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
		const idsPx = new Set(Object.values(ids).map(px));
		const agree = Object.entries(hds).filter(([, v]) => idsPx.has(px(v)));
		return { ids, hds, agreeing: agree.length, total: Object.keys(hds).length };
	})(),
};

if (asJson) {
	process.stdout.write(JSON.stringify(analysis, null, 2) + '\n');
	process.exit(0);
}

const bar = (label, n, total) => {
	const w = Math.max(1, Math.round((n / total) * 40));
	return `  ${label.padEnd(14)}${String(n).padStart(5)} / ${total}  ${'█'.repeat(w)}`;
};

const out = [];
out.push(`IDS → HDS Migration Analysis      theme: ${theme}      ${analysis.generatedAt.slice(0, 10)}`);
out.push('='.repeat(78));
out.push('');
out.push('1. SCALE — this is a restructure, not a rename');
out.push('');
out.push(`  Ignition   ${analysis.scale.idsTokens} tokens, one flat tier of numbered ramps`);
out.push(`  Hearst     ${analysis.scale.hdsTokens} tokens, three tiers named by role`);
out.push(`  Ratio      ~${analysis.scale.ratio}x more granular`);
out.push('');
out.push('  Ignition names colours by POSITION (primary-2, neutral-4).');
out.push('  Hearst names them by ROLE (bg-brand, txt-default, border-subtle).');
out.push('  So one IDS token fans out into many HDS roles, and most HDS tokens');
out.push('  have no IDS ancestor at all. There is no 1:1 mapping to write.');
out.push('');
out.push('2. BRAND REACH — how much of HDS MotorTrend actually controls');
out.push('');
out.push(`  Brand hooks in HDS               ${analysis.brandReach.hooks}`);
out.push(`  Tokens reachable through them    ${analysis.brandReach.reachable} of ${analysis.brandReach.total}  (${analysis.brandReach.percent}%)`);
out.push('');
out.push(`  Injecting MotorTrend's palette into HDS reaches ${analysis.brandReach.percent}% of its tokens.`);
out.push(`  The other ${analysis.brandReach.total - analysis.brandReach.reachable} are fixed: HDS's own neutrals, status colours and`);
out.push('  component tokens. Migrating means accepting those, or negotiating');
out.push('  overrides that HDS has no mechanism for today.');
out.push('');
out.push('3. COLOUR EQUIVALENCE — nearest HDS primitive to each IDS colour');
out.push('');
out.push(`  Exact matches: ${analysis.exactMatches} of ${matches.length}`);
out.push('');
out.push('  IDS token           value     nearest HDS primitive   value      Δ   note');
for (const m of matches) {
	// Hue spread only means something for the neutral ramp: a saturated red is
	// *supposed* to have a wide spread, so flagging it as "tinted" would be
	// noise. On a grey it is the finding — MotorTrend's mid-ramp neutrals carry
	// a deliberate blue cast that HDS's hue-neutral greys do not.
	const isNeutral = /^color-neutral-/.test(m.ids);
	const note = m.exact
		? 'exact'
		: isNeutral && m.tint > 6
			? `blue cast (${m.tint}) — HDS grey is hue-neutral`
			: m.delta > 30
				? 'no close match'
				: m.delta > 10
					? 'visibly different'
					: 'close';
	out.push(
		`  ${m.ids.padEnd(20)}${m.idsValue.padEnd(10)}${(m.hds ?? '—').padEnd(24)}${(m.hdsValue ?? '—').padEnd(11)}${String(m.delta ?? '').padStart(3)}   ${note}`,
	);
}
out.push('');
out.push("  MotorTrend's mid-ramp neutrals carry a deliberate blue cast; HDS's greys");
out.push('  are hue-neutral. Adopting HDS loses that cast unless it is negotiated');
out.push('  back in — and neutrals are not brand-reachable, so it cannot be themed.');
out.push('');
out.push('4. CATEGORY COVERAGE — what has to be created rather than mapped');
out.push('');
for (const [k, v] of Object.entries(analysis.categories)) {
	out.push(bar(k, v.ids, v.hds) + (v.note ? `   ← ${v.note}` : ''));
}
out.push('');
out.push('  Typography, spacing and component tokens are not migrations. They are');
out.push('  net-new design work: 0 → ' + (analysis.categories.typography.hds + analysis.categories.spacing.hds + analysis.categories.component.hds) + ' tokens with no Ignition ancestor.');
out.push('');
out.push('5. BREAKPOINTS — the silent one');
out.push('');
out.push(`  Agreeing: ${analysis.breakpoints.agreeing} of ${analysis.breakpoints.total}`);
out.push('');
out.push('  name    IDS        HDS');
const px = (v) => (v.endsWith('rem') ? parseFloat(v) * 16 + 'px' : v);
for (const [k, v] of Object.entries(analysis.breakpoints.ids)) {
	const hdsKeys = Object.entries(analysis.breakpoints.hds);
	const same = hdsKeys.find(([, hv]) => px(hv) === px(v));
	out.push(`  ${k.padEnd(8)}${px(v).padEnd(11)}${same ? same[0] + ' (same)' : 'no equivalent'}`);
}
out.push('');
out.push('  Both systems use the same generic names at different values, so a');
out.push('  component moved across changes its responsive behaviour with nothing');
out.push('  in the diff to review.');
out.push('');
out.push('='.repeat(78));
out.push('WHAT THIS MEANS FOR THE MIGRATION PLAN');
out.push('');
out.push('  · A token-for-token mapping table is the wrong artifact. The work is');
out.push('    re-expressing MotorTrend intent in HDS role vocabulary.');
out.push(`  · Only ${analysis.brandReach.percent}% of HDS is brand-controllable, so the first decision is`);
out.push("    whether MotorTrend accepts HDS's neutrals and status colours as-is.");
out.push('  · Typography, spacing and component tiers are new design work, not');
out.push('    ports. Budget for design time, not just engineering time.');
out.push('  · Breakpoints must be agreed before any component moves.');
out.push('');

process.stdout.write(out.join('\n') + '\n');
