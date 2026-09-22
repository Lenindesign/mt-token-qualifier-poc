#!/usr/bin/env node
/**
 * CLI for the token qualifier.
 *
 *   npm run tokens:qualify              human report to stdout
 *   npm run tokens:report               human report to token-report.md
 *   npm run tokens:check                machine-readable JSON, CI exit code
 *
 * Flags:
 *   --format=md|json|summary   output shape (default: md)
 *   --out=<path>               write to a file instead of stdout
 *   --theme=<name>             which brand theme to resolve against
 *   --all-themes               run every theme and merge the summaries
 *   --rule=ST-01,AX-03         restrict to specific rules
 *   --fail-on=fail|never       override the configured enforcement mode
 *   --repo-root=<path>         defaults to two levels above this file
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, qualify } from '../src/index.mjs';
import { renderMarkdown } from '../src/report/markdown.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
	const hit = args.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : args.includes(`--${name}`) ? true : fallback;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(flag('repo-root') || resolve(here, '../../..'));

const config = loadConfig(repoRoot);
if (flag('fail-on') === 'fail') config.enforcement.mode = 'blocking';
if (flag('fail-on') === 'never') config.enforcement.mode = 'advisory';

const ruleFilter = flag('rule') ? String(flag('rule')).split(',').map((s) => s.trim().toUpperCase()) : null;
const themes = flag('all-themes') ? Object.keys(config.sources.themes) : [flag('theme') || config.primaryTheme];

// Jev, the judgment layer. Auto-enables when TYPESAFE_API_KEY is present.
//   --jev          force on (errors clearly if no key)
//   --no-jev       force off
//   --jev-dry-run  build and print the exact payloads WITHOUT sending them,
//                  so the data that would leave can be reviewed first
const jevOverrides = {};
if (flag('jev-dry-run')) {
	jevOverrides.dryRun = true;
	jevOverrides.enabled = true;
}
if (flag('jev')) jevOverrides.enabled = true;
if (flag('no-jev')) jevOverrides.enabled = false;

const reports = [];
for (const theme of themes) {
	reports.push(await qualify({ repoRoot, config, theme, ruleFilter, jevOverrides }));
}

if (flag('jev-dry-run')) {
	const payloads = reports.flatMap((r) => r.jevPayloads ?? []);
	const questions = payloads.reduce((n, p) => n + Object.keys(p.questions).length, 0);
	process.stderr.write(
		`\nJev dry run — ${payloads.length} request(s), ${questions} question(s). Nothing was sent.\n` +
			`Endpoint that would be called: POST https://api.typesafe.ai/v1/systemone\n\n`,
	);
	process.stdout.write(JSON.stringify(payloads, null, 2) + '\n');
	process.exit(0);
}

const format = flag('format', 'md');
const primary = reports[0];

let output;
if (format === 'json') {
	output = JSON.stringify(reports.length === 1 ? primary : { themes: reports }, null, 2);
} else if (format === 'summary') {
	output = reports
		.map((r) => {
			const c = r.counts;
			return `${r.meta.theme.padEnd(14)} FAIL ${c.FAIL ?? 0}  REVIEW ${c.REVIEW ?? 0}  WARN ${c.WARN ?? 0}  SKIPPED ${c.SKIPPED ?? 0}  PASS ${c.PASS ?? 0}  | blocking-eligible failures: ${r.blockingFailures}`;
		})
		.join('\n');
} else {
	output = reports.map(renderMarkdown).join('\n\n---\n\n');
}

const out = flag('out');
if (out) {
	writeFileSync(resolve(repoRoot, String(out)), output);
	const c = primary.counts;
	process.stderr.write(
		`Wrote ${out} — ${c.FAIL ?? 0} FAIL, ${c.REVIEW ?? 0} REVIEW, ${c.WARN ?? 0} WARN, ${c.SKIPPED ?? 0} SKIPPED, ${c.PASS ?? 0} PASS` +
			` (${primary.blockingFailures} blocking-eligible)\n`,
	);
} else {
	process.stdout.write(output + '\n');
}

process.exit(Math.max(...reports.map((r) => r.exitCode)));
