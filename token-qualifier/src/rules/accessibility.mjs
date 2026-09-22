/**
 * Class D — Accessibility rules (AX-01 … AX-05). Deterministic, offline.
 *
 * Contrast is arithmetic on resolved sRGB values, so none of this goes to Jev.
 * A model here would be slower, probabilistic, and would make a blocking
 * verdict something a developer could not reproduce locally.
 *
 * Every rule depends on `config.surfaces`, which is a DESIGN DECISION, not a
 * fact about the code: a colour is only "inaccessible" relative to the
 * backgrounds it is actually placed on. That config carries a `$signedOffBy`
 * field for exactly this reason.
 */

import { readFileSync } from 'node:fs';
import { STATUS } from '../parse/resolve.mjs';
import { composite, contrast, isColor, toHex, THRESHOLDS } from '../color/wcag.mjs';
import { focusPairs } from '../parse/variants.mjs';

const r2 = (n) => Math.round(n * 100) / 100;

/** Collect the declared surfaces, as { name, value, scheme }. */
function surfaceList(config, resolutions) {
	const out = [];
	for (const scheme of ['light', 'dark']) {
		for (const name of config.surfaces[scheme] ?? []) {
			const res = resolutions.get(name);
			if (res?.status === STATUS.RESOLVED && isColor(res.value)) out.push({ name: `--${name}`, value: res.value, scheme });
		}
	}
	for (const literal of config.surfaces.literals ?? []) {
		if (isColor(literal)) out.push({ name: literal, value: literal, scheme: 'light' });
	}
	return out;
}

/**
 * AX-01 / AX-02 — Text and UI-component contrast against every declared surface.
 *
 * Reported per token, not per pair, so one token does not produce eight rows.
 * A token that clears 4.5:1 on some surfaces and not others is the most
 * dangerous case — it looks fine in the place it was designed and fails
 * elsewhere — so that asymmetry is called out explicitly.
 */
export function AX01_AX02({ resolutions, config, byToken, graph }) {
	const results = [];
	const surfaces = surfaceList(config, resolutions);
	if (!surfaces.length) return results;

	const surfaceNames = new Set([...(config.surfaces.light ?? []), ...(config.surfaces.dark ?? [])]);

	for (const [name, res] of resolutions) {
		const token = graph.tokens.get(name);
		if (!token || token.category !== 'color') continue;
		if (config.foreground.excludeSuffixes.some((s) => name.endsWith(s))) continue;
		if (surfaceNames.has(name)) continue;
		if (res.status !== STATUS.RESOLVED || !isColor(res.value)) continue;
		if (res.value === 'transparent' || res.value === 'currentColor') continue;

		const affects = [...(byToken.get(name) ?? [])];

		/**
		 * Evaluate each colour scheme separately, then judge the token against the
		 * scheme it actually belongs to.
		 *
		 * Checking every token against light AND dark surfaces at once is
		 * structurally guaranteed to fail almost everything: a near-black text
		 * colour cannot pass on a near-black surface, and that is not a defect.
		 * A first draft of this rule did exactly that and reported 26 failures out
		 * of 26 tokens — all noise, which is worse than no rule at all.
		 *
		 * So: a token's "home scheme" is the one where it performs best, and the
		 * verdict is about consistency WITHIN that scheme.
		 */
		const schemes = new Map();
		for (const s of surfaces) {
			const ratio = contrast(res.value, s.value);
			if (ratio === null) continue;
			if (!schemes.has(s.scheme)) schemes.set(s.scheme, []);
			schemes.get(s.scheme).push({ surface: s, ratio });
		}
		if (!schemes.size) continue;

		const scored = [...schemes.entries()].map(([scheme, pairs]) => ({
			scheme,
			pairs,
			passing: pairs.filter((p) => p.ratio >= THRESHOLDS.AA_NORMAL).length,
			best: Math.max(...pairs.map((p) => p.ratio)),
		}));
		const home = scored.reduce((a, b) => (b.passing > a.passing || (b.passing === a.passing && b.best > a.best) ? b : a));
		const other = scored.filter((s) => s.scheme !== home.scheme);

		const aaPass = home.pairs.filter((p) => p.ratio >= THRESHOLDS.AA_NORMAL);
		const aaFail = home.pairs.filter((p) => p.ratio < THRESHOLDS.AA_NORMAL);
		const detail = home.pairs.map((p) => `${p.surface.name} ${r2(p.ratio)}:1`).join(' · ');
		const usage = affects.length ? ` Used by ${affects.join(', ')}.` : ' Not used by any scanned component.';

		if (home.passing === 0) {
			// Unusable for normal text on any approved surface, in any scheme.
			const bestPair = scored.flatMap((s) => s.pairs).reduce((a, b) => (a.ratio > b.ratio ? a : b));
			results.push({
				verdict: 'FAIL',
				rule: 'AX-01',
				ruleName: 'WCAG AA contrast, normal text',
				subject: `--${name}`,
				subjectType: 'token',
				actual: `${res.value} — best available is ${r2(bestPair.ratio)}:1 on ${bestPair.surface.name}`,
				expected: `≥ ${THRESHOLDS.AA_NORMAL}:1 on at least one approved surface`,
				explanation:
					`\`--${name}\` (${res.value}) fails 4.5:1 against **every** approved surface in **both** schemes. ` +
					`There is no approved background on which this token is valid for normal-size body text, so it cannot safely carry any text at all.${usage}`,
				recommendation:
					`Either adjust the value until it clears 4.5:1 on at least one approved surface, or document \`--${name}\` as large-text / non-text only ` +
					`and make that constraint visible at the point of use.`,
				affects,
			});
		} else if (aaFail.length) {
			// The dangerous case: correct where it was designed, silently wrong elsewhere.
			results.push({
				verdict: 'FAIL',
				rule: 'AX-01',
				ruleName: 'WCAG AA contrast, normal text',
				subject: `--${name}`,
				subjectType: 'token',
				actual: `${res.value} on ${home.scheme} surfaces — ${detail}`,
				expected: `≥ ${THRESHOLDS.AA_NORMAL}:1 on every ${home.scheme} surface`,
				explanation:
					`\`--${name}\` (${res.value}) is a ${home.scheme}-scheme foreground colour. It clears 4.5:1 on ${aaPass.map((p) => p.surface.name).join(', ')} ` +
					`but fails on ${aaFail.map((p) => `${p.surface.name} (${r2(p.ratio)}:1)`).join(', ')}. ` +
					`This is the most failure-prone shape a colour token can have: it is correct on the surface it was designed against and silently inaccessible on the others, ` +
					`so the bug ships whenever the token is reused one surface over.${usage}`,
				recommendation:
					`Darken \`--${name}\` until it clears 4.5:1 on all ${home.scheme} surfaces, or split it into surface-specific tokens so the unsafe combination cannot be expressed. ` +
					`Leaving it as-is makes correctness depend on every future author remembering which background is safe.`,
				affects,
			});
		} else {
			results.push({
				verdict: 'PASS',
				rule: 'AX-01',
				ruleName: 'WCAG AA contrast, normal text',
				subject: `--${name}`,
				subjectType: 'token',
				actual: `${res.value} on ${home.scheme} surfaces — ${detail}`,
				expected: `≥ ${THRESHOLDS.AA_NORMAL}:1 on every ${home.scheme} surface`,
				explanation:
					`\`--${name}\` (${res.value}) clears 4.5:1 on all ${home.pairs.length} approved ${home.scheme} surfaces` +
					(other.length ? `. As expected for a ${home.scheme}-scheme colour it does not pass on ${other.map((s) => s.scheme).join('/')} surfaces, which is correct, not a defect.` : '.'),
				recommendation: 'None.',
				affects,
			});
		}

		// AX-02: large text, icons and UI boundaries, within the home scheme only.
		const uiFail = home.pairs.filter((p) => p.ratio < THRESHOLDS.AA_LARGE);
		if (uiFail.length) {
			results.push({
				verdict: 'WARN',
				rule: 'AX-02',
				ruleName: 'WCAG AA contrast, large text and UI',
				subject: `--${name}`,
				subjectType: 'token',
				actual: uiFail.map((p) => `${p.surface.name} ${r2(p.ratio)}:1`).join(' · '),
				expected: `≥ ${THRESHOLDS.AA_LARGE}:1 on ${home.scheme} surfaces`,
				explanation:
					`On ${uiFail.length} of ${home.pairs.length} ${home.scheme} surfaces, \`--${name}\` also falls below the 3:1 floor that applies to large text, icons and UI component boundaries. ` +
					`It cannot carry meaning there at any text size.${usage}`,
				recommendation: `Treat \`--${name}\` as purely decorative on ${uiFail.map((p) => p.surface.name).join(', ')}.`,
				affects,
			});
		}
	}

	return results;
}

/**
 * AX-03 — Focus indicator contrast, WCAG 2.2 SC 1.4.11 Non-text Contrast.
 *
 * The ring and its offset are declared as two independent Tailwind classes that
 * only mean something together, which is why this rule needs the component
 * scanner rather than the token graph alone. It is also why nothing currently
 * catches the failure: neither class is wrong by itself.
 */
export function AX03({ components, resolutions, config }) {
	const results = [];
	const valueOf = (token) => {
		const res = resolutions.get(token);
		return res?.status === STATUS.RESOLVED && isColor(res.value) ? res.value : null;
	};

	for (const [name, component] of components) {
		// Scope: only components that actually render something focusable.
		// Demanding a focus ring on a text-rendering component is a false
		// positive, and false positives are how a rule gets switched off.
		const hasFocusStyling = component.usages.some((u) => u.state === 'focus-visible' || u.state === 'focus');

		if (!component.interactive) {
			// The component source renders nothing focusable. But if its own stories
			// pass `href` or `onClick`, it IS used interactively in practice — and
			// with no focus styling that is a real gap, evidenced rather than assumed.
			if (component.interactiveInStories && !hasFocusStyling) {
				results.push({
					verdict: 'WARN',
					rule: 'AX-03',
					ruleName: 'Visible focus indicator',
					subject: name,
					subjectType: 'component',
					actual: `no focus styling anywhere in ${name}; stories pass interactive props`,
					expected: 'a focus indicator wherever the component can receive focus',
					explanation:
						`${name}'s own source renders no inherently focusable element, so SC 1.4.11 does not apply to it directly. ` +
						`However its stories (${[...component.storyFiles].join(', ')}) demonstrate it with \`href\`/\`onClick\`, so it is used as an interactive target in practice, ` +
						`and the component declares no \`focus-visible:\` styling at all. Whoever wraps it must supply the focus indicator, and nothing enforces that.`,
					recommendation:
						`Either add a \`focus-visible:\` ring to ${name} for when it receives interactive props, or document that callers must provide one. ` +
						`WARN rather than FAIL because the obligation sits with the consumer, not this component.`,
					affects: [name],
				});
				continue;
			}

			results.push({
				verdict: 'PASS',
				rule: 'AX-03',
				ruleName: 'Visible focus indicator',
				subject: name,
				subjectType: 'component',
				actual: 'not interactive — no focusable element detected',
				expected: 'a focus indicator, for interactive components only',
				explanation: `${name} renders no focusable element (no button, link, input, tabIndex, onClick or cursor-pointer), so SC 1.4.11's focus-indicator requirement does not apply. Not evaluated rather than passed on merit.`,
				recommendation: 'None. If this component is interactive in a way the scan missed, add a marker to INTERACTIVE_MARKERS in src/parse/variants.mjs.',
				affects: [],
			});
			continue;
		}

		const pairs = focusPairs(component.usages);

		if (!pairs.length) {
			results.push({
				verdict: 'FAIL',
				rule: 'AX-03',
				ruleName: 'Visible focus indicator',
				subject: name,
				subjectType: 'component',
				actual: 'interactive, but no focus-visible colour classes found',
				expected: 'a focus indicator with ≥ 3:1 against adjacent colours',
				explanation: `${name} renders a focusable element but declares no \`focus-visible:\` ring or outline colour. Keyboard users get only the browser default outline, which most CSS resets remove.`,
				recommendation: `Add a \`focus-visible:\` ring with a token that clears 3:1 against ${name}'s background.`,
				affects: [name],
			});
			continue;
		}

		for (const pair of pairs) {
			const ringValue = pair.ring ? valueOf(pair.ring.token) : null;
			const offsetValue = pair.offset ? valueOf(pair.offset.token) : null;

			if (!ringValue || !offsetValue) {
				results.push({
					verdict: 'WARN',
					rule: 'AX-03',
					ruleName: 'Visible focus indicator',
					subject: `${name} (${pair.scheme})`,
					subjectType: 'component',
					actual: `ring=${pair.ring?.token ?? 'none'} offset=${pair.offset?.token ?? 'none'}`,
					expected: 'both ring and offset colours resolvable',
					explanation: `The ${pair.scheme}-mode focus indicator for ${name} could not be fully resolved, so its contrast cannot be verified.`,
					recommendation: 'Declare both a ring colour and a ring-offset colour with resolvable tokens.',
					affects: [name],
				});
				continue;
			}

			const ratio = contrast(ringValue, offsetValue);
			const ok = ratio >= THRESHOLDS.NON_TEXT;

			// Suggest concrete replacements, ranked so the advice is usable rather
			// than merely arithmetic. A focus ring is a semantic choice: keeping
			// the ring in its current ramp preserves the existing affordance,
			// whereas the numerically-closest passing colour may be a grey text
			// token or the brand red that already means "error".
			const currentFamily = pair.ring.token.match(/^color-([a-z]+)-/)?.[1] ?? null;
			const alternatives = ok
				? []
				: [...resolutions.entries()]
						.filter(([t, res]) => /^color-(primary|secondary|info)-\d+$/.test(t) && res.status === STATUS.RESOLVED && isColor(res.value))
						.map(([t, res]) => ({
							token: t,
							ratio: contrast(res.value, offsetValue),
							sameFamily: t.startsWith(`color-${currentFamily}-`),
						}))
						.filter((a) => a.ratio >= THRESHOLDS.NON_TEXT)
						// same ramp first, then by smallest passing ratio within each group
						.sort((a, b) => Number(b.sameFamily) - Number(a.sameFamily) || a.ratio - b.ratio)
						.slice(0, 3);

			results.push({
				verdict: ok ? 'PASS' : 'FAIL',
				rule: 'AX-03',
				ruleName: 'Visible focus indicator',
				subject: `${name} (${pair.scheme} mode)`,
				subjectType: 'component',
				actual: `${r2(ratio)}:1 — ring \`--${pair.ring.token}\` ${ringValue} on offset \`--${pair.offset.token}\` ${offsetValue}`,
				expected: `≥ ${THRESHOLDS.NON_TEXT}:1 (WCAG 2.2 SC 1.4.11)`,
				explanation: ok
					? `${name}'s ${pair.scheme}-mode focus ring contrasts ${r2(ratio)}:1 against its offset, clearing the 3:1 non-text minimum.`
					: `${name}'s ${pair.scheme}-mode focus ring is \`${pair.ring.class}\` (${ringValue}) drawn against \`${pair.offset.class}\` (${offsetValue}), giving **${r2(ratio)}:1** where SC 1.4.11 requires 3:1. ` +
						`Keyboard focus is effectively invisible in ${pair.scheme} mode. Neither class is wrong on its own, which is why review and linting both miss it.`,
				recommendation: ok
					? 'None.'
					: alternatives.length
						? `Replace \`${pair.ring.class}\` with ${alternatives.map((a) => `\`--${a.token}\` (${r2(a.ratio)}:1)${a.sameFamily ? ' — same ramp' : ''}`).join(', ')}. ` +
							(alternatives[0].sameFamily
								? `\`--${alternatives[0].token}\` stays in the \`${currentFamily}\` ramp, so the focus affordance keeps its current colour identity.`
								: `No colour in the \`${currentFamily}\` ramp clears 3:1 here, so the focus indicator must change hue — confirm with design which ramp it should move to.`)
						: `No token in the current palette clears 3:1 against ${offsetValue}. A dedicated focus-indicator token is needed.`,
				affects: [name],
			});
		}
	}

	return results;
}

/**
 * AX-04 — Disabled states are distinguishable.
 *
 * WCAG exempts inactive controls from text-contrast requirements, so a low
 * label ratio here is correct-by-exemption, not a defect. What matters is
 * whether a user can tell enabled from disabled — and whether opacity or
 * cursor changes carry that signal when colour alone does not.
 */
export function AX04({ components, resolutions, config }) {
	const results = [];
	const surfaces = surfaceList(config, resolutions);
	const lightSurface = surfaces.find((s) => s.scheme === 'light')?.value ?? '#ffffff';
	const valueOf = (token) => {
		const res = resolutions.get(token);
		return res?.status === STATUS.RESOLVED && isColor(res.value) ? res.value : null;
	};

	for (const [name, component] of components) {
		const disabled = component.usages.filter((u) => u.state === 'disabled' || u.state === 'aria-disabled');
		if (!disabled.length) {
			results.push({
				verdict: 'WARN',
				rule: 'AX-04',
				ruleName: 'Disabled state differentiation',
				subject: name,
				subjectType: 'component',
				actual: 'no disabled-state styling found',
				expected: 'a disabled state distinguishable by more than colour',
				explanation: `No \`disabled:\` or \`aria-disabled:\` styling was found in ${name}. If it can be disabled, users have no visual signal.`,
				recommendation: `Add disabled styling, or confirm ${name} has no disabled state.`,
				affects: [name],
			});
			continue;
		}

		const bg = disabled.find((u) => u.utility === 'bg' && u.alpha !== null);
		const enabledBg = component.usages.find((u) => u.utility === 'bg' && u.state === 'default' && u.alpha === null);
		const nonColorSignals = component.usages
			.filter((u) => u.state === 'disabled' || u.state === 'aria-disabled')
			.length;
		const hasOpacity = component.files.size > 0 && disabled.some((u) => u.class.includes('opacity'));

		if (bg && enabledBg) {
			const bgValue = valueOf(bg.token);
			const enabledValue = valueOf(enabledBg.token);
			if (bgValue && enabledValue) {
				const composited = composite(bgValue, lightSurface, bg.alpha);
				const ratio = contrast(composited, enabledValue);
				const ok = ratio >= THRESHOLDS.AA_LARGE;
				results.push({
					verdict: ok ? 'PASS' : 'WARN',
					rule: 'AX-04',
					ruleName: 'Disabled state differentiation',
					subject: name,
					subjectType: 'component',
					actual: `disabled \`${bg.class}\` composites to ${toHex(composited)} on ${lightSurface}; vs enabled ${enabledValue} = ${r2(ratio)}:1`,
					expected: `≥ ${THRESHOLDS.AA_LARGE}:1 between states, or a non-colour signal`,
					explanation: ok
						? `${name}'s disabled background differs from its enabled background by ${r2(ratio)}:1, a clear visual change.`
						: `${name}'s disabled background composites to ${toHex(composited)}, only ${r2(ratio)}:1 from the enabled ${enabledValue}. ` +
							`Colour alone is a weak signal here. ` +
							(hasOpacity
								? `Mitigated: the component also applies an opacity change, so the state is not conveyed by colour alone. Reported as WARN for a designer's eye, not as a defect.`
								: `No opacity or other non-colour signal was detected, which makes this closer to a real problem.`),
					recommendation: ok
						? 'None.'
						: `Confirm with design that the opacity change is sufficient. WCAG exempts inactive controls from text-contrast minimums, so the goal is perceivability, not a ratio.`,
					affects: [name],
				});
				continue;
			}
		}

		results.push({
			verdict: 'PASS',
			rule: 'AX-04',
			ruleName: 'Disabled state differentiation',
			subject: name,
			subjectType: 'component',
			actual: `${nonColorSignals} disabled-state declarations`,
			expected: 'a distinguishable disabled state',
			explanation: `${name} declares ${nonColorSignals} disabled-state style rules. No enabled/disabled background pair was resolvable for a numeric comparison, so this is a structural pass only.`,
			recommendation: 'None automated. Visual review covers the rest.',
			affects: [name],
		});
	}

	return results;
}

/**
 * AX-05 — Interactive target size.
 *
 * WCAG 2.2 has two: SC 2.5.8 Target Size (Minimum) at 24×24 CSS px is Level AA,
 * and SC 2.5.5 Target Size (Enhanced) at 44×44 is Level AAA. Reporting only the
 * 44px figure would overstate the obligation, so both are evaluated.
 */
export function AX05({ components, repoRoot, config }) {
	const results = [];
	const REM = 16;
	const SPACING_STEP = 4; // Tailwind default: 1 unit = 0.25rem

	for (const [name, component] of components) {
		const heights = [];
		for (const rel of component.files) {
			let source;
			try {
				source = readFileSync(`${repoRoot}/${config.sources.components}/${rel}`, 'utf8');
			} catch {
				continue;
			}
			for (const m of source.matchAll(/'(max-h|min-h|h|size)-(\d+)'/g)) {
				heights.push({ prop: m[1], units: Number(m[2]), px: Number(m[2]) * SPACING_STEP, class: `${m[1]}-${m[2]}` });
			}
		}
		if (!heights.length) continue;

		const smallest = heights.reduce((a, b) => (a.px < b.px ? a : b));
		const belowAA = heights.filter((h) => h.px < 24);
		const belowAAA = heights.filter((h) => h.px < 44);

		results.push({
			verdict: belowAA.length ? 'FAIL' : belowAAA.length ? 'WARN' : 'PASS',
			rule: 'AX-05',
			ruleName: 'Interactive target size',
			subject: name,
			subjectType: 'component',
			actual: heights.map((h) => `${h.class} = ${h.px}px`).join(' · '),
			expected: '≥ 24×24px (SC 2.5.8, AA); ≥ 44×44px (SC 2.5.5, AAA)',
			explanation: belowAA.length
				? `${name} has target heights below the 24px Level AA minimum: ${belowAA.map((h) => `${h.class} (${h.px}px)`).join(', ')}.`
				: belowAAA.length
					? `${name} meets the 24px Level AA minimum (smallest is ${smallest.class} at ${smallest.px}px) but ${belowAAA.map((h) => h.class).join(', ')} fall below the 44px Level AAA target. ` +
						`Note these are declared with \`max-h-*\`, a maximum rather than a minimum, so content cannot grow the target beyond the cap.`
					: `All ${name} target heights meet 44×44px.`,
			recommendation: belowAAA.length
				? `If AAA is a goal, raise the smaller sizes to 44px or ensure adequate spacing around them. Consider whether \`max-h-*\` should be \`min-h-*\` — as written, a longer label is clipped rather than growing the target.`
				: 'None.',
			affects: [name],
		});
	}

	return results;
}

export const accessibilityRules = [AX01_AX02, AX03, AX04, AX05];
