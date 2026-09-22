/**
 * Class J — Judgment rules, evaluated by Jev.
 *
 * Each rule builds its questions, hands them to the client as one batch per
 * subject, and interprets the answers against a confidence gate. With the
 * client stubbed (`jev.enabled: false`) every rule returns SKIPPED and says
 * why — the report stays honest about what was and was not evaluated.
 *
 * Deterministic prefilters run first, so Jev is only asked about subjects a
 * rule could not settle in code. With ~54 IDS tokens a full pass is a handful
 * of batched calls.
 */

import { STATUS } from '../parse/resolve.mjs';
import { isColor } from '../color/wcag.mjs';
import { QUESTION_VERSION, interpret, mt01, mt04, nm01, nm02, nm03, nm05 } from '../jev/questions.mjs';

const skipped = (rule, ruleName, subject, reason, extra = {}) => ({
	verdict: 'SKIPPED',
	class: 'J',
	rule,
	ruleName,
	subject,
	subjectType: 'token',
	actual: 'not evaluated',
	expected: 'a Jev judgment with calibrated confidence',
	explanation: `Judgment rule not evaluated: ${reason}`,
	recommendation: 'Enable the judgment layer to evaluate this rule — see README → "Enabling the judgment layer".',
	affects: [],
	...extra,
});

/**
 * Run async work over a list with bounded concurrency.
 *
 * Each token needs its own request, because `state` is shared per request and
 * every token has different state. Awaiting them in a loop means ~60 sequential
 * round trips — at 70–500ms each that is 20+ seconds for a run that should take
 * two. Jev's speed is the point of using it, so don't throw it away in the
 * caller. Bounded rather than unbounded so a large token set cannot open
 * hundreds of sockets or trip rate limits.
 */
async function mapLimit(items, limit, fn) {
	const results = new Array(items.length);
	let cursor = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (true) {
			const i = cursor++;
			if (i >= items.length) return;
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

/**
 * CSS keyword passthroughs are not design decisions, so no judgment rule
 * should be asked about them.
 *
 * The first live Jev run made this obvious: `--color-current` and
 * `--color-transparent` were the ONLY tokens flagged across three separate
 * rules — 2 grammar failures, 2 "off-brand" verdicts, and the two lowest
 * confidence scores in the set. Jev was right every time; the questions were
 * wrong. `currentColor` genuinely does not parse as `{role}-{step}` and
 * genuinely is not a MotorTrend brand colour, but neither observation is
 * useful, and asking wastes a call to produce a finding nobody can act on.
 */
const CSS_KEYWORDS = new Set(['currentcolor', 'transparent', 'inherit', 'initial', 'unset', 'revert', 'none']);

function isJudgeable(name, resolution) {
	const value = (resolution?.value ?? '').trim().toLowerCase();
	return !CSS_KEYWORDS.has(value);
}

/** Shape a token into the `state` payload Jev questions consume. */
function subjectFor(graph, resolutions, byToken, name) {
	const token = graph.tokens.get(name);
	const res = resolutions.get(name);
	return {
		name: `--${name}`,
		raw: token?.value ?? null,
		resolved: res?.value ?? null,
		chain: res?.chain?.map((c) => `--${c}`) ?? [],
		category: token?.category ?? 'other',
		file: token ? `${token.file}:${token.line}` : null,
		affects: [...(byToken.get(name) ?? [])],
	};
}

/**
 * NM-01, NM-02, NM-03 — three independent judgments over the same token state,
 * so they batch into one request per token.
 */
export async function judgeNaming({ graph, resolutions, byToken, jev, config }) {
	const results = [];
	const thresholds = config.jev.thresholds;

	const candidates = [...graph.tokens.keys()].filter((n) => {
		const token = graph.tokens.get(n);
		return token.category === 'color' && !n.endsWith('-default') && isJudgeable(n, resolutions.get(n));
	});

	if (!jev.enabled) {
		return [
			skipped('NM-01', 'Naming grammar', `${candidates.length} colour tokens`, jev.skipReason, { subjectType: 'graph' }),
			skipped('NM-02', 'Semantic naming', `${candidates.length} colour tokens`, jev.skipReason, {
				subjectType: 'graph',
				explanation:
					`Judgment rule not evaluated: ${jev.skipReason}. ` +
					`Note this rule is advisory by design: IDS documents that its numbered naming deliberately mirrors the UX team's Figma names, ` +
					`so a FAIL here would be overruling an intentional decision. It informs the migration conversation rather than gating a PR.`,
			}),
			skipped('NM-03', 'Tier classification', `${candidates.length} colour tokens`, jev.skipReason, { subjectType: 'graph' }),
		];
	}

	const batches = await mapLimit(candidates, 8, async (name) => {
		const subject = subjectFor(graph, resolutions, byToken, name);
		return { name, subject, answers: await jev.ask([nm01(subject), nm02(subject), nm03(subject)]) };
	});

	for (const { name, subject, answers } of batches) {
		const g = interpret(answers.nm01_grammar, { threshold: thresholds['NM-01'], failOn: false });
		results.push({
			verdict: g.verdict === 'JUDGED' ? 'PASS' : g.verdict,
			class: 'J',
			rule: 'NM-01',
			ruleName: 'Naming grammar',
			subject: subject.name,
			subjectType: 'token',
			confidence: g.confidence,
			actual: `noul ${g.probability?.toFixed(2) ?? 'n/a'}`,
			expected: `follows {role}-{step}; gate ${thresholds['NM-01']}`,
			explanation: g.reason ?? `Jev judged whether \`${subject.name}\` parses as the documented grammar.`,
			recommendation: g.verdict === 'FAIL' ? 'Rename to match the documented grammar.' : 'None.',
			affects: subject.affects,
		});

		const s = interpret(answers.nm02_semantics, { threshold: thresholds['NM-02'], failOn: false });
		results.push({
			verdict: 'WARN',
			class: 'J',
			rule: 'NM-02',
			ruleName: 'Semantic naming',
			subject: subject.name,
			subjectType: 'token',
			confidence: s.confidence,
			actual: s.choice ?? 'unjudged',
			expected: 'role (advisory — see IDS Colors documentation)',
			explanation:
				`Jev classified \`${subject.name}\` as \`${s.choice ?? 'unjudged'}\`. ` +
				`Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.`,
			recommendation: 'Raise with the UX team as part of the IDS → HDS naming decision.',
			affects: subject.affects,
		});

		const t = interpret(answers.nm03_tier, { threshold: thresholds['NM-03'], failOn: false });
		results.push({
			verdict: t.verdict === 'JUDGED' ? (t.choice === 'unclear' ? 'WARN' : 'PASS') : t.verdict,
			class: 'J',
			rule: 'NM-03',
			ruleName: 'Tier classification',
			subject: subject.name,
			subjectType: 'token',
			confidence: t.confidence,
			actual: `${t.choice ?? 'unjudged'} (declared: ${graph.tokens.get(name).tier})`,
			expected: `declared tier matches judged tier; gate ${thresholds['NM-03']}`,
			explanation:
				t.reason ??
				`Jev judged \`${subject.name}\` to be a \`${t.choice}\` token; the parser's prefix heuristic declared it \`${graph.tokens.get(name).tier}\`.`,
			recommendation: t.choice === 'unclear' ? 'Clarify this token\'s tier before migration.' : 'None.',
			affects: subject.affects,
		});
	}

	return results;
}

/**
 * NM-05 — Duplicate intent among same-valued tokens.
 *
 * The deterministic prefilter finds value collisions; Jev decides whether each
 * collision is redundancy or coincidence. In IDS this matters concretely:
 * `color-secondary-*` and `color-info-*` share three values under the
 * motortrend theme but diverge under hotrod, so hex equality alone would report
 * three false duplicates.
 */
export async function judgeDuplicates({ graph, resolutions, byToken, jev, config }) {
	// Deterministic prefilter.
	const byValue = new Map();
	for (const [name, res] of resolutions) {
		const token = graph.tokens.get(name);
		if (token?.category !== 'color' || name.endsWith('-default')) continue;
		if (res.status !== STATUS.RESOLVED || !isColor(res.value)) continue;
		const key = res.value.toLowerCase();
		if (!byValue.has(key)) byValue.set(key, []);
		byValue.get(key).push(name);
	}
	const collisions = [...byValue.entries()].filter(([, names]) => names.length > 1);

	if (!collisions.length) {
		return [
			{
				verdict: 'PASS',
				class: 'D',
				rule: 'NM-05',
				ruleName: 'No duplicate tokens with conflicting intent',
				subject: 'colour tokens',
				subjectType: 'graph',
				actual: 'no value collisions',
				expected: 'no value collisions, or collisions with distinct intent',
				explanation: 'No two colour tokens resolve to the same value, so there is nothing to judge.',
				recommendation: 'None.',
				affects: [],
			},
		];
	}

	if (!jev.enabled) {
		return collisions.map(([value, names]) => ({
			verdict: 'REVIEW',
			class: 'J',
			rule: 'NM-05',
			ruleName: 'No duplicate tokens with conflicting intent',
			subject: names.map((n) => `--${n}`).join(' ≡ '),
			subjectType: 'token',
			actual: `${names.length} tokens share ${value}`,
			expected: 'either distinct values, or a judged-distinct intent',
			explanation:
				`\`${names.map((n) => '--' + n).join('` and `')}\` all resolve to \`${value}\` under the ${graph.theme} theme. ` +
				`Whether that is redundancy or coincidence is a judgment about intent, not about values — so it is deferred to Jev, which is currently disabled (${jev.skipReason}). ` +
				`Reporting these as duplicates on value alone would be wrong: a brand accent and an informational status colour can legitimately coincide in one theme and diverge in another. ` +
				`In IDS the hotrod theme already breaks this coincidence, which is direct evidence the intents differ.`,
			recommendation:
				`Do not consolidate on the strength of a matching hex. Confirm intent with design, and if the intents differ, ` +
				`leave both tokens and record why — a future maintainer will otherwise "fix" the duplication and couple two unrelated things.`,
			affects: [...new Set(names.flatMap((n) => [...(byToken.get(n) ?? [])]))],
		}));
	}

	const results = [];
	for (const [, names] of collisions) {
		for (let i = 0; i < names.length - 1; i++) {
			for (let j = i + 1; j < names.length; j++) {
				const a = subjectFor(graph, resolutions, byToken, names[i]);
				const b = subjectFor(graph, resolutions, byToken, names[j]);
				const answers = await jev.ask([nm05(a, b)]);
				const d = interpret(answers.nm05_duplicate_intent, { threshold: config.jev.thresholds['NM-05'], failOn: true });
				results.push({
					verdict: d.verdict,
					class: 'J',
					rule: 'NM-05',
					ruleName: 'No duplicate tokens with conflicting intent',
					subject: `${a.name} ≡ ${b.name}`,
					subjectType: 'token',
					confidence: d.confidence,
					probability: d.probability,
					actual: `both resolve to ${a.resolved}; noul ${d.probability?.toFixed(2) ?? 'n/a'}`,
					expected: `distinct intent, or consolidation; gate ${config.jev.thresholds['NM-05']}`,
					explanation:
						d.reason ??
						(d.verdict === 'FAIL'
							? `Jev judged \`${a.name}\` and \`${b.name}\` to express the same intent, so one is redundant.`
							: `Jev judged these to express different intent despite sharing \`${a.resolved}\`. Keep both.`),
					recommendation: d.verdict === 'FAIL' ? `Consolidate onto one token and alias the other during migration.` : 'None — record why they coincide.',
					affects: [...new Set([...a.affects, ...b.affects])],
				});
			}
		}
	}
	return results;
}

/** MT-01 — Approved MotorTrend palette membership. */
export async function judgeBrandPalette({ graph, resolutions, byToken, jev, config }) {
	const palette = Object.fromEntries(
		[...resolutions.entries()]
			.filter(([n]) => /^color-(primary|secondary)-\d+$/.test(n))
			.map(([n, r]) => [n, r.value]),
	);
	const candidates = [...graph.tokens.keys()].filter((n) => {
		const token = graph.tokens.get(n);
		return (
			token.category === 'color' &&
			!n.endsWith('-default') &&
			!/^color-(primary|secondary)-\d+$/.test(n) &&
			isJudgeable(n, resolutions.get(n))
		);
	});

	if (!jev.enabled) {
		return [
			skipped('MT-01', 'Approved MotorTrend palette', `${candidates.length} non-brand colour tokens`, jev.skipReason, {
				subjectType: 'graph',
				explanation:
					`Judgment rule not evaluated: ${jev.skipReason}. ` +
					`The approved palette is now known from \`themes/motortrend.css\` (${Object.values(palette).join(', ')}), so this rule is answerable once the layer is enabled.`,
			}),
		];
	}

	const batches = await mapLimit(candidates, 8, async (name) => {
		const subject = subjectFor(graph, resolutions, byToken, name);
		return { subject, answers: await jev.ask([mt01(subject, palette)]) };
	});

	const results = [];
	for (const { subject, answers } of batches) {
		const m = interpret(answers.mt01_brand_palette, { threshold: config.jev.thresholds['MT-01'], failOn: false });
		results.push({
			verdict: m.verdict === 'JUDGED' ? (m.choice === 'off-brand' ? 'FAIL' : 'PASS') : m.verdict,
			class: 'J',
			rule: 'MT-01',
			ruleName: 'Approved MotorTrend palette',
			subject: subject.name,
			subjectType: 'token',
			confidence: m.confidence,
			actual: m.choice ?? 'unjudged',
			expected: `brand, status, or neutral; gate ${config.jev.thresholds['MT-01']}`,
			explanation: m.reason ?? `Jev classified \`${subject.name}\` (${subject.resolved}) as \`${m.choice}\`.`,
			recommendation: m.choice === 'off-brand' ? `Replace with an approved palette colour.` : 'None.',
			affects: subject.affects,
		});
	}
	return results;
}

/**
 * MT-04 — Editorial hierarchy coherence.
 *
 * The one rule where every variant shares the same state — the ladder itself —
 * so all 16 questions batch into a SINGLE request rather than one per variant.
 * That is the shape the primitive is designed for: independent judgments over
 * one shared context, answered in parallel.
 *
 * Reads from CSS rather than the token graph, because IDS typography is not
 * tokenized: the `typography-*` variants are `@utility` classes with hardcoded
 * rem values. Never blocks — a legitimate design decision can sit anywhere on
 * a spectrum, and there is no documented specification for the ladder to check
 * against.
 */
export async function judgeHierarchy({ jev, typography, config }) {
	const variants = typography ?? [];
	if (!variants.length) return [];

	if (!jev.enabled) {
		return [
			skipped('MT-04', 'Editorial hierarchy', `${variants.length} typography variants`, jev.skipReason, {
				subjectType: 'category',
				explanation:
					`Judgment rule not evaluated: ${jev.skipReason}. ` +
					`IDS typography is not tokenized — the ${variants.length} \`typography-*\` variants are utility classes with hardcoded rem values — ` +
					`so this rule reads them from CSS rather than from the token graph.`,
			}),
		];
	}

	const px = (v) => (v && v.endsWith('rem') ? Math.round(parseFloat(v) * 16) : v);
	const ladder = variants.map((v) => ({
		variant: v.name.replace('typography-', ''),
		font_size: v.fontSize,
		font_size_px: px(v.fontSize),
		line_height: v.lineHeight,
		weight: v.weight,
	}));

	// One shared state, one question per variant, one request.
	const questions = variants.map((v) => {
		const q = mt04({ name: v.name.replace('typography-', ''), fontSize: v.fontSize, lineHeight: v.lineHeight, weight: v.weight }, ladder);
		return { ...q, id: `mt04_${v.name.replace(/[^a-z0-9]/g, '_')}`, state: { ladder, brand: 'MotorTrend' } };
	});

	const answers = await jev.ask(questions);

	/**
	 * Discrimination check — does this rule actually separate good from bad?
	 *
	 * A Score rule is only useful if it spreads. If every item lands on
	 * essentially the same value with low confidence, the model is saying "I
	 * cannot tell", and emitting one row per item would dress that up as a set
	 * of passes. That is worse than reporting nothing: it manufactures
	 * reassurance the data does not support.
	 *
	 * On the first live run this rule scored all 16 variants between 1.76 and
	 * 1.85 — a spread of 0.09 — at a median confidence of 0.29, against 0.61
	 * and 0.59 spreads for the rules that do discriminate. The cause is
	 * diagnosable rather than mysterious: MotorTrend has no documented
	 * editorial hierarchy specification, so the question supplies the ladder as
	 * its own reference and asks whether the ladder fits itself.
	 */
	const scored = variants.map((v, i) => answers[questions[i].id]).filter((a) => typeof a?.score === 'number');
	if (scored.length >= 3) {
		const s = scored.map((a) => a.score);
		const c = scored.map((a) => a.confidence ?? 0).sort((x, y) => x - y);
		const spread = Math.max(...s) - Math.min(...s);
		const medianConf = c[c.length >> 1];

		if (spread < 0.25 && medianConf < 0.5) {
			return [
				{
					verdict: 'WARN',
					class: 'J',
					rule: 'MT-04',
					ruleName: 'Editorial hierarchy',
					subject: `${variants.length} typography variants`,
					subjectType: 'category',
					confidence: medianConf,
					actual: `scores ${Math.min(...s).toFixed(2)}–${Math.max(...s).toFixed(2)} (spread ${spread.toFixed(2)}), median confidence ${medianConf.toFixed(2)}`,
					expected: 'a spread wide enough to separate well-placed variants from badly-placed ones',
					explanation:
						`**This rule produced no usable signal and is reported as inconclusive rather than as ${variants.length} passes.** ` +
						`Every variant scored within ${spread.toFixed(2)} of every other, at a median confidence of ${medianConf.toFixed(2)} — the model is expressing uncertainty uniformly, not judging the variants differently. ` +
						`For comparison, the judgment rules that do discriminate on this codebase show confidence spreads above 0.55. ` +
						`The cause is that MotorTrend has no documented editorial hierarchy specification, so the question can only supply the existing ladder as its own reference and ask whether it is consistent with itself. That is close to circular, and the model is right to be unsure.`,
					recommendation:
						`Do not read these scores as a verdict on the type scale. To make this rule work, one of two things has to change: either design documents the intended editorial hierarchy so there is a specification to check against, ` +
						`or the rule is narrowed to something answerable without one — for example "is the step between adjacent levels perceptible?" judged pairwise rather than "does this variant fit the ladder".`,
					affects: ['Typography'],
				},
			];
		}
	}

	const results = [];

	for (let i = 0; i < variants.length; i++) {
		const v = variants[i];
		const a = answers[questions[i].id];
		const name = v.name.replace('typography-', '');
		const h = interpret(a, { threshold: config.jev.thresholds['MT-04'], failOn: false });

		// criteria are: 0 clearly wrong, 1 questionable, 2 acceptable, 3 correct
		const score = typeof a?.score === 'number' ? a.score : null;
		const verdict = score === null ? h.verdict : score < 1.5 ? 'WARN' : 'PASS';

		results.push({
			verdict,
			class: 'J',
			rule: 'MT-04',
			ruleName: 'Editorial hierarchy',
			subject: `.${v.name}`,
			subjectType: 'component',
			confidence: a?.confidence ?? null,
			actual: `${v.fontSize} / ${v.lineHeight}, ${v.weight}${score !== null ? ` — score ${score.toFixed(2)} of 3` : ''}`,
			expected: 'a clean step between its neighbours in the hero → h1–h6 → subtitle → body → caption ladder',
			explanation:
				score === null
					? (h.reason ?? `No score returned for \`.${v.name}\`.`)
					: `Jev scored \`.${v.name}\` at ${score.toFixed(2)} of 3 (confidence ${(a.confidence ?? 0).toFixed(2)}) for how well ${v.fontSize}/${v.lineHeight} at ${v.weight} fits its position in the ladder. ` +
						(score < 1.5
							? `Below the midpoint, meaning the step reads as questionable or wrong relative to its neighbours.`
							: `Above the midpoint: the step is distinguishable and consistently placed.`),
			recommendation:
				score !== null && score < 1.5
					? `Review \`.${v.name}\` against its neighbours with design. Advisory only — there is no documented specification for MotorTrend's editorial hierarchy, so this is a prompt for a conversation, not a defect.`
					: 'None.',
			affects: ['Typography'],
		});
	}

	return results;
}

export const judgmentRules = [judgeNaming, judgeDuplicates, judgeBrandPalette, judgeHierarchy];
