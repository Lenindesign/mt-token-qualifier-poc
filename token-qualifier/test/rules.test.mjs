/**
 * Test suite. Zero dependencies — `node --test tools/token-qualifier/test/`.
 *
 * Two jobs:
 *
 *  1. Prove each rule fires on a controlled invalid fixture AND stays quiet on
 *     the matching valid one. A rule that only ever fails is as useless as one
 *     that never does.
 *
 *  2. Pin the behaviours that were actually wrong in development, so they
 *     cannot regress. Those are marked REGRESSION and each one corresponds to a
 *     real false positive this tool produced before it was fixed.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildGraph } from '../src/parse/ids-css.mjs';
import { resolveAll, resolveToken, STATUS } from '../src/parse/resolve.mjs';
import { classToToken, focusPairs } from '../src/parse/variants.mjs';
import { composite, contrast, luminance, selfTest, toHex } from '../src/color/wcag.mjs';
import { interpret } from '../src/jev/questions.mjs';
import { ST01, ST02, ST03 } from '../src/rules/structure.mjs';
import { AX01_AX02, AX03 } from '../src/rules/accessibility.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (p) => resolve(here, 'fixtures', p);

const EXTERNAL = { prefixes: ['radix-', 'tw-'], names: [] };

function ctxFor(files, { surfaces, components } = {}) {
	const graph = buildGraph({ baseFiles: files.map(fixture), theme: 'test' });
	const resolutions = resolveAll(graph);
	return {
		graph,
		resolutions,
		byToken: new Map(),
		components: components ?? new Map(),
		repoRoot: here,
		config: {
			external: EXTERNAL,
			surfaces: surfaces ?? { light: [], dark: [], literals: [] },
			foreground: { excludeCategories: [], excludeSuffixes: ['-default'] },
			components: { include: [] },
			sources: { components: 'fixtures', generatedConfig: 'does-not-exist.ts' },
		},
	};
}

const verdicts = (results, rule) => results.filter((r) => r.rule === rule).map((r) => r.verdict);

// ---------------------------------------------------------------- WCAG math

describe('WCAG contrast math', () => {
	it('passes its own self-test on import', () => {
		assert.equal(selfTest(), true);
	});

	it('matches known reference ratios', () => {
		assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
		assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
		assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
	});

	// REGRESSION: `n & 255 >= 0` parses as `n & 1`, which silently destroyed the
	// blue channel and shifted every ratio in the report. The first draft of the
	// contrast module shipped with exactly this bug.
	it('REGRESSION: reads the blue channel correctly', () => {
		assert.equal(contrast('#0000ff', '#ffffff').toFixed(2), '8.59');
		assert.ok(luminance('#0000ff') > 0, 'pure blue must have non-zero luminance');
		assert.notEqual(luminance('#0000ff'), luminance('#000000'));
	});

	it('is symmetric', () => {
		assert.equal(contrast('#c11b17', '#ffffff'), contrast('#ffffff', '#c11b17'));
	});

	it('composites alpha over a background', () => {
		assert.equal(toHex(composite('#c11b17', '#ffffff', 0.5)), '#e08d8b');
		assert.equal(toHex(composite('#000000', '#ffffff', 0)), '#ffffff');
		assert.equal(toHex(composite('#000000', '#ffffff', 1)), '#000000');
	});

	it('parses shorthand, alpha hex and rgb()', () => {
		assert.equal(toHex(composite('#fff', '#000', 1)), '#ffffff');
		assert.equal(contrast('#ffffffff', '#000000').toFixed(2), '21.00');
		assert.equal(contrast('rgb(255,255,255)', '#000000').toFixed(2), '21.00');
	});
});

// ------------------------------------------------------------------ parsing

describe('parser', () => {
	it('collects declarations and var() references', () => {
		const graph = buildGraph({ baseFiles: [fixture('valid/minimal.css')], theme: 'test' });
		assert.equal(graph.tokens.size, 5);
		assert.ok(graph.tokens.has('color-primary-1'));
		assert.equal(graph.references.length, 1);
	});

	// REGRESSION: the real defect in IDS lives inside an `@utility` block, so a
	// declarations-only scan finds nothing at all.
	it('REGRESSION: finds var() references inside @utility blocks', () => {
		const graph = buildGraph({ baseFiles: [fixture('invalid/dangling.css')], theme: 'test' });
		const refs = graph.references.filter((r) => r.name === 'colors-neutral-4');
		assert.equal(refs.length, 2);
		assert.ok(refs.every((r) => r.context.includes('utility')));
	});

	it('does not treat @keyframes declarations as tokens', () => {
		const graph = buildGraph({ baseFiles: [resolve(here, '../../../src/tailwind/ids.css')], theme: 'test' });
		assert.ok(!graph.tokens.has('height'), '@keyframes properties must not become tokens');
	});

	it('applies theme overrides after base, matching Tailwind layer order', () => {
		const graph = buildGraph({
			baseFiles: [fixture('valid/minimal.css')],
			themeFiles: [fixture('invalid/theme-drift.css')],
			theme: 'drift',
		});
		assert.equal(resolveToken(graph, 'color-primary-1').value, '#ff0000');
		assert.equal(graph.shadowed.length, 1);
	});
});

describe('resolver', () => {
	it('follows an alias chain to a literal', () => {
		const graph = buildGraph({ baseFiles: [fixture('valid/minimal.css')], theme: 'test' });
		const r = resolveToken(graph, 'color-text-body');
		assert.equal(r.status, STATUS.RESOLVED);
		assert.equal(r.value, '#141416');
		assert.deepEqual(r.chain, ['color-text-body', 'color-neutral-1']);
	});

	it('terminates on a cycle instead of hanging', () => {
		const graph = buildGraph({ baseFiles: [fixture('invalid/circular.css')], theme: 'test' });
		const r = resolveToken(graph, 'color-a');
		assert.equal(r.status, STATUS.CIRCULAR);
	});

	// A self-referential custom property is invalid at computed-value time, so
	// the var() fallback applies. IDS's whole theming mechanism depends on this.
	it('uses the fallback for a self-referential property', () => {
		const graph = buildGraph({ baseFiles: [resolve(here, '../../../src/tailwind/ids.css')], theme: 'test' });
		const r = resolveToken(graph, 'color-primary-1');
		assert.equal(r.selfReferential, true);
		assert.equal(r.usedFallback, true);
		assert.equal(r.value, '#c11b17');
	});

	it('reports a dangling reference', () => {
		const graph = buildGraph({ baseFiles: [fixture('invalid/dangling.css')], theme: 'test' });
		assert.equal(resolveToken(graph, 'colors-neutral-4').status, STATUS.DANGLING);
	});
});

// -------------------------------------------------------------------- Class D

describe('ST-01 token reference resolves', () => {
	it('FAILs on a dangling reference and suggests the fix', () => {
		const results = ST01(ctxFor(['invalid/dangling.css']));
		assert.deepEqual(verdicts(results, 'ST-01'), ['FAIL', 'FAIL']);
		assert.match(results[0].recommendation, /--color-neutral-4/);
	});

	it('PASSes on a clean graph', () => {
		assert.deepEqual(verdicts(ST01(ctxFor(['valid/minimal.css'])), 'ST-01'), ['PASS']);
	});

	// REGRESSION: without an externals allowlist, ST-01 flagged Radix runtime
	// variables and buried the one genuine defect in noise.
	it('REGRESSION: ignores declared external variables', () => {
		const ctx = ctxFor(['invalid/dangling.css']);
		ctx.config.external = { prefixes: [], names: ['colors-neutral-4'] };
		assert.deepEqual(verdicts(ST01(ctx), 'ST-01'), ['PASS']);
	});
});

describe('ST-02 no circular references', () => {
	it('FAILs on a cycle', () => {
		assert.ok(verdicts(ST02(ctxFor(['invalid/circular.css'])), 'ST-02').includes('FAIL'));
	});
	it('PASSes on an acyclic graph', () => {
		assert.deepEqual(verdicts(ST02(ctxFor(['valid/minimal.css'])), 'ST-02'), ['PASS']);
	});
});

describe('ST-03 value format matches token type', () => {
	it('FAILs when a colour token holds a length and an aspect token holds a colour', () => {
		const v = verdicts(ST03(ctxFor(['invalid/type-mismatch.css'])), 'ST-03');
		assert.equal(v.filter((x) => x === 'FAIL').length, 2);
	});
	it('PASSes on correctly typed values', () => {
		assert.deepEqual(verdicts(ST03(ctxFor(['valid/minimal.css'])), 'ST-03'), ['PASS']);
	});
});

describe('AX-01 contrast, normal text', () => {
	const surfaces = { light: ['color-neutral-8'], dark: [], literals: [] };

	it('FAILs at 4.48:1', () => {
		const results = AX01_AX02(ctxFor(['invalid/low-contrast.css'], { surfaces }));
		const weak = results.find((r) => r.subject === '--color-text-weak' && r.rule === 'AX-01');
		assert.equal(weak.verdict, 'FAIL');
		assert.match(weak.actual, /4\.48/);
	});

	// Boundary guard: 4.54 and 4.48 sit either side of the threshold, so an
	// off-by-one or a rounding error would flip one of these two tests.
	it('PASSes at 4.54:1 — boundary, proves no off-by-one', () => {
		const results = AX01_AX02(ctxFor(['valid/contrast-boundary.css'], { surfaces }));
		const ok = results.find((r) => r.subject === '--color-text-ok' && r.rule === 'AX-01');
		assert.equal(ok.verdict, 'PASS');
	});

	it('FAILs the asymmetric case: safe on one surface, unsafe on another', () => {
		const results = AX01_AX02(
			ctxFor(['invalid/asymmetric-contrast.css'], { surfaces: { light: ['color-neutral-8', 'color-neutral-6'], dark: [], literals: [] } }),
		);
		const sec = results.find((r) => r.subject === '--color-text-secondary' && r.rule === 'AX-01');
		assert.equal(sec.verdict, 'FAIL');
		assert.match(sec.explanation, /silently inaccessible/);
	});

	// REGRESSION: the first draft compared every token against light AND dark
	// surfaces at once, which nothing can satisfy. It reported 26 failures out of
	// 26 tokens — pure noise. A dark-scheme colour must not fail for being dark.
	it('REGRESSION: judges a token within its own colour scheme', () => {
		const results = AX01_AX02(
			ctxFor(['valid/minimal.css'], { surfaces: { light: ['color-neutral-8'], dark: ['color-neutral-1'], literals: [] } }),
		);
		const fails = results.filter((r) => r.rule === 'AX-01' && r.verdict === 'FAIL');
		assert.equal(fails.length, 0, `expected no failures, got: ${fails.map((f) => f.subject).join(', ')}`);
	});
});

describe('AX-03 visible focus indicator', () => {
	const resolutions = new Map([
		['color-secondary-2', { status: STATUS.RESOLVED, value: '#33ccff' }],
		['color-secondary-1', { status: STATUS.RESOLVED, value: '#0865b4' }],
		['color-neutral-8', { status: STATUS.RESOLVED, value: '#fcfcfd' }],
	]);
	const base = { resolutions, config: { surfaces: { light: [], dark: [], literals: [] } } };

	const component = (usages, extra = {}) =>
		new Map([['Widget', { name: 'Widget', files: new Set(['w.tsx']), storyFiles: new Set(), usages, rawValues: [], interactive: true, interactiveInStories: false, ...extra }]]);

	it('FAILs a focus ring below 3:1 and suggests a same-ramp replacement', () => {
		const usages = [
			{ utility: 'ring', token: 'color-secondary-2', state: 'focus-visible', scheme: 'light', class: 'focus-visible:ring-secondary-2', alpha: null },
			{ utility: 'ring-offset', token: 'color-neutral-8', state: 'focus-visible', scheme: 'light', class: 'focus-visible:ring-offset-neutral-8', alpha: null },
		];
		const [r] = AX03({ ...base, components: component(usages) });
		assert.equal(r.verdict, 'FAIL');
		assert.match(r.actual, /1\.83:1/);
		assert.match(r.recommendation, /color-secondary-1.*same ramp/s);
	});

	it('PASSes a compliant focus ring', () => {
		const usages = [
			{ utility: 'ring', token: 'color-secondary-1', state: 'focus-visible', scheme: 'light', class: 'focus-visible:ring-secondary-1', alpha: null },
			{ utility: 'ring-offset', token: 'color-neutral-8', state: 'focus-visible', scheme: 'light', class: 'focus-visible:ring-offset-neutral-8', alpha: null },
		];
		const [r] = AX03({ ...base, components: component(usages) });
		assert.equal(r.verdict, 'PASS');
	});

	it('FAILs an interactive component with no focus styling at all', () => {
		const [r] = AX03({ ...base, components: component([]) });
		assert.equal(r.verdict, 'FAIL');
		assert.match(r.actual, /no focus-visible/);
	});

	// REGRESSION: demanding a focus ring on a text-rendering component is a false
	// positive, and false positives are how a rule gets switched off.
	it('REGRESSION: does not require a focus ring on a non-interactive component', () => {
		const [r] = AX03({ ...base, components: component([], { interactive: false }) });
		assert.equal(r.verdict, 'PASS');
		assert.match(r.actual, /not interactive/);
	});

	it('WARNs when only the stories are interactive', () => {
		const [r] = AX03({ ...base, components: component([], { interactive: false, interactiveInStories: true, storyFiles: new Set(['w.stories.tsx']) }) });
		assert.equal(r.verdict, 'WARN');
	});
});

// -------------------------------------------------------- component scanning

describe('Tailwind class → token mapping', () => {
	it('maps colour utilities, longest prefix first', () => {
		assert.equal(classToToken('bg-primary-2').token, 'color-primary-2');
		assert.equal(classToToken('focus-visible:ring-offset-neutral-8').utility, 'ring-offset');
		assert.equal(classToToken('focus-visible:ring-secondary-2').utility, 'ring');
	});

	it('captures the alpha modifier that disabled states rely on', () => {
		assert.equal(classToToken('aria-disabled:bg-primary-1/50').alpha, 0.5);
		assert.equal(classToToken('bg-primary-1').alpha, null);
	});

	it('records variant chains and colour scheme', () => {
		const u = classToToken('focus-visible:dark:ring-secondary-3');
		assert.equal(u.state, 'focus-visible');
		assert.equal(u.scheme, 'dark');
	});

	// REGRESSION: `text-pretty` and `border-solid` are not colours.
	it('REGRESSION: ignores non-colour utilities sharing a prefix', () => {
		assert.equal(classToToken('text-pretty'), null);
		assert.equal(classToToken('border-solid'), null);
		assert.equal(classToToken('bg-radial'), null);
	});

	it('pairs focus rings with their offsets per scheme', () => {
		const pairs = focusPairs([
			{ utility: 'ring', token: 'color-secondary-2', state: 'focus-visible', scheme: 'light' },
			{ utility: 'ring-offset', token: 'color-neutral-8', state: 'focus-visible', scheme: 'light' },
			{ utility: 'ring', token: 'color-secondary-3', state: 'focus-visible', scheme: 'dark' },
			{ utility: 'ring-offset', token: 'color-neutral-1', state: 'focus-visible', scheme: 'dark' },
		]);
		assert.equal(pairs.length, 2);
		assert.equal(pairs.find((p) => p.scheme === 'light').ring.token, 'color-secondary-2');
	});
});

// -------------------------------------------------------------------- Class J

describe('Jev answer interpretation', () => {
	it('treats a confident yes/no as a verdict', () => {
		assert.equal(interpret({ noul: 0.95 }, { threshold: 0.9, failOn: true }).verdict, 'FAIL');
		assert.equal(interpret({ noul: 0.02 }, { threshold: 0.9, failOn: true }).verdict, 'PASS');
	});

	// The single misreading that would quietly corrupt every judgment result.
	// A Noul of 0.5 means "yes and no equally likely", NOT "half compliant".
	it('REGRESSION: routes a mid-band Noul to a human, never scores it as partial', () => {
		const r = interpret({ noul: 0.5 }, { threshold: 0.9, failOn: true });
		assert.equal(r.verdict, 'REVIEW');
		assert.match(r.reason, /not a partial pass/);
		for (const p of [0.41, 0.45, 0.55, 0.59]) {
			assert.equal(interpret({ noul: p }, { threshold: 0.9, failOn: true }).verdict, 'REVIEW');
		}
	});

	it('routes a low-confidence Choice to a human', () => {
		const r = interpret({ choice: 'component', confidence: 0.4 }, { threshold: 0.85, failOn: false });
		assert.equal(r.verdict, 'REVIEW');
	});

	it('accepts a Choice above its gate', () => {
		const r = interpret({ choice: 'semantic', confidence: 0.95 }, { threshold: 0.85, failOn: false });
		assert.equal(r.verdict, 'JUDGED');
		assert.equal(r.choice, 'semantic');
	});

	it('returns SKIPPED when there is no answer', () => {
		assert.equal(interpret(null, { threshold: 0.9, failOn: true }).verdict, 'SKIPPED');
	});

	it('WARNs when a rule has no gate configured', () => {
		assert.equal(interpret({ choice: 'bare-index', confidence: 0.99 }, { threshold: null, failOn: false }).verdict, 'WARN');
	});
});
