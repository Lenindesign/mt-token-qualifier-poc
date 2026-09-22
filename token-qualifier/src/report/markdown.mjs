/**
 * Human-readable report.
 *
 * Written for the developer in the success criterion: change a token, run one
 * command, understand whether the change is valid, what it affects, and whether
 * it is safe to merge. So: verdict first, blocking status explicit, affected
 * components named, and a concrete recommendation on every finding.
 */

const ICON = { FAIL: '🔴', REVIEW: '🟠', WARN: '🟡', UNKNOWN: '⚪', SKIPPED: '⚫', PASS: '🟢' };

function summaryLine(report) {
	const { counts } = report;
	const order = ['FAIL', 'REVIEW', 'WARN', 'UNKNOWN', 'SKIPPED', 'PASS'];
	return order
		.filter((v) => counts[v])
		.map((v) => `${ICON[v]} ${counts[v]} ${v}`)
		.join(' · ');
}

function finding(r) {
	const lines = [];
	lines.push(`#### ${ICON[r.verdict]} ${r.verdict} — ${r.rule} · ${r.subject}`);
	lines.push('');
	lines.push(`**Rule:** ${r.ruleName}${r.location ? ` · \`${r.location}\`` : ''}  `);
	lines.push(`**Class:** ${r.class === 'D' ? 'deterministic' : r.class === 'J' ? 'judgment (Jev)' : 'human'} · **Band ${r.band}**${r.band === 'A' ? ' (eligible to block)' : ' (advisory)'}  `);
	if (r.confidence != null) lines.push(`**Confidence:** ${r.confidence.toFixed(2)}  `);
	if (r.probability != null) lines.push(`**Probability:** ${r.probability.toFixed(2)}  `);
	lines.push('');
	lines.push(`**Actual:** ${r.actual}  `);
	lines.push(`**Expected:** ${r.expected}`);
	lines.push('');
	lines.push(r.explanation);
	lines.push('');
	if (r.affects?.length) {
		lines.push(`**Affects:**`);
		for (const a of r.affects) lines.push(`- ${a}`);
		lines.push('');
	}
	lines.push(`**Recommendation:** ${r.recommendation}`);
	lines.push('');
	return lines.join('\n');
}

export function renderMarkdown(report) {
	const { meta } = report;
	const out = [];

	out.push('# MotorTrend Token Qualification Report');
	out.push('');
	out.push(`**Theme:** \`${meta.theme}\` · **Generated:** ${meta.generatedAt}`);
	out.push(`**Enforcement:** \`${meta.enforcement}\`${meta.enforcement === 'advisory' ? ' — no pull request will be blocked by this run' : ' — Band A failures block'}`);
	out.push('');
	out.push(summaryLine(report));
	out.push('');

    // Verdict banner: the one line a developer needs.
	if (report.blockingFailures) {
		out.push(
			meta.enforcement === 'blocking'
				? `> ## 🔴 Not safe to merge\n> ${report.blockingFailures} Band A failure(s) block this change.`
				: `> ## 🔴 ${report.blockingFailures} blocking-eligible failure(s)\n> Enforcement is \`advisory\`, so this run does not fail the build. These would block once enforcement is enabled.`,
		);
	} else {
		out.push(`> ## 🟢 No blocking-eligible failures\n> Advisory findings below are worth reading but do not gate a merge.`);
	}
	out.push('');

	// A judgment layer that was switched on but answered nothing must say so
	// loudly. Otherwise a broken integration is indistinguishable from a
	// disabled one, and six rules quietly stop being checked.
	if (meta.jev.failed) {
		out.push(`> ### ⚠️ Jev could not be reached — ${meta.jev.errorCount} request(s) failed`);
		for (const e of meta.jev.errors) out.push(`> \`${e}\``);
		out.push('>');
		out.push(
			'> Every judgment rule below is reported as `SKIPPED`, **not** as passing. The deterministic results are unaffected and remain valid.',
		);
		out.push('');
	}

	out.push('## Scope');
	out.push('');
	out.push('| | |');
	out.push('|---|---|');
	out.push(`| Tokens parsed | ${meta.tokenCount} |`);
	out.push(`| \`var()\` references checked | ${meta.referenceCount} |`);
	out.push(`| Components scanned | ${meta.componentCount} |`);
	out.push(`| Themes available | ${meta.themes.join(', ')} |`);
	out.push(`| Typography variants | ${meta.typographyVariants} (${meta.typographyTokenized} tokenized) |`);
	out.push(`| WCAG self-test | ${meta.wcagSelfTest} |`);
	out.push(`| Judgment layer (Jev) | ${meta.jev.enabled ? `enabled · ${meta.jev.calls} calls · ${meta.jev.cacheHits} cache hits` : `disabled — ${meta.jev.skipReason}`} |`);
	out.push('');

	out.push('## Components');
	out.push('');
	out.push('| Component | Role in PoC | Files | Token uses | Distinct tokens | Raw values |');
	out.push('|---|---|---:|---:|---:|---:|');
	for (const c of report.components) {
		out.push(`| ${c.name} | ${c.alias ?? '—'} | ${c.files} | ${c.tokenUsages} | ${c.distinctTokens} | ${c.rawValues ? `⚠️ ${c.rawValues}` : '0'} |`);
	}
	out.push('');

	// Findings grouped by verdict, worst first.
	const groups = [
		['FAIL', 'Failures'],
		['REVIEW', 'Needs human review'],
		['WARN', 'Warnings'],
		['UNKNOWN', 'Could not determine'],
		['SKIPPED', 'Not evaluated'],
	];
	for (const [verdict, title] of groups) {
		const items = report.results.filter((r) => r.verdict === verdict);
		if (!items.length) continue;
		out.push(`## ${ICON[verdict]} ${title} (${items.length})`);
		out.push('');
		for (const r of items) out.push(finding(r));
	}

	const passes = report.results.filter((r) => r.verdict === 'PASS');
	if (passes.length) {
		out.push(`## 🟢 Passing (${passes.length})`);
		out.push('');
		out.push('<details><summary>Show passing checks</summary>');
		out.push('');
		out.push('| Rule | Subject | Actual |');
		out.push('|---|---|---|');
		for (const r of passes) out.push(`| ${r.rule} | ${r.subject} | ${String(r.actual).replace(/\|/g, '\\|').slice(0, 120)} |`);
		out.push('');
		out.push('</details>');
		out.push('');
	}

	out.push('## Token → component impact');
	out.push('');
	out.push('Which components break if a token changes. Limited to the scanned component set.');
	out.push('');
	out.push('| Token | Used by |');
	out.push('|---|---|');
	for (const [token, components] of Object.entries(report.impact).sort()) {
		out.push(`| \`--${token}\` | ${components.join(', ')} |`);
	}
	out.push('');

	out.push('---');
	out.push('');
	out.push('Generated by `npm run tokens:report` · see `tools/token-qualifier/README.md` to add or change a rule.');
	out.push('');

	return out.join('\n');
}
