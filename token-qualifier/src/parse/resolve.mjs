/**
 * Resolve a token's declared value down to a literal, following var() chains.
 *
 * This is the foundation every other rule stands on. Accessibility rules cannot
 * compute a ratio until a token is a literal colour, and they cannot terminate
 * at all unless cycles are detected — which is why ST-02 is not a "nice to
 * have" but a prerequisite.
 *
 * CSS semantics that matter here:
 *
 *  - A custom property whose value references ITSELF is invalid at
 *    computed-value time, so it becomes the guaranteed-invalid value, and a
 *    var() pointing at it therefore falls through to the fallback. IDS relies
 *    on exactly this in `ids.css` (`--color-primary-1: var(--color-primary-1,
 *    var(--color-primary-1-default))`). We model it rather than calling it a
 *    cycle, and surface the fragility through ST-05 instead.
 *
 *  - A var() with no fallback and no definition is simply dangling — F2.
 */

const STATUS = {
	RESOLVED: 'resolved',
	DANGLING: 'dangling',
	CIRCULAR: 'circular',
	UNRESOLVED: 'unresolved',
};

export { STATUS };

/**
 * Split `var(--name, fallback)` at the top level of a value string.
 * Returns null when the value contains no var() reference.
 */
function firstVar(value) {
	const at = value.indexOf('var(');
	if (at === -1) return null;

	let depth = 0;
	let end = -1;
	for (let i = at + 3; i < value.length; i++) {
		if (value[i] === '(') depth++;
		else if (value[i] === ')') {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (end === -1) return null;

	const inner = value.slice(at + 4, end);
	// Split on the first top-level comma: everything after it is the fallback.
	let d = 0;
	let comma = -1;
	for (let i = 0; i < inner.length; i++) {
		if (inner[i] === '(') d++;
		else if (inner[i] === ')') d--;
		else if (inner[i] === ',' && d === 0) {
			comma = i;
			break;
		}
	}

	const ref = (comma === -1 ? inner : inner.slice(0, comma)).trim().replace(/^--/, '');
	const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();

	return { before: value.slice(0, at), after: value.slice(end + 1), ref, fallback };
}

/**
 * Resolve one token to a literal value.
 *
 * @returns {{ status, value, chain, missing, selfReferential, usedFallback }}
 */
export function resolveToken(graph, name, options = {}) {
	const maxDepth = options.maxDepth ?? 16;
	const chain = [];
	const missing = [];
	let selfReferential = false;
	let usedFallback = false;

	const token = graph.tokens.get(name);
	if (!token) {
		return {
			status: STATUS.DANGLING,
			value: null,
			chain: [name],
			missing: [name],
			selfReferential,
			usedFallback,
		};
	}

	const seen = new Set();

	function step(current, value, depth) {
		if (depth > maxDepth) return { status: STATUS.CIRCULAR, value: null };

		const found = firstVar(value);
		if (!found) return { status: STATUS.RESOLVED, value: value.trim() };

		const { before, after, ref, fallback } = found;

		// Self-reference: invalid at computed-value time, so the fallback applies.
		if (ref === current) {
			selfReferential = true;
			if (fallback === null) return { status: STATUS.UNRESOLVED, value: null };
			usedFallback = true;
			return step(current, `${before}${fallback}${after}`, depth + 1);
		}

		// A genuine cycle between distinct tokens.
		if (seen.has(ref)) {
			chain.push(ref);
			return { status: STATUS.CIRCULAR, value: null };
		}

		const target = graph.tokens.get(ref);
		if (!target) {
			missing.push(ref);
			if (fallback === null) {
				chain.push(ref);
				return { status: STATUS.DANGLING, value: null };
			}
			usedFallback = true;
			return step(current, `${before}${fallback}${after}`, depth + 1);
		}

		seen.add(ref);
		chain.push(ref);
		const inner = step(ref, target.value, depth + 1);

		// An unresolvable target still lets the fallback apply.
		if (inner.status !== STATUS.RESOLVED) {
			if (fallback !== null) {
				usedFallback = true;
				return step(current, `${before}${fallback}${after}`, depth + 1);
			}
			return inner;
		}

		const substituted = `${before}${inner.value}${after}`;
		return firstVar(substituted) ? step(current, substituted, depth + 1) : { status: STATUS.RESOLVED, value: substituted.trim() };
	}

	seen.add(name);
	chain.push(name);
	const result = step(name, token.value, 0);

	return {
		status: result.status,
		value: result.value,
		chain,
		missing,
		selfReferential,
		usedFallback,
		depth: chain.length,
	};
}

/** Resolve every token in the graph once. Returns Map<name, resolution>. */
export function resolveAll(graph, options = {}) {
	const out = new Map();
	for (const name of graph.tokens.keys()) out.set(name, resolveToken(graph, name, options));
	return out;
}
