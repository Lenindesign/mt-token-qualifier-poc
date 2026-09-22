/**
 * Class D — Structure rules (ST-01 … ST-06). Deterministic, offline.
 *
 * These run first because the accessibility rules cannot terminate until
 * ST-02 has proven the alias graph is acyclic, and cannot compute anything
 * until ST-01 has proven references resolve.
 */

import { readFileSync } from 'node:fs';
import { STATUS, resolveToken } from '../parse/resolve.mjs';
import { isColor } from '../color/wcag.mjs';

const pass = (o) => ({ verdict: 'PASS', ...o });
const warn = (o) => ({ verdict: 'WARN', ...o });
const fail = (o) => ({ verdict: 'FAIL', ...o });

function isExternal(name, external) {
	return external.prefixes.some((p) => name.startsWith(p)) || external.names.includes(name);
}

/**
 * ST-01 — Every var() reference resolves to a defined token.
 *
 * Scans the whole stylesheet, not just token declarations: the real defect in
 * IDS today lives inside an `@utility` block, which a declarations-only scan
 * would never see.
 */
export function ST01({ graph, config, byToken }) {
	const results = [];
	const seen = new Set();

	for (const ref of graph.references) {
		if (graph.tokens.has(ref.name)) continue;
		if (isExternal(ref.name, config.external)) continue;

		const key = `${ref.name}@${ref.file}:${ref.line}`;
		if (seen.has(key)) continue;
		seen.add(key);

		// A near-miss is almost always a typo, and naming it makes the fix obvious.
		const suggestion = [...graph.tokens.keys()].find(
			(t) => t === ref.name.replace(/^colors-/, 'color-') || t === ref.name.replace(/s-/, '-'),
		);

		results.push(
			fail({
				rule: 'ST-01',
				ruleName: 'Token reference resolves',
				subject: `--${ref.name}`,
				subjectType: 'token',
				location: `${ref.file}:${ref.line}`,
				actual: `var(--${ref.name}) — not defined anywhere`,
				expected: 'a defined token, or a declared external variable',
				explanation:
					`\`--${ref.name}\` is referenced in ${ref.context} at ${ref.file}:${ref.line} but is never declared. ` +
					`The declaration using it is inert: the browser discards it at computed-value time, so the property silently has no effect.` +
					(suggestion ? ` \`--${suggestion}\` exists and differs by one character, so this is very likely a typo.` : ''),
				recommendation: suggestion
					? `Change \`var(--${ref.name})\` to \`var(--${suggestion})\`.`
					: `Define \`--${ref.name}\`, or add it to \`external\` in config/qualifier.json if it is provided at runtime.`,
				affects: [...(byToken.get(ref.name) ?? [])],
			}),
		);
	}

	if (!results.length) {
		results.push(
			pass({
				rule: 'ST-01',
				ruleName: 'Token reference resolves',
				subject: `${graph.references.length} references`,
				subjectType: 'graph',
				actual: 'all references resolve',
				expected: 'all references resolve',
				explanation: `Checked ${graph.references.length} var() references across ${graph.files.length} files. All resolve to a defined token or a declared external variable.`,
				recommendation: 'None.',
				affects: [],
			}),
		);
	}
	return results;
}

/** ST-02 — No circular alias references. */
export function ST02({ graph, resolutions, byToken }) {
	const results = [];
	for (const [name, res] of resolutions) {
		if (res.status !== STATUS.CIRCULAR) continue;
		results.push(
			fail({
				rule: 'ST-02',
				ruleName: 'No circular references',
				subject: `--${name}`,
				subjectType: 'token',
				location: `${graph.tokens.get(name)?.file}:${graph.tokens.get(name)?.line}`,
				actual: res.chain.map((c) => `--${c}`).join(' → '),
				expected: 'an acyclic chain ending in a literal value',
				explanation:
					`The alias chain for \`--${name}\` returns to a token it already visited, so it never reaches a literal. ` +
					`CSS treats this as invalid at computed-value time, and it makes the token unusable and any tooling that walks the graph non-terminating.`,
				recommendation: 'Break the cycle: point one link in the chain at a primitive value instead of another alias.',
				affects: [...(byToken.get(name) ?? [])],
			}),
		);
	}
	if (!results.length) {
		results.push(
			pass({
				rule: 'ST-02',
				ruleName: 'No circular references',
				subject: `${resolutions.size} tokens`,
				subjectType: 'graph',
				actual: 'no cycles',
				expected: 'no cycles',
				explanation: `All ${resolutions.size} alias chains terminate. Deepest chain: ${Math.max(...[...resolutions.values()].map((r) => r.depth ?? 1))} hops.`,
				recommendation: 'None.',
				affects: [],
			}),
		);
	}
	return results;
}

/** ST-03 — A token's resolved value matches the type its name implies. */
export function ST03({ graph, resolutions, byToken }) {
	const results = [];
	const expectations = [
		{ test: (n) => n.startsWith('color-'), type: 'color', ok: (v) => isColor(v) || v === 'currentColor' || v === 'inherit' },
		{ test: (n) => n.startsWith('font-'), type: 'font-family', ok: (v) => /[a-zA-Z'"]/.test(v) },
		{ test: (n) => n.startsWith('aspect-'), type: 'ratio', ok: (v) => /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(v) },
		{ test: (n) => n.startsWith('animate-'), type: 'animation shorthand', ok: (v) => /\d/.test(v) },
	];

	for (const [name, res] of resolutions) {
		const rule = expectations.find((e) => e.test(name));
		if (!rule) continue;
		if (res.status !== STATUS.RESOLVED) continue; // ST-01/ST-05 own unresolved values
		if (rule.ok(res.value)) continue;

		const token = graph.tokens.get(name);
		results.push(
			fail({
				rule: 'ST-03',
				ruleName: 'Value format matches token type',
				subject: `--${name}`,
				subjectType: 'token',
				location: `${token.file}:${token.line}`,
				actual: res.value,
				expected: `a valid ${rule.type}`,
				explanation: `The name \`--${name}\` declares this a ${rule.type} token, but it resolves to \`${res.value}\`, which is not a valid ${rule.type}. Any CSS property bound to it will fail to apply.`,
				recommendation: `Correct the value to a valid ${rule.type}, or rename the token so its category matches what it holds.`,
				affects: [...(byToken.get(name) ?? [])],
			}),
		);
	}
	if (!results.length) {
		results.push(
			pass({
				rule: 'ST-03',
				ruleName: 'Value format matches token type',
				subject: 'typed tokens',
				subjectType: 'graph',
				actual: 'all typed values valid',
				expected: 'all typed values valid',
				explanation: 'Every colour, font, aspect and animation token resolves to a value valid for its declared type.',
				recommendation: 'None.',
				affects: [],
			}),
		);
	}
	return results;
}

/**
 * ST-04 — The theme override, the @theme default, and the generated config agree.
 *
 * IDS stores each brand hex in more than one place. `config.ts` is generated
 * from `ids.css` by `npm run generate:tw-config` (wired to `prebuild`), so it
 * drifts only when someone edits `ids.css` and commits without building — a
 * regenerate-and-diff check. But `themes/<brand>.css` is NOT read by that
 * generator, so brand values and their `-default` counterparts are genuinely
 * independent copies and can disagree silently.
 */
export function ST04({ graph, resolutions, config, repoRoot }) {
	const results = [];

	// Part 1: theme override vs. its @theme -default counterpart.
	for (const [name, res] of resolutions) {
		if (!/^color-(primary|secondary)-\d+$/.test(name)) continue;
		const defaultName = `${name}-default`;
		const defaultRes = resolutions.get(defaultName);
		if (!defaultRes || defaultRes.status !== STATUS.RESOLVED || res.status !== STATUS.RESOLVED) continue;

		const token = graph.tokens.get(name);
		const agree = res.value.toLowerCase() === defaultRes.value.toLowerCase();
		results.push(
			(agree ? pass : warn)({
				rule: 'ST-04',
				ruleName: 'Duplicated values agree',
				subject: `--${name}`,
				subjectType: 'token',
				location: `${token.file}:${token.line}`,
				actual: `${graph.theme} theme = ${res.value} · --${defaultName} = ${defaultRes.value}`,
				expected: agree ? 'the two copies agree' : `either equal values, or an intentional divergence`,
				explanation: agree
					? `\`--${name}\` is declared in two independent places — \`themes/${graph.theme}.css\` and the \`@theme\` fallback \`--${defaultName}\` — and they currently agree. Nothing enforces this: the generator behind config.ts reads only ids.css, so the theme files are hand-maintained.`
					: `\`--${name}\` resolves to ${res.value} under the ${graph.theme} theme but its un-themed fallback \`--${defaultName}\` is ${defaultRes.value}. A consumer that loads IDS without the brand stylesheet gets a different colour.`,
				recommendation: agree
					? 'None, but treat this rule as the guard: it will catch the first drift.'
					: `Align \`--${defaultName}\` with the brand value, or confirm the divergence is intended and record it.`,
				affects: [],
			}),
		);
	}

	// Part 2: is the generated config still in sync with its source?
	try {
		const configSource = readFileSync(`${repoRoot}/${config.sources.generatedConfig}`, 'utf8');
		const drifted = [];
		for (const [name, res] of resolutions) {
			const m = name.match(/^color-([a-z]+)-(\d+)-default$/) ?? name.match(/^color-([a-z]+)-(\d+)$/);
			if (!m || res.status !== STATUS.RESOLVED || !isColor(res.value)) continue;
			// config.ts nests as `ramp: { '1': '#hex' }`; check the hex is present at all.
			if (!configSource.toLowerCase().includes(res.value.toLowerCase())) drifted.push(`--${name} = ${res.value}`);
		}
		results.push(
			(drifted.length ? warn : pass)({
				rule: 'ST-04',
				ruleName: 'Generated config in sync',
				subject: config.sources.generatedConfig,
				subjectType: 'file',
				actual: drifted.length ? `${drifted.length} values absent from the generated config` : 'all resolved colours present',
				expected: 'generated config regenerated from ids.css',
				explanation: drifted.length
					? `These resolved colours do not appear in \`${config.sources.generatedConfig}\`, which is a committed artifact generated from \`ids.css\` by \`npm run generate:tw-config\`: ${drifted.slice(0, 5).join(', ')}${drifted.length > 5 ? ` (+${drifted.length - 5} more)` : ''}. Brand theme values are expected to be absent — the generator does not read theme files — so treat brand entries here as informational.`
					: `Every resolved colour appears in \`${config.sources.generatedConfig}\`. The committed generated config looks current.`,
				recommendation: drifted.length
					? 'Run `npm run generate:tw-config` and commit the result. In CI, prefer regenerate-and-diff over a value scan.'
					: 'None. Consider a regenerate-and-diff step in CI so drift cannot be committed at all.',
				affects: [],
			}),
		);
	} catch {
		// generated config absent — not a failure for the PoC
	}

	return results;
}

/**
 * ST-05 — The self-referential fallback pattern actually resolves.
 *
 * `--color-primary-1: var(--color-primary-1, var(--color-primary-1-default))`
 * works, but only because a self-referential custom property becomes
 * guaranteed-invalid and the var() fallback therefore applies, AND because
 * Tailwind v4 orders `theme` before `base` so the brand file wins. Neither is
 * obvious on reading and both could change under a Tailwind major.
 */
export function ST05({ graph, resolutions, config }) {
	const results = [];
	for (const [name, res] of resolutions) {
		if (!res.selfReferential) continue;

		// A self-reference to a variable the consuming application supplies at
		// runtime is the intended pattern, not a defect. IDS's `--font-*` tokens
		// are exactly this: Next.js font loaders inject them per app, so they are
		// unresolved inside this repo by design. Without this check ST-05 reports
		// six false failures and the one genuine fragility gets lost.
		if (isExternal(name, config.external)) {
			results.push(
				pass({
					rule: 'ST-05',
					ruleName: 'Self-referential fallback resolves',
					subject: `--${name}`,
					subjectType: 'token',
					location: `${graph.tokens.get(name).file}:${graph.tokens.get(name).line}`,
					actual: `${graph.tokens.get(name).value} — supplied at runtime`,
					expected: 'provided by the consuming application',
					explanation: `\`--${name}\` is declared external in config/qualifier.json: the consuming application injects it (IDS fonts come from the host app's font loader). Unresolved inside this repo is correct.`,
					recommendation: 'None. Consuming apps must define this variable; that contract belongs in IDS documentation.',
					affects: [],
				}),
			);
			continue;
		}

		const token = graph.tokens.get(name);
		const ok = res.status === STATUS.RESOLVED;
		results.push(
			(ok ? warn : fail)({
				rule: 'ST-05',
				ruleName: 'Self-referential fallback resolves',
				subject: `--${name}`,
				subjectType: 'token',
				location: `${token.file}:${token.line}`,
				actual: `${token.value} → ${res.value ?? 'UNRESOLVED'}`,
				expected: 'a literal value under every supported theme',
				explanation: ok
					? `\`--${name}\` references itself with a fallback. This resolves to \`${res.value}\`, but only by relying on two subtleties at once: CSS makes a self-referential property guaranteed-invalid so the fallback applies, and Tailwind v4 orders the \`theme\` layer before \`base\` so \`themes/${graph.theme}.css\` wins. It is correct today and fragile across a Tailwind major.`
					: `\`--${name}\` references itself and the fallback does not reach a literal, so the token has no usable value.`,
				recommendation: ok
					? 'Keep, but cover it with a rendered-output test so a Tailwind upgrade cannot break theming silently.'
					: 'Give the fallback chain a literal terminal value.',
				affects: [],
			}),
		);
	}
	return results;
}

/** ST-06 — Tokens defined but referenced by nothing. */
export function ST06({ graph, byToken, config }) {
	const referenced = new Set(graph.references.map((r) => r.name));
	const orphans = [];

	for (const [name, token] of graph.tokens) {
		if (referenced.has(name)) continue;
		if (byToken.has(name)) continue; // used by a component via a Tailwind utility
		if (name.endsWith('-default')) continue; // consumed as var() fallbacks
		if (token.category === 'animation') continue; // consumed by @keyframes / utilities
		orphans.push({ name, token });
	}

	if (!orphans.length) {
		return [
			pass({
				rule: 'ST-06',
				ruleName: 'No orphaned tokens',
				subject: `${graph.tokens.size} tokens`,
				subjectType: 'graph',
				actual: 'no orphans',
				expected: 'no orphans',
				explanation: 'Every token is referenced by another token, a utility, or a scanned component.',
				recommendation: 'None.',
				affects: [],
			}),
		];
	}

	return [
		warn({
			rule: 'ST-06',
			ruleName: 'No orphaned tokens',
			subject: `${orphans.length} tokens`,
			subjectType: 'graph',
			actual: orphans.map((o) => `--${o.name}`).join(', '),
			expected: 'every token referenced somewhere',
			explanation:
				`${orphans.length} tokens are defined but not referenced by any other token, utility, or component in the scanned set ` +
				`(${config.components.include.join(', ')}). This is WARN not FAIL: IDS is a published library, so consumers outside this repo may use them, and usage scanning only covers the PoC's component subset.`,
			recommendation: 'Confirm against downstream consumers before removing any of these. Widening the component scan will shrink this list.',
			affects: [],
		}),
	];
}

/**
 * ST-07 — Every shipped token appears in the documented palette.
 *
 * The Storybook palette page is not generated from the token graph. The
 * `ThemeColors` block hand-enumerates each swatch:
 *
 *     const success = {
 *       1: styles.getPropertyValue('--color-success-1'),
 *       2: styles.getPropertyValue('--color-success-2'),
 *       3: styles.getPropertyValue('--color-success-3'),
 *     };
 *
 * So a token added to `ids.css` is shipped to consumers but stays invisible in
 * the documentation until someone remembers to edit this file too. That has
 * already happened: four `-4` steps exist in CSS and appear nowhere in the
 * rendered palette.
 *
 * This rule is only possible because the documentation was rendered and
 * compared against the code. Nothing in the CSS alone reveals it.
 */
export function ST07({ graph, repoRoot, byToken }) {
	let source;
	try {
		source = readFileSync(`${repoRoot}/.storybook/blocks/ThemeColors/ThemeColors.jsx`, 'utf8');
	} catch {
		return [];
	}

	const documented = new Set([...source.matchAll(/getPropertyValue\('--([a-z0-9-]+)'\)/g)].map((m) => m[1]));
	const shipped = [...graph.tokens.keys()].filter(
		(n) => /^color-[a-z]+-\d+$/.test(n) && !n.endsWith('-default'),
	);
	const undocumented = shipped.filter((n) => !documented.has(n));

	if (!undocumented.length) {
		return [
			pass({
				rule: 'ST-07',
				ruleName: 'Shipped tokens are documented',
				subject: `${shipped.length} palette tokens`,
				subjectType: 'graph',
				actual: 'every shipped ramp step appears in the documented palette',
				expected: 'every shipped ramp step appears in the documented palette',
				explanation: `All ${shipped.length} colour ramp tokens in ids.css are enumerated in the ThemeColors documentation block.`,
				recommendation: 'None.',
				affects: [],
			}),
		];
	}

	return [
		warn({
			rule: 'ST-07',
			ruleName: 'Shipped tokens are documented',
			subject: `${undocumented.length} undocumented tokens`,
			subjectType: 'graph',
			location: '.storybook/blocks/ThemeColors/ThemeColors.jsx',
			actual: undocumented.map((n) => `--${n}`).join(', '),
			expected: 'every shipped ramp step enumerated in ThemeColors.jsx',
			explanation:
				`${undocumented.length} colour tokens are defined in \`ids.css\` and published to consumers, but do not appear anywhere in the Storybook palette: ` +
				`${undocumented.map((n) => `\`--${n}\``).join(', ')}. ` +
				`The \`ThemeColors\` block hand-enumerates each swatch rather than deriving them from the token set, so adding a token to the CSS does not add it to the documentation. ` +
				`A designer browsing the palette has no way to discover these exist, and an engineer who finds them has no guidance on when to use them.`,
			recommendation:
				`Derive the swatch list from the token set instead of hand-listing it — that removes this entire class of drift permanently. ` +
				`Failing that, add the missing steps to ThemeColors.jsx, or remove them from ids.css if they were not intended to ship.`,
			affects: [...new Set(undocumented.flatMap((n) => [...(byToken.get(n) ?? [])]))],
		}),
	];
}

export const structureRules = [ST01, ST02, ST03, ST04, ST05, ST06, ST07];
