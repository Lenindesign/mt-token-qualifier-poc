/**
 * Orchestrator. Builds the token graph, runs every rule, returns one Report.
 */

import { readFileSync } from 'node:fs';
import { buildGraph } from './parse/ids-css.mjs';
import { resolveAll } from './parse/resolve.mjs';
import { scanComponents } from './parse/variants.mjs';
import { selfTest } from './color/wcag.mjs';
import { JevClient } from './jev/client.mjs';
import { structureRules } from './rules/structure.mjs';
import { accessibilityRules } from './rules/accessibility.mjs';
import { motortrendRules } from './rules/motortrend.mjs';
import { judgmentRules } from './rules/judgment.mjs';

export const RULE_CLASS = {
	'ST-01': 'D', 'ST-02': 'D', 'ST-03': 'D', 'ST-04': 'D', 'ST-05': 'D', 'ST-06': 'D', 'ST-07': 'D',
	'AX-01': 'D', 'AX-02': 'D', 'AX-03': 'D', 'AX-04': 'D', 'AX-05': 'D',
	'MT-02': 'D', 'MT-03': 'D', 'MT-05': 'D', 'MG-01': 'D',
	'MG-02': 'J',
	'NM-01': 'J', 'NM-02': 'J', 'NM-03': 'J', 'NM-05': 'J', 'MT-01': 'J', 'MT-04': 'J',
};

export function loadConfig(repoRoot, path = 'tools/token-qualifier/config/qualifier.json') {
	const config = JSON.parse(readFileSync(`${repoRoot}/${path}`, 'utf8'));
	config.sources.hdsCss =
		config.sources.hdsCss ?? `${process.env.HOME}/Projects/fre/node_modules/@media-platforms/hearst-design-system/dist/index.css`;
	return config;
}

/** Extract IDS's `@utility typography-*` classes, which are not tokens (R8). */
function typographyVariants(repoRoot, config) {
	try {
		const css = readFileSync(`${repoRoot}/${config.sources.base[0]}`, 'utf8');
		const out = [];
		for (const m of css.matchAll(/@utility\s+(typography-[a-z0-9]+)\s*\{([^}]*)\}/g)) {
			const body = m[2];
			out.push({
				name: m[1],
				fontSize: body.match(/font-size:\s*([^;]+)/)?.[1]?.trim() ?? null,
				lineHeight: body.match(/line-height:\s*([^;]+)/)?.[1]?.trim() ?? null,
				weight: /font-bold/.test(body) ? 'bold' : /font-semibold/.test(body) ? 'semibold' : 'regular',
				tokenized: /var\(--/.test(body),
			});
		}
		return out;
	} catch {
		return [];
	}
}

export async function qualify({ repoRoot, config, theme, ruleFilter = null, jevOverrides = {} } = {}) {
	selfTest(); // never report a contrast number from an unverified implementation

	const activeTheme = theme ?? config.primaryTheme;
	const themeFiles = (config.sources.themes[activeTheme] ?? []).map((f) => `${repoRoot}/${f}`);
	const graph = buildGraph({
		baseFiles: config.sources.base.map((f) => `${repoRoot}/${f}`),
		themeFiles,
		theme: activeTheme,
	});

	const resolutions = resolveAll(graph);
	const { components, byToken } = scanComponents(`${repoRoot}/${config.sources.components}`, {
		include: config.components.include,
	});
	const typography = typographyVariants(repoRoot, config);

	const jev = new JevClient({
		enabled: config.jev.enabled,
		model: config.jev.model,
		cachePath: config.jev.cache ? `${repoRoot}/tools/token-qualifier/${config.jev.cache}` : null,
		...jevOverrides,
	});

	const ctx = { graph, resolutions, components, byToken, config, repoRoot, jev, typography };
	const results = [];

	for (const rule of [...structureRules, ...accessibilityRules, ...motortrendRules]) {
		results.push(...(rule(ctx) ?? []));
	}
	for (const rule of judgmentRules) {
		results.push(...((await rule(ctx)) ?? []));
	}

	// Annotate class and band, then order by severity for the report.
	const blocking = new Set(config.bands.blocking);
	for (const r of results) {
		r.class = r.class ?? RULE_CLASS[r.rule] ?? 'D';
		r.band = blocking.has(r.rule) && r.class === 'D' ? 'A' : r.class === 'J' ? 'B' : 'C';
		r.blocking = r.band === 'A' && r.verdict === 'FAIL' && config.enforcement.mode === 'blocking';
	}

	const filtered = ruleFilter ? results.filter((r) => ruleFilter.includes(r.rule)) : results;
	const ORDER = { FAIL: 0, REVIEW: 1, WARN: 2, UNKNOWN: 3, SKIPPED: 4, PASS: 5 };
	filtered.sort((a, b) => (ORDER[a.verdict] ?? 9) - (ORDER[b.verdict] ?? 9) || a.rule.localeCompare(b.rule));

	const counts = filtered.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] ?? 0) + 1), acc), {});
	const blockingFailures = filtered.filter((r) => r.band === 'A' && r.verdict === 'FAIL');

	return {
		meta: {
			generatedAt: new Date().toISOString(),
			theme: activeTheme,
			themes: Object.keys(config.sources.themes),
			tokenCount: graph.tokens.size,
			referenceCount: graph.references.length,
			componentCount: components.size,
			typographyVariants: typography.length,
			typographyTokenized: typography.filter((t) => t.tokenized).length,
			enforcement: config.enforcement.mode,
			jev: jev.stats(),
			wcagSelfTest: 'passed',
		},
		counts,
		blockingFailures: blockingFailures.length,
		exitCode: config.enforcement.mode === 'blocking' && blockingFailures.length ? 1 : 0,
		results: filtered,
		jevPayloads: jev.payloads,
		components: [...components.values()].map((c) => ({
			name: c.name,
			alias: config.components.aliases?.[c.name] ?? null,
			files: c.files.size,
			tokenUsages: c.usages.length,
			distinctTokens: new Set(c.usages.map((u) => u.token)).size,
			rawValues: c.rawValues.length,
		})),
		impact: Object.fromEntries([...byToken.entries()].map(([token, set]) => [token, [...set]])),
	};
}
