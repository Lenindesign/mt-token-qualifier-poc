/**
 * Resolve a Hearst brand's design tokens from DTCG source to literal values.
 *
 * Why this exists: brand values reach production through ConfigDS at request
 * time, so they are never present in a build. Nothing can therefore check them
 * — which is why no contrast validation exists anywhere in the pipeline.
 *
 * This resolves each brand the same way the runtime does, but statically, so
 * the result can be verified in CI. It produces a snapshot **for verification
 * only**; nothing here is intended to be served. The delivery model is
 * deliberately left alone.
 *
 * Merge order matches the `extends` chain declared in each brand file:
 *
 *     primitives  <  alias_base_theme  <  brand
 *
 * References are DTCG `{dot.path.to.token}` and may chain. A brand overriding
 * an alias re-points every token that referenced it, which is the whole point
 * of the layering — so resolution has to happen after the merge, never before.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Flatten a DTCG document to Map<dotted.path, {value, type, description}>. */
export function flatten(doc, prefix = [], out = new Map()) {
	for (const key of Object.keys(doc)) {
		if (key.startsWith('$')) continue;
		const node = doc[key];
		if (!node || typeof node !== 'object') continue;
		if ('$value' in node) {
			out.set([...prefix, key].join('.'), {
				value: node.$value,
				type: node.$type ?? null,
				description: node.$description ?? null,
			});
		} else {
			flatten(node, [...prefix, key], out);
		}
	}
	return out;
}

/** Read one token file and return its flattened tokens plus its metadata. */
export function loadFile(path) {
	const doc = JSON.parse(readFileSync(path, 'utf8'));
	const ext = doc.$extensions?.['com.hearst.design-system'] ?? {};
	return {
		tokens: flatten(doc),
		extends: ext.extends ?? null,
		collection: ext.collection ?? null,
		fonts: ext.fonts ?? null,
	};
}

/**
 * Merge the extends chain into one token set.
 * Later files win, which is what makes a brand override an alias.
 */
export function mergeChain(dir, brandName) {
	const chain = [];
	let current = brandName;
	const guard = new Set();
	while (current && !guard.has(current)) {
		guard.add(current);
		const file = loadFile(join(dir, `${current}.json`));
		chain.unshift({ name: current, ...file });
		current = file.extends;
	}
	// primitives sit below everything and are not reached by `extends`
	if (!guard.has('primitives')) {
		chain.unshift({ name: 'primitives', ...loadFile(join(dir, 'primitives.json')) });
	}

	const merged = new Map();
	const origin = new Map();
	for (const layer of chain) {
		for (const [k, v] of layer.tokens) {
			merged.set(k, v);
			origin.set(k, layer.name);
		}
	}
	return { merged, origin, chain: chain.map((c) => c.name) };
}

const REF = /^\{([^}]+)\}$/;

/**
 * Resolve one token to a literal, following `{reference}` chains.
 * Returns { value, chain, status } where status is resolved | dangling | circular.
 */
export function resolveToken(merged, key, seen = new Set()) {
	const chain = [key];
	let node = merged.get(key);
	if (!node) return { value: null, chain, status: 'dangling' };

	let value = node.value;
	let guard = 0;
	while (typeof value === 'string' && REF.test(value)) {
		if (guard++ > 24) return { value: null, chain, status: 'circular' };
		const target = value.match(REF)[1];
		if (seen.has(target)) return { value: null, chain: [...chain, target], status: 'circular' };
		seen.add(target);
		chain.push(target);
		const next = merged.get(target);
		if (!next) return { value: null, chain, status: 'dangling' };
		value = next.value;
	}
	return { value, chain, status: 'resolved' };
}

/** Resolve every token in a merged set. */
export function resolveAll(merged) {
	const out = new Map();
	for (const key of merged.keys()) out.set(key, resolveToken(merged, key, new Set([key])));
	return out;
}

/** Every brand file in the directory — everything that is not a shared layer. */
export function listBrands(dir) {
	const shared = new Set(['primitives', 'alias_base_theme']);
	return readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => f.replace(/\.json$/, ''))
		.filter((n) => !shared.has(n))
		.sort();
}
