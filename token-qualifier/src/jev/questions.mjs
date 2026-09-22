/**
 * Class J — Jev question definitions.
 *
 * These are the rules in the brief that have no algorithm. Everything
 * deterministic lives in ../rules/ and never comes here: TypeSafe's own
 * guidance is "keep control flow, deterministic rules, and side effects in
 * code", and a probabilistic answer must never be the thing that blocks a PR.
 *
 * Primitive selection, per the TypeSafe docs:
 *   Choice — one of a defined option set (max 255); criteria is an object of
 *            option → description. Returns { choice, probabilities, confidence }.
 *   Noul   — probability a condition holds. criteria is an OBJECT with `true`
 *            and `false` fields describing each outcome, not free text.
 *            Returns { noul } only — there is NO confidence field.
 *   Score  — position on ordered levels. criteria is an ORDERED ARRAY of 2–10
 *            level descriptions, auto-numbered from 0, low end first.
 *            Returns { score, legend, probabilities, confidence }.
 *
 * Two traps these definitions are written to avoid:
 *
 *   1. A Noul of 0.5 means "yes and no are equally likely", NOT "half
 *      compliant". Composition code must route the mid-band to a human rather
 *      than score it as a partial pass. See interpret() below.
 *
 *   2. Questions are independent over shared state, so they batch into one
 *      systemOne call per token and run in parallel. Nothing here may depend on
 *      another question's answer.
 *
 * `version` is part of the cache key: bumping a question's wording must
 * invalidate its cached answers, or the report silently mixes old and new
 * judgments.
 */

export const QUESTION_VERSION = 1;

/**
 * NM-01 — Does the name follow the documented grammar?
 * Advisory-eligible only; IDS's grammar is `{role}-{step}` and is deliberate.
 */
export const nm01 = (token) => ({
	id: 'nm01_grammar',
	type: 'noul',
	instructions:
		'This design token name follows the documented naming grammar for its design system. ' +
		'The IDS grammar is `{role}-{step}`, for example `color-primary-2` or `color-neutral-8`, where role is a ' +
		'semantic ramp name and step is an integer position within that ramp.',
	// A Noul's criteria is an object with `true` and `false` fields, not free text.
	criteria: {
		true: 'The name parses cleanly as role-plus-step with a recognised role, for example color-primary-2.',
		false: 'The name has a missing step, a non-integer step, an unrecognised role, or an ad-hoc suffix.',
	},
	state: { token: token.name, value: token.resolved, category: token.category, file: token.file },
});

/**
 * NM-02 — Semantic role, a raw colour word, or a bare index?
 *
 * The distinction a regex cannot make: `danger` is a role, `crimson` is a
 * colour word, `primary-2` is a role plus a bare index that carries no intent.
 * IDS's docs state the numbered naming deliberately mirrors Figma, so this rule
 * is ADVISORY and feeds the migration conversation, not a PR gate.
 */
export const nm02 = (token) => ({
	id: 'nm02_semantics',
	type: 'choice',
	instructions:
		'Classify how this design token name communicates its purpose. Consider only the name, not the value.',
	criteria: {
		role: 'The name states the token\'s semantic purpose or meaning, such as danger, surface, disabled, or focus.',
		'color-word': 'The name states a literal colour, such as crimson, slate, midnight, or teal. This ties the name to an appearance rather than a purpose.',
		'bare-index': 'The name states a role plus a positional number, such as primary-2 or neutral-8. The role is semantic but the number conveys no intent: a reader cannot tell what step 2 is for.',
		ambiguous: 'The name does not clearly fit any of the above.',
	},
	state: { token: token.name, value: token.resolved, category: token.category },
});

/**
 * NM-03 — Which tier does this token actually belong to?
 *
 * Prefix cannot settle this. In HDS, `--color-card-bg` sits in the semantic
 * namespace but is named for a component; a prefix rule would misfile roughly
 * 200 tokens. Classifying from meaning is the whole reason this rule is Class J.
 */
export const nm03 = (token) => ({
	id: 'nm03_tier',
	type: 'choice',
	instructions:
		'A layered design system separates primitive tokens (raw values with no meaning), semantic tokens ' +
		'(purpose-named, aliasing primitives), and component tokens (named for one component, aliasing semantics). ' +
		'Classify which tier this token belongs to, judging by what its name and alias chain mean rather than by any prefix convention.',
	criteria: {
		primitive: 'A raw value with no purpose in its name, such as a colour ramp step or a bare size.',
		semantic: 'Named for a purpose or role that applies across components, such as text, surface, danger, or focus.',
		component: 'Named for a single specific component, such as button, card, or navbar.',
		unclear: 'The name mixes tiers or does not clearly belong to one.',
	},
	state: {
		token: token.name,
		value: token.resolved,
		declared_value: token.raw,
		alias_chain: token.chain,
		aliases_a_primitive: token.chain.length > 1,
	},
});

/**
 * NM-05 — Two tokens share a resolved value. Same intent, or a coincidence?
 *
 * In IDS today, `color-secondary-1` and `color-info-2` are both `#0865b4` —
 * identical value, genuinely different intent (brand accent vs. informational
 * status), and `hotrod.css` already breaks the coincidence. Hex equality alone
 * reports three false duplicates here, which is exactly why this is Class J.
 */
export const nm05 = (a, b) => ({
	id: 'nm05_duplicate_intent',
	type: 'noul',
	instructions:
		'These two design tokens resolve to the same colour value. Judge whether they express the SAME design intent, ' +
		'meaning one is a redundant duplicate of the other and they should be consolidated.',
	criteria: {
		true: 'The two names mean the same thing, so keeping both is pure redundancy and they should be consolidated.',
		false:
			'They serve different purposes and merely happen to share a value today — for example a brand accent colour ' +
			'and an informational status colour that coincide in one theme but should be free to diverge in another.',
	},
	state: {
		token_a: { name: a.name, value: a.resolved, used_by: a.affects },
		token_b: { name: b.name, value: b.resolved, used_by: b.affects },
		shared_value: a.resolved,
		note: 'These tokens may be overridden independently per brand theme.',
	},
});

/** MT-01 — Is this colour part of the approved MotorTrend palette? */
export const mt01 = (token, palette) => ({
	id: 'mt01_brand_palette',
	type: 'choice',
	instructions: 'Classify this colour token\'s role within the MotorTrend brand palette.',
	criteria: {
		brand: 'A MotorTrend brand colour — the signature reds or the supporting blues.',
		status: 'A functional status colour for error, warning, success, or information.',
		neutral: 'A greyscale or near-greyscale colour used for text, surfaces, and borders.',
		'off-brand': 'A colour that is none of the above and does not belong in the MotorTrend palette.',
	},
	state: { token: token.name, value: token.resolved, approved_palette: palette },
});

/**
 * MT-04 — Does this typography variant sit correctly in the editorial ladder?
 * Score, because hierarchy is a genuine spectrum. Never blocks.
 */
export const mt04 = (variant, ladder) => ({
	id: 'mt04_editorial_hierarchy',
	type: 'score',
	instructions:
		'Judge how well this typography variant\'s size and weight fit its intended position in MotorTrend\'s ' +
		'editorial hierarchy, which runs hero → h1–h6 → subtitle → body → caption.',
	criteria: [
		'Clearly wrong: the variant is sized or weighted as a different level entirely, inverting the hierarchy.',
		'Questionable: the variant is close to an adjacent level and the distinction would not read to a user.',
		'Acceptable: the variant is distinguishable from its neighbours but the step is uneven.',
		'Correct: the variant sits cleanly between its neighbours with a consistent step.',
	],
	state: { variant: variant.name, font_size: variant.fontSize, line_height: variant.lineHeight, weight: variant.weight, ladder },
});

/**
 * Turn a raw Jev answer into a verdict, honouring the calibration semantics.
 *
 * The mid-band for a Noul is NOT a partial pass — it is genuine uncertainty, and
 * the only correct action is to route it to a person.
 */
export function interpret(answer, { threshold, failOn }) {
	if (answer == null) return { verdict: 'SKIPPED', confidence: null, reason: 'no answer' };

	// Noul: probability of yes; no confidence field.
	if (typeof answer.noul === 'number') {
		const p = answer.noul;
		if (p > 0.4 && p < 0.6) {
			return {
				verdict: 'REVIEW',
				confidence: null,
				reason: `noul ${p.toFixed(2)} is in the uncertain band — yes and no are close to equally likely. This is not a partial pass.`,
			};
		}
		const yes = p >= 0.6;
		return { verdict: yes === failOn ? 'FAIL' : 'PASS', confidence: null, probability: p };
	}

	// Choice / Score: use the derived confidence against the rule's gate.
	const confidence = answer.confidence ?? null;
	if (threshold == null) return { verdict: 'WARN', confidence, choice: answer.choice ?? answer.score };
	if (confidence == null || confidence < threshold) {
		return {
			verdict: 'REVIEW',
			confidence,
			choice: answer.choice ?? answer.score,
			reason: `confidence ${confidence?.toFixed(2) ?? 'n/a'} is below the ${threshold} gate for this rule`,
		};
	}
	return { verdict: 'JUDGED', confidence, choice: answer.choice ?? answer.score, probabilities: answer.probabilities };
}

/**
 * MG-02 — Which HDS role should this IDS token feed?
 *
 * The migration question a value comparison cannot answer. Ignition names
 * colours by position (`primary-2`); HDS names them by role (`bg-brand`,
 * `txt-subtle`, `border-error`). Nearest-colour matching produces mappings
 * that are numerically close and semantically meaningless — it would happily
 * map MotorTrend's success green onto a Hearst grey because the RGB distance
 * is small.
 *
 * Code narrows the candidate set to the roles that match how the token is
 * ACTUALLY used (a token only ever applied as a background cannot become a
 * text role), and Jev chooses among them. `none` is a first-class answer: many
 * Ignition tokens have no HDS home, and inventing one is worse than recording
 * the gap.
 */
export const mg02 = (token, property, candidates) => ({
	id: 'mg02_role_mapping',
	type: 'choice',
	instructions:
		`This design token is migrating from the Ignition Design System, which names colours by position in a ramp, ` +
		`to the Hearst Design System, which names them by the role they play. Choose the Hearst role this token should feed. ` +
		`Judge by the token's purpose and how it is used, not by which Hearst colour happens to be closest in value.`,
	criteria: {
		...Object.fromEntries(candidates.map((c) => [c.role, c.description])),
		none: 'No Hearst role is a good home for this token. Its purpose has no equivalent in the target vocabulary, and forcing a mapping would lose meaning.',
	},
	state: {
		ids_token: token.name,
		ids_value: token.resolved,
		used_as: property,
		used_by_components: token.affects,
		ids_ramp_position: token.name.match(/-(\d+)$/)?.[1] ?? null,
		note: 'Hearst has one brand slot and no secondary or accent role, so not every Ignition brand colour can map.',
	},
});
