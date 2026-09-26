#!/usr/bin/env node
/**
 * Contrast verification for every Hearst brand, resolved from DTCG source.
 *
 * Brand values reach production through ConfigDS at request time, so they are
 * never present in a build and nothing in the pipeline can check them. This
 * resolves each brand statically — the same merge and reference chain the
 * runtime performs — so contrast can be verified in CI.
 *
 * It produces a snapshot FOR VERIFICATION ONLY. Nothing here is served, and
 * the delivery model is deliberately untouched.
 *
 *   node bin/verify-brands.mjs --tokens <dir>            human report
 *   node bin/verify-brands.mjs --tokens <dir> --json     machine-readable
 *   node bin/verify-brands.mjs --tokens <dir> --brand X  one brand, in detail
 *
 * Pairings below come from the role names themselves — HDS states what a token
 * is for (`txt.knockout` belongs on `bg.knockout`), so which colour lands on
 * which surface is read from the system rather than guessed at.
 */

import { resolve } from 'node:path';
import { contrast, THRESHOLDS } from '../src/color/wcag.mjs';
import { listBrands, mergeChain, resolveAll } from '../src/dtcg/resolve.mjs';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
	const hit = args.find((a) => a.startsWith(`--${n}=`));
	if (hit) return hit.slice(n.length + 3);
	const i = args.indexOf(`--${n}`);
	if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
	return args.includes(`--${n}`) ? true : d;
};

const dir = resolve(String(flag('tokens') || '/tmp/dtcg'));
const asJson = Boolean(flag('json'));
const only = flag('brand');

/**
 * Which foreground belongs on which surfaces, per the role vocabulary.
 * `large` marks pairs whose role implies display or non-text use, where the
 * 3:1 floor applies rather than 4.5:1.
 */
const PAIRS = [
	{ fg: 'txt.default', bg: ['bg.default', 'bg.page', 'bg.subtle', 'bg.light'] },
	{ fg: 'txt.default-hover', bg: ['bg.default-hover', 'bg.default'] },
	{ fg: 'txt.subtle', bg: ['bg.default', 'bg.page', 'bg.subtle'] },
	{ fg: 'txt.brand', bg: ['bg.default', 'bg.page'] },
	{ fg: 'txt.error', bg: ['bg.default', 'bg.page', 'bg.default-error'] },
	{ fg: 'txt.link', bg: ['bg.default', 'bg.page'] },
	{ fg: 'txt.link-hover', bg: ['bg.default', 'bg.page'] },
	{ fg: 'txt.on-brand', bg: ['bg.brand'] },
	{ fg: 'txt.knockout', bg: ['bg.knockout'] },
	{ fg: 'txt.knockout-subtle', bg: ['bg.knockout'] },
	{ fg: 'txt.knockout-error', bg: ['bg.knockout'] },
	{ fg: 'txt.discount', bg: ['bg.discount', 'bg.default'] },
	{ fg: 'icon.default', bg: ['bg.default', 'bg.page'], large: true },
	{ fg: 'icon.brand', bg: ['bg.default', 'bg.page'], large: true },
	{ fg: 'icon.knockout', bg: ['bg.knockout'], large: true },
	{ fg: 'border.default', bg: ['bg.default', 'bg.page'], large: true },
	{ fg: 'border.brand', bg: ['bg.default', 'bg.page'], large: true },
];

const hexOf = (r) => {
	const v = r?.value;
	if (!v) return null;
	if (typeof v === 'string') return /^#/.test(v) ? v : null;
	if (typeof v === 'object' && typeof v.hex === 'string') return v.hex;
	return null;
};

function verifyBrand(name) {
	const { merged, chain } = mergeChain(dir, name);
	const res = resolveAll(merged);
	const get = (role) => hexOf(res.get(`color.palette.${role}`));

	const findings = [];
	let checked = 0;
	for (const pair of PAIRS) {
		const fg = get(pair.fg);
		if (!fg) continue;
		for (const bgRole of pair.bg) {
			const bg = get(bgRole);
			if (!bg) continue;
			const ratio = contrast(fg, bg);
			if (ratio === null) continue;
			checked++;
			const floor = pair.large ? THRESHOLDS.AA_LARGE : THRESHOLDS.AA_NORMAL;
			if (ratio < floor) {
				findings.push({
					fg: pair.fg, fgHex: fg, bg: bgRole, bgHex: bg,
					ratio: Math.round(ratio * 100) / 100, required: floor,
				});
			}
		}
	}

	// Does this brand actually set a brand colour, or inherit the Hearst default?
	const brand1 = hexOf(res.get('color.palette.brand.1'));
	const brandSet = brand1 && brand1.toLowerCase() !== '#5539cc';

	return { name, chain, tokens: merged.size, checked, findings, brand1, brandSet };
}

const brands = only ? [String(only)] : listBrands(dir);
const results = brands.map(verifyBrand);

if (asJson) {
	process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), brands: results }, null, 2) + '\n');
	process.exit(results.some((r) => r.findings.length) ? 1 : 0);
}

const failing = results.filter((r) => r.findings.length);
const totalFindings = results.reduce((n, r) => n + r.findings.length, 0);
const noBrandColour = results.filter((r) => !r.brandSet);

console.log(`Brand contrast verification — ${results.length} brands, resolved from DTCG source\n`);
console.log(`  pairs checked per brand : ${results[0]?.checked ?? 0}`);
console.log(`  brands with a failure   : ${failing.length} of ${results.length}`);
console.log(`  total failures          : ${totalFindings}`);
console.log(`  brands with no brand colour set (inherit Hearst default): ${noBrandColour.length}`);

if (only || failing.length) {
	console.log('\n─────────────────────────────────────────────────────────────────────────');
	for (const r of (only ? results : failing)) {
		console.log(`\n${r.name}${r.brandSet ? '' : '   [no brand colour — inherits Hearst default #5539cc]'}`);
		if (!r.findings.length) { console.log('  no contrast failures'); continue; }
		for (const f of r.findings.sort((a, b) => a.ratio - b.ratio)) {
			console.log(
				`  ${String(f.ratio).padStart(5)}:1  need ${f.required}  ` +
				`${f.fg} ${f.fgHex}  on  ${f.bg} ${f.bgHex}`,
			);
		}
	}
}

if (!only && noBrandColour.length) {
	console.log('\n─────────────────────────────────────────────────────────────────────────');
	console.log('\nBrands inheriting the Hearst default brand colour:');
	for (const r of noBrandColour) console.log('  ' + r.name);
}

process.exit(totalFindings ? 1 : 0);
