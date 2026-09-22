#!/usr/bin/env node
/**
 * Emit a labelling sheet so a designer can validate Jev's judgments.
 *
 * This is the one step standing between the judgment rules being *advisory*
 * and being *defensible*. The confidence gates in config/qualifier.json (0.85,
 * 0.90) are currently invented numbers: nobody has checked where Jev's answers
 * on THIS codebase actually become trustworthy. TypeSafe's own guidance is that
 * typed output guarantees the interface, not the truth, and that thresholds
 * must be set against your own data and the consequences of being wrong.
 *
 * The workflow:
 *
 *   1. node tools/token-qualifier/bin/calibrate.mjs > calibration.csv
 *   2. A designer fills the `correct?` column with y or n.
 *   3. node tools/token-qualifier/bin/calibrate.mjs --analyse calibration.csv
 *   4. Read off the precision at each candidate threshold, pick one where
 *      precision is acceptable for the cost of blocking a pull request, and
 *      only then move that rule from `advisory` to `blocking`.
 *
 * Rows are sorted by confidence ascending, because the interesting region is
 * the boundary — a reviewer's time is better spent on the answers near the gate
 * than on the ones the model was already certain about.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, qualify } from '../src/index.mjs';

const args = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const csvCell = (v) => {
	const s = String(v ?? '').replace(/"/g, '""').replace(/\s+/g, ' ');
	return /[",]/.test(s) ? `"${s}"` : s;
};

// ---------------------------------------------------------------- analyse

if (args[0] === '--analyse' || args[0] === '--analyze') {
	const path = args[1];
	if (!path) {
		process.stderr.write('Usage: calibrate.mjs --analyse <labelled.csv>\n');
		process.exit(2);
	}

	const lines = readFileSync(path, 'utf8').trim().split('\n');
	const header = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
	const iRule = header.indexOf('rule');
	const iConf = header.indexOf('confidence');
	const iOk = header.indexOf('correct?');

	const rows = lines
		.slice(1)
		.map((l) => {
			// naive split is fine: only the free-text columns are quoted, and they sit after the ones we read
			const cells = l.split(',');
			return { rule: cells[iRule], conf: parseFloat(cells[iConf]), ok: (cells[iOk] ?? '').trim().toLowerCase() };
		})
		.filter((r) => r.ok === 'y' || r.ok === 'n');

	if (!rows.length) {
		process.stderr.write('No labelled rows found. Fill the `correct?` column with y or n.\n');
		process.exit(1);
	}

	const byRule = {};
	for (const r of rows) (byRule[r.rule] ??= []).push(r);

	process.stdout.write(`Calibration from ${rows.length} labelled judgments\n\n`);

	for (const [rule, rs] of Object.entries(byRule).sort()) {
		process.stdout.write(`${rule} — ${rs.length} labelled\n`);
		process.stdout.write('  threshold   kept   correct   precision\n');
		let best = null;
		for (const t of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
			const kept = rs.filter((r) => r.conf >= t);
			if (!kept.length) continue;
			const correct = kept.filter((r) => r.ok === 'y').length;
			const precision = correct / kept.length;
			const flag = precision >= 0.95 ? '  <- 95%+' : '';
			if (precision >= 0.95 && !best) best = { t, kept: kept.length, precision };
			process.stdout.write(
				`  ${t.toFixed(2)}        ${String(kept.length).padStart(4)}   ${String(correct).padStart(7)}   ${precision.toFixed(3)}${flag}\n`,
			);
		}
		process.stdout.write(
			best
				? `  → lowest threshold reaching 95% precision: ${best.t.toFixed(2)}, keeping ${best.kept} of ${rs.length}\n\n`
				: `  → no threshold reaches 95% precision on this sample. Keep this rule advisory.\n\n`,
		);
	}

	process.stdout.write(
		'Precision is what matters for a gate: of the answers you would act on, how many are right.\n' +
			'A rule that cannot reach acceptable precision at ANY threshold should stay advisory\n' +
			'regardless of how useful its output is to read.\n',
	);
	process.exit(0);
}

// ---------------------------------------------------------------- emit

const config = loadConfig(repoRoot);
const report = await qualify({ repoRoot, config, theme: config.primaryTheme });

const judgments = report.results
	.filter((r) => r.class === 'J' && r.confidence != null && r.subjectType === 'token')
	.sort((a, b) => a.confidence - b.confidence);

if (!judgments.length) {
	process.stderr.write('No judgment results with a confidence score. Is TYPESAFE_API_KEY set?\n');
	process.exit(1);
}

const cols = ['rule', 'subject', 'jev_answer', 'confidence', 'gate', 'above_gate', 'correct?', 'reviewer_note'];
process.stdout.write(cols.join(',') + '\n');

for (const j of judgments) {
	const gate = config.jev.thresholds[j.rule];
	process.stdout.write(
		[
			j.rule,
			csvCell(j.subject),
			csvCell(j.actual),
			j.confidence.toFixed(3),
			gate ?? '',
			gate == null ? '' : j.confidence >= gate ? 'yes' : 'no',
			'',
			'',
		].join(',') + '\n',
	);
}

process.stderr.write(
	`\n${judgments.length} judgments emitted, lowest confidence first.\n` +
		`Have a designer fill the \`correct?\` column (y/n), then:\n` +
		`  node tools/token-qualifier/bin/calibrate.mjs --analyse <file>.csv\n\n` +
		`You do not need to label all of them. ~30 rows spanning the confidence range\n` +
		`is enough to tell whether a gate is in roughly the right place.\n`,
);
