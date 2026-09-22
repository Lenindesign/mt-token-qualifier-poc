/**
 * Class D — MotorTrend brand rules and migration rules.
 *
 * MT-02 / MT-03 are set-membership checks against the approved scales in
 * config/qualifier.json. MG-01 is the rule that keeps this system useful after
 * the IDS → HDS migration rather than being invalidated by it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { STATUS } from '../parse/resolve.mjs';
import { isColor } from '../color/wcag.mjs';

/**
 * MT-02 — Spacing resolves to the approved scale.
 *
 * IDS defines no spacing tokens at all: it inherits Tailwind's default scale.
 * That makes a naive "all spacing is on-scale" check pass by vacuum, which
 * would be worse than useless — it would report green on a category that has
 * no governance whatsoever. So this reports the coverage gap instead.
 */
export function MT02({ graph, config, components }) {
	const spacingTokens = [...graph.tokens.values()].filter((t) => t.category === 'spacing');
	const approved = config.approvedScales.spacing;

	if (!spacingTokens.length && !approved.length) {
		const arbitrary = [];
		for (const [name, component] of components) {
			for (const raw of component.rawValues) {
				if (/(px|rem|em)$/.test(raw.value)) arbitrary.push({ component: name, ...raw });
			}
		}

		return [
			{
				verdict: 'WARN',
				rule: 'MT-02',
				ruleName: 'Approved spacing scale',
				subject: 'spacing (category)',
				subjectType: 'category',
				actual: 'no spacing tokens defined in IDS; Tailwind defaults used implicitly',
				expected: 'an explicit, governed MotorTrend spacing scale',
				explanation:
					`IDS declares zero spacing tokens — \`ids.css\` has no \`--spacing-*\` — so spacing is whatever Tailwind's default scale provides. ` +
					`This rule therefore cannot pass or fail: there is no MotorTrend spacing scale to check against. Reporting PASS here would be passing by vacuum. ` +
					(arbitrary.length
						? `In the scanned components, ${arbitrary.length} arbitrary dimension values bypass the scale entirely: ` +
							arbitrary
								.slice(0, 6)
								.map((a) => `\`${a.value}\` in ${a.component}`)
								.join(', ') +
							`${arbitrary.length > 6 ? ` (+${arbitrary.length - 6} more)` : ''}.`
						: `No arbitrary dimension values were found in the scanned components, which is a good sign.`),
				recommendation:
					`Decide whether MotorTrend adopts Tailwind's default scale explicitly (declare it as tokens so it can be governed and themed) ` +
					`or adopts HDS's 12-step \`--dim-space-*\` scale ahead of migration. Until then, spacing is ungoverned by construction.`,
				affects: [...new Set(arbitrary.map((a) => a.component))],
			},
		];
	}

	// Once a scale exists, check membership.
	const results = [];
	for (const token of spacingTokens) {
		const ok = approved.includes(token.value);
		results.push({
			verdict: ok ? 'PASS' : 'FAIL',
			rule: 'MT-02',
			ruleName: 'Approved spacing scale',
			subject: `--${token.name}`,
			subjectType: 'token',
			location: `${token.file}:${token.line}`,
			actual: token.value,
			expected: `one of: ${approved.join(', ')}`,
			explanation: ok
				? `\`--${token.name}\` is on the approved spacing scale.`
				: `\`--${token.name}\` is \`${token.value}\`, which is not a step on the approved scale. Off-scale spacing accumulates into visual inconsistency that is very hard to unpick later.`,
			recommendation: ok ? 'None.' : `Snap to the nearest approved step, or add this value to the scale deliberately.`,
			affects: [],
		});
	}
	return results;
}

/**
 * MT-03 — Breakpoints match the approved set.
 *
 * IDS and HDS disagree on 3 of 5 breakpoints. That is a silent,
 * layout-breaking mismatch for the migration, not a rename, so it is worth its
 * own rule rather than a footnote.
 */
export function MT03({ config }) {
	const ids = config.approvedScales.breakpoints;
	const hds = config.approvedScales.hdsBreakpoints;
	const results = [];

	const toPx = (v) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
	const idsPx = Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, toPx(v)]));
	const hdsPx = Object.fromEntries(Object.entries(hds).map(([k, v]) => [k, toPx(v)]));

	const idsValues = new Set(Object.values(idsPx));
	const shared = Object.entries(hdsPx).filter(([, px]) => idsValues.has(px));
	const divergent = Object.entries(hdsPx).filter(([, px]) => !idsValues.has(px));

	results.push({
		verdict: divergent.length ? 'FAIL' : 'PASS',
		rule: 'MT-03',
		ruleName: 'Approved breakpoints',
		subject: 'breakpoints (category)',
		subjectType: 'category',
		actual: `IDS: ${Object.entries(ids)
			.map(([k, v]) => `${k}=${v} (${idsPx[k]}px)`)
			.join(', ')}`,
		expected: `HDS: ${Object.entries(hds)
			.map(([k, v]) => `${k}=${v}`)
			.join(', ')}`,
		explanation: divergent.length
			? `IDS and the HDS migration target agree on only ${shared.length} of ${Object.keys(hdsPx).length} breakpoints ` +
				`(${shared.map(([k, px]) => `${k}=${px}px`).join(', ')}). They diverge on ${divergent.map(([k, px]) => `${k}=${px}px`).join(', ')}. ` +
				`Because both systems use the same generic names at different values, a component moved from IDS to HDS will change its responsive behaviour with no code diff to review — the most dangerous kind of migration bug.`
			: 'IDS and HDS breakpoints agree.',
		recommendation: divergent.length
			? `Agree one breakpoint set before migrating any component. If HDS's set wins, audit every IDS responsive variant first: \`sm\` moves 640px → 320px and \`xl\` moves 1280px → 1440px, which will reflow layouts.`
			: 'None.',
		affects: [],
	});

	return results;
}

/**
 * MG-01 — Every IDS token has a declared HDS mapping, and mapped pairs agree.
 *
 * Without a mapping table this cannot fail, so it reports what a mapping would
 * have to cover, sized against the real HDS surface. This is the rule that
 * survives the migration: as the table fills in, it turns into a real gate.
 */
export function MG01({ graph, resolutions, repoRoot, config }) {
	const mappingPath = `${repoRoot}/tools/token-qualifier/config/ids-to-hds.json`;
	const hdsPath = config.sources.hdsCss;

	let hdsTokenCount = null;
	if (hdsPath && existsSync(hdsPath)) {
		const css = readFileSync(hdsPath, 'utf8');
		hdsTokenCount = new Set([...css.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1])).size;
	}

	if (!existsSync(mappingPath)) {
		const colorTokens = [...graph.tokens.values()].filter((t) => t.category === 'color' && !t.name.endsWith('-default'));
		return [
			{
				verdict: 'WARN',
				rule: 'MG-01',
				ruleName: 'IDS → HDS migration mapping',
				subject: `${graph.tokens.size} IDS tokens`,
				subjectType: 'graph',
				actual: 'no mapping table exists',
				expected: 'config/ids-to-hds.json mapping every IDS token to its HDS equivalent',
				explanation:
					`No IDS → HDS mapping table was found, so migration coverage cannot be verified. ` +
					`Scale of the gap: IDS declares ${graph.tokens.size} tokens (${colorTokens.length} colour)` +
					(hdsTokenCount ? `, HDS declares ${hdsTokenCount}` : '') +
					`. The migration is therefore not a rename but roughly a ${hdsTokenCount ? Math.round(hdsTokenCount / graph.tokens.size) : '~55'}× increase in granularity plus a one-tier → three-tier restructure. ` +
					`Every IDS token will fan out into several HDS semantic and component tokens, and most HDS component tokens will have no IDS ancestor at all.`,
				recommendation:
					`Create \`config/ids-to-hds.json\` as \`{ "color-primary-2": ["comp-btn-primary-color-bg-solid", ...] }\`. ` +
					`Generate a first draft from component usage, then have design correct it. Once it exists, this rule becomes a real gate: it will fail when a token is added to IDS without a migration plan.`,
				affects: [],
			},
		];
	}

	const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
	const results = [];
	for (const [name, res] of resolutions) {
		const token = graph.tokens.get(name);
		if (token?.category !== 'color' || name.endsWith('-default')) continue;
		const mapped = mapping[name];
		results.push({
			verdict: mapped ? 'PASS' : 'WARN',
			rule: 'MG-01',
			ruleName: 'IDS → HDS migration mapping',
			subject: `--${name}`,
			subjectType: 'token',
			actual: mapped ? `mapped to ${[].concat(mapped).join(', ')}` : 'unmapped',
			expected: 'a declared HDS equivalent',
			explanation: mapped
				? `\`--${name}\` (${res.value}) has a declared HDS mapping.`
				: `\`--${name}\` has no declared HDS equivalent, so migrating it is undefined.`,
			recommendation: mapped ? 'None.' : `Add \`--${name}\` to config/ids-to-hds.json, or mark it as intentionally IDS-only.`,
			affects: [],
		});
	}
	return results;
}

/**
 * MT-05 — Approved typography.
 *
 * Each brand's font stack IS documented, in
 * `documentation/foundations/3-themes/<brand>.mdx`. I originally recorded this
 * as having no source of truth, which was wrong — I had read the colour docs
 * and not the theme docs.
 *
 * The rule checks two things, and the second is the interesting one:
 *
 *  1. Does every `--font-*` token resolve to the family the brand documents?
 *  2. Does the theme stylesheet actually SUPPLY those families?
 *
 * It does not. The theme CSS files carry colour only — zero font declarations —
 * so `@import '@motortrend/ids/tailwind/theme/motortrend'` gives a consumer the
 * palette and nothing else. The docs say so explicitly, so this is deliberate
 * rather than a bug, but nothing verifies a consuming application ever sets
 * them, and `--font-heading: var(--font-heading)` has no terminal fallback.
 * Forget it and every heading silently renders in the browser default.
 */
export function MT05({ graph, resolutions, config, byToken }) {
	const approved = config.approvedTypography?.[graph.theme];
	if (!approved) return [];

	const results = [];
	const fontTokens = [...graph.tokens.keys()].filter((n) => n.startsWith('font-'));
	const unsupplied = [];

	for (const name of fontTokens) {
		if (name === 'font-email') continue; // documented exception: email clients
		const res = resolutions.get(name);
		const expected = approved[name];
		const resolved = res?.status === STATUS.RESOLVED ? res.value.replace(/['"]/g, '') : null;

		if (!resolved) {
			unsupplied.push(name);
			continue;
		}
		if (!expected) continue; // brand does not document this slot; the fallback chain governs

		const ok = resolved.toLowerCase().includes(expected.toLowerCase());
		results.push({
			verdict: ok ? 'PASS' : 'FAIL',
			rule: 'MT-05',
			ruleName: 'Approved typography',
			subject: `--${name}`,
			subjectType: 'token',
			actual: resolved,
			expected,
			explanation: ok
				? `\`--${name}\` resolves to ${resolved}, the family documented for the ${graph.theme} brand.`
				: `\`--${name}\` resolves to ${resolved}, but the ${graph.theme} theme documentation specifies ${expected}.`,
			recommendation: ok ? 'None.' : `Set \`--${name}\` to ${expected}, per documentation/foundations/3-themes/.`,
			affects: [...(byToken.get(name) ?? [])],
		});
	}

	if (unsupplied.length) {
		const documented = Object.keys(approved).filter((k) => !k.startsWith('$'));
		results.push({
			verdict: 'WARN',
			rule: 'MT-05',
			ruleName: 'Approved typography',
			subject: `${graph.theme} font contract`,
			subjectType: 'category',
			actual: `${unsupplied.length} font tokens unresolved: ${unsupplied.map((n) => `--${n}`).join(', ')}`,
			expected: `the ${graph.theme} theme supplies ${documented.map((d) => `${d} = ${approved[d]}`).join(', ')}`,
			explanation:
				`\`themes/${graph.theme}.css\` contains **zero** font declarations — it sets colour only — so every \`--font-*\` token is unresolved inside this repository. ` +
				`The documentation states this is intentional ("Setting the color theme does not change font families"), and the consuming application is expected to set them. ` +
				`But nothing verifies that it does, and \`--font-heading: var(--font-heading)\` has no terminal fallback: if a consumer forgets, every heading renders in the browser default font with no error, no warning, and no failing test. ` +
				`For ${graph.theme} that means losing ${documented.map((d) => approved[d]).join(' and ')}.`,
			recommendation:
				`Either ship the font families in the theme stylesheet alongside the colours, or give each \`--font-*\` token a terminal fallback so a missed setup degrades to a chosen face rather than the UA default. ` +
				`Failing both, add a runtime assertion in the consuming application — this is the one part of the token contract that IDS cannot enforce for itself.`,
			affects: [...new Set(unsupplied.flatMap((n) => [...(byToken.get(n) ?? [])]))],
		});
	}

	return results;
}

export const motortrendRules = [MT02, MT03, MT05, MG01];
