# Token Qualifier

Evaluates IDS design tokens before they reach production: structure, naming, accessibility and MotorTrend brand rules. Every check returns **PASS / WARN / FAIL** (plus `REVIEW`, `SKIPPED`, `UNKNOWN`) with the token or component evaluated, the rule, the actual value, the expected threshold, an explanation, a recommended action, and the affected components.

> **Status: enforcement enabled.** Six deterministic rules now fail the build; everything else annotates without gating. The tool itself is read-only — it parses CSS and prints a report — and no CI job is wired yet.

---

## Quick start

No install needed — zero dependencies, Node 20+.

```bash
node tools/token-qualifier/bin/qualify.mjs
```

Once the scripts below are added to `package.json`:

```bash
npm run tokens:qualify     # human-readable report to stdout
npm run tokens:report      # writes token-report.md
npm run tokens:check       # JSON + CI exit code
```

### Scripts

Added to `package.json`:

```json
"tokens:qualify": "node tools/token-qualifier/bin/qualify.mjs",
"tokens:report": "node tools/token-qualifier/bin/qualify.mjs --format=md --out=token-report.md",
"tokens:check": "node tools/token-qualifier/bin/qualify.mjs --format=json --fail-on=fail",
"tokens:test": "node --test \"tools/token-qualifier/test/**/*.test.mjs\""
```

### Flags

| Flag | Effect |
|---|---|
| `--format=md\|json\|summary` | output shape (default `md`) |
| `--out=<path>` | write to a file instead of stdout |
| `--theme=<name>` | resolve against one brand theme |
| `--all-themes` | run every theme — `motortrend`, `hotrod`, `caranddriver` |
| `--rule=ST-01,AX-03` | restrict to specific rules |
| `--fail-on=fail\|never` | override the configured enforcement mode |

```bash
# Did my change break contrast anywhere, on any brand?
node tools/token-qualifier/bin/qualify.mjs --all-themes --rule=AX-01,AX-02,AX-03 --format=summary
```

---

## How it works

```
src/tailwind/ids.css ─┐
themes/<brand>.css ───┼─→ parse/ids-css.mjs ──→ TokenGraph
src/tailwind/config.ts┘                            │
                                                   ├─→ parse/resolve.mjs   (var() chains, cycle detection)
src/components/**/*.tsx ─→ parse/variants.mjs ─────┤   (cva classes → token edges, impact analysis)
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                          Class D — rules/            Class J — jev/  (LIVE)
                          deterministic, offline      Jev typed judgments
                                    └──────────────┬──────────────┘
                                                   ▼
                                    report/markdown.mjs · JSON
```

### Two classes of rule, and why the split matters

**Class D — deterministic.** Arithmetic and graph traversal in plain JavaScript. Offline, free, reproducible byte-for-byte. **Only Class D may block a pull request**, because a developer must be able to re-run a blocking verdict locally and get the identical answer. Nobody should have to argue with a probability to land a change.

**Class J — judgment, via [Jev](https://docs.typesafe.ai).** The rules in the brief that have no algorithm: is `crimson` a colour word or a role? Do two same-valued tokens mean the same thing? Which tier does this token really belong to? Jev returns a typed answer *and* a calibrated probability, so a low-confidence answer routes to a designer instead of failing a build.

TypeSafe's own guidance is *"keep control flow, deterministic rules, and side effects in code"* — so contrast ratios, cycle detection and scale membership never go to the model. Putting them there would make them slower, probabilistic, and unreproducible, for no gain.

**Class H — human.** Reported, never automated: reliance on colour alone, editorial hierarchy, and which tokens count as legal surfaces. *(Approved typography moved out of this class once the theme docs were read — it is now `MT-05`.)*

---

## The rules

### Class D — Structure

| ID | Checks | Default |
|---|---|---|
| `ST-01` | every `var()` reference resolves to a defined or declared-external token | FAIL |
| `ST-02` | no circular alias references | FAIL |
| `ST-03` | resolved value matches the type the name implies | FAIL |
| `ST-04` | duplicated values agree; generated config in sync with source | WARN/FAIL |
| `ST-05` | self-referential fallback pattern resolves under Tailwind layer order | WARN |
| `ST-06` | no orphaned tokens | WARN |
| `ST-07` | every shipped ramp token appears in the documented palette | WARN |

### Class D — Accessibility

| ID | Checks | Default |
|---|---|---|
| `AX-01` | text contrast ≥ 4.5:1 on every surface **in the token's own colour scheme** | FAIL |
| `AX-02` | large text / icons / UI boundaries ≥ 3:1 | WARN |
| `AX-03` | focus indicator ≥ 3:1 vs. its offset — WCAG 2.2 SC 1.4.11 | FAIL |
| `AX-04` | disabled state distinguishable by ≥ 3:1 or a non-colour property | WARN |
| `AX-05` | interactive target ≥ 24×24px (SC 2.5.8 AA), ≥ 44×44px (SC 2.5.5 AAA) | WARN |

### Class D — MotorTrend and migration

| ID | Checks | Default |
|---|---|---|
| `MT-02` | spacing on the approved scale — reports a coverage gap, since IDS has no spacing tokens | WARN |
| `MT-03` | breakpoints match the approved set | FAIL *(pending)* |
| `MT-05` | font tokens resolve to the brand's documented families | WARN |
| `MG-01` | every IDS token has a declared HDS migration mapping | WARN |

### Class J — Judgment (live)

| ID | Primitive | Judgment | Gate |
|---|---|---|---|
| `NM-01` | `Noul` | name follows the documented grammar | 0.90 |
| `NM-02` | `Choice` | role vs. colour-word vs. bare-index naming | advisory only |
| `NM-03` | `Choice` | primitive / semantic / component tier, judged by meaning | 0.85 |
| `NM-05` | `Noul` | same-valued tokens: redundant, or coincidence? | 0.90 |
| `MT-01` | `Choice` | approved MotorTrend palette membership | 0.85 |
| `MT-04` | `Score` | editorial hierarchy coherence | never blocks — **self-reports inconclusive** |

`NM-02` is advisory by design. IDS documents that its numbered naming deliberately mirrors the UX team's Figma names, so a FAIL there would overrule an intentional decision. It informs the migration conversation instead.

---

## Adding a rule

1. **Pick the class.** Can you compute the answer from values and the graph? Class D. Does it need semantic understanding? Class J. Does it need a designer's eye? Class H — report it, do not automate it.

2. **Write it** in `src/rules/{structure,accessibility,motortrend}.mjs` (Class D) or `src/rules/judgment.mjs` + `src/jev/questions.mjs` (Class J). A rule is a function of the context object returning an array of results:

```js
export function ST07({ graph, resolutions, components, byToken, config, repoRoot, jev }) {
  return [{
    verdict: 'FAIL',                    // PASS | WARN | FAIL | REVIEW | SKIPPED | UNKNOWN
    rule: 'ST-07',
    ruleName: 'Short human-readable name',
    subject: '--color-primary-2',       // the token or component evaluated
    subjectType: 'token',               // token | component | category | graph | file
    location: 'ids.css:16',             // optional
    actual: '#e90c17',
    expected: 'a value that ...',
    explanation: 'Why this matters, in a sentence or two a non-author can act on.',
    recommendation: 'The specific change to make.',
    affects: [...(byToken.get('color-primary-2') ?? [])],
  }];
}
```

3. **Register it** in `src/index.mjs` — add to the exported array and give it a class in `RULE_CLASS`.

4. **Decide its band** in `config/qualifier.json`. Put it in `advisory` unless it is deterministic, unambiguous, and currently clean on `main`.

5. **Write both tests.** A fixture that makes it fire, and one that makes it stay quiet. A rule that only ever fails is as useless as one that never does:

```bash
node --test "tools/token-qualifier/test/**/*.test.mjs"
```

### Rules that produce noise are worse than no rule

Four false positives were found and fixed while building this, each one now pinned by a `REGRESSION` test:

| What went wrong | Why it mattered |
|---|---|
| `AX-01` compared every token against light **and** dark surfaces | Nothing can pass both. Reported 26 failures out of 26 tokens — pure noise |
| `ST-05` flagged IDS's `--font-*` tokens | They are injected at runtime by the host app; 6 false failures buried the one real finding |
| `AX-03` demanded a focus ring on `Typography` | It renders no focusable element |
| The scanner counted `*.stories.tsx` | Card's twelve `88px` literals are demo code, not shipped styling |

Before adding a rule, run it against all three themes and read every result. If more than a handful fire, the rule is probably wrong — not the design system.

---

## Enabling the judgment layer

Stubbed on purpose. `jev.enabled` is `false`, no API key is needed, and every Class J rule reports `SKIPPED` with a reason.

Two reasons for that default:

1. **`tokens:check` must work with no network.** A governance gate that fails closed during a third-party outage gets switched off within a week. Class D alone produces a valid blocking report.
2. **The thresholds are guesses.** 0.85 and 0.90 are placeholders. Shipping a judgment rule as blocking before measuring its confidence distribution would be asserting a calibration nobody has checked.

To enable:

```bash
npm install @typesafe-ai/sdk
export TYPESAFE_API_KEY=...
```

Set `jev.enabled: true` in `config/qualifier.json`, then implement `callJev` in `src/jev/client.mjs` — the intended body is in the docblock there. Everything else (questions, caching, interpretation, reporting) already works.

**Note on data egress:** enabling this sends token names and resolved colour values to `api.typesafe.ai`. Low sensitivity, but it is a decision to make deliberately.

### Promoting a judgment rule to blocking

1. Run with `jev.enabled: true` across all three themes.
2. Export the confidence distribution: `--format=json | jq '[.results[] | select(.class=="J") | .confidence]'`.
3. Have a designer label a sample of the answers as correct or incorrect.
4. Choose the gate where precision is acceptable **for the consequence of blocking a PR**.
5. Only then move the rule from `advisory` to `blocking` in `config/qualifier.json`.

Skipping steps 3–4 means guessing. `Score` and `Choice` confidence describes how concentrated the answer distribution is — not whether the workflow is correct.

#### Generating the labelling sheet

```bash
node tools/token-qualifier/bin/calibrate.mjs > calibration.csv
# designer fills the `correct?` column with y/n
node tools/token-qualifier/bin/calibrate.mjs --analyse calibration.csv
```

It emits 84 judgments sorted by confidence **ascending**, because the useful region is the boundary — a reviewer's time is better spent near the gate than on answers the model was already certain about. The analysis prints precision at each candidate threshold and names the lowest one reaching 95%. About 30 labelled rows spanning the range is enough to tell whether a gate is roughly right.

A rule that cannot reach acceptable precision at *any* threshold stays advisory, however useful its output is to read. `MT-04` is the live example: it scored all 16 typography variants within 0.09 of each other at 0.29 median confidence, so it self-reports as inconclusive rather than emitting 16 misleading passes.

#### One trap worth knowing

A `Noul` of `0.5` means *"yes and no are equally likely"* — **not** *"half compliant"*. Values in `0.4–0.6` route to `REVIEW`. Treating that band as a partial pass would silently corrupt every judgment result, which is why it is pinned by a regression test.

---

## Configuration

Everything policy-shaped lives in `config/qualifier.json`, separate from rule code, so intent can change without touching implementation.

### `surfaces` needs design sign-off

The most important field, and the clearest boundary between automation and human judgment:

```json
"surfaces": {
  "$signedOffBy": null,
  "light": ["color-neutral-8", "color-neutral-7", "color-neutral-6"],
  "dark": ["color-neutral-1"],
  "literals": ["#ffffff"]
}
```

A colour is only "inaccessible" relative to the backgrounds it is actually placed on. This list was **inferred from IDS usage, not confirmed by design**. Shrinking it hides real failures; padding it invents false ones. Every `AX-01`/`AX-02` verdict depends on it, so `$signedOffBy` should be filled in before enforcement is enabled.

### `external`

Variables intentionally defined outside IDS — Radix runtime values, and the `--font-*` tokens the host application injects. Referencing these is correct. Without this list `ST-01` reports false positives that bury the real defect.

### `enforcement`

`bands.blocking` lists rules *eligible* to block. `enforcement.mode` decides whether any of them actually do. Ships as `advisory`.

---

## CI integration

**Not wired.** Below is the recommended path, in order.

### Phase 1 — advisory (start here)

Add a job to `.github/workflows/tests.yml` alongside `build` and `test`:

```yaml
  tokens:
    name: Token Qualification
    runs-on: general-arc-runner-js-mt
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - name: Qualify tokens
        run: |
          node tools/token-qualifier/bin/qualify.mjs --all-themes --format=md >> "$GITHUB_STEP_SUMMARY"
      - name: Machine-readable report
        run: node tools/token-qualifier/bin/qualify.mjs --format=json --out=token-report.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: token-report-${{ github.run_id }}
          path: token-report.json
```

No `npm ci` needed — zero dependencies. The report lands in the PR's job summary where a reviewer will actually read it.

### Phase 2 — fix what fails on `main` ✅

Done for two of them. The focus-ring defect (AX-03) and the dangling token reference (ST-01) are fixed on this branch, which is what made enforcement possible.

**Never enable a blocking rule that already fails on `main`** — the first unrelated PR after enablement gets blocked by someone else's bug, and the check loses its mandate immediately.

Two deterministic rules still fail and are therefore held in `bands.pending` rather than `bands.blocking`:

| Rule | Why it still fails | What unblocks it |
|---|---|---|
| `AX-01` | 4 tokens fail 4.5:1 on some approved light surfaces | Design adjusts those values, or narrows `surfaces` (which still needs `$signedOffBy`) |
| `MT-03` | IDS and HDS breakpoints disagree on 3 of 5 steps | Agreeing one breakpoint set as part of the migration; not fixable inside IDS |

Both are real defects, not rule bugs. Promote them to `blocking` once clean.

### Phase 3 — block on the clean rules ✅

`enforcement.mode` is now `"blocking"`, gating `ST-01`, `ST-02`, `ST-03`, `ST-04`, `AX-02`, `AX-03`. Verified end to end: clean branch exits 0; reintroducing the plural-typo regression exits 1; restoring exits 0.

Still to do: add the check to branch protection with a **stable job name** — renaming a required check silently un-protects the branch.

### Phase 4 — impact comments and visual regression

Post the token → component impact table as a PR comment so a reviewer sees which components a token change touches. Then tie changed tokens to Chromatic modes, which IDS already has configured for light/dark × desktop/mobile.

### Phase 5 — pre-commit

Only once the report is reliably clean. `.lintstagedrc.js` already exists. Add it last: local friction before the check is trusted is how tooling gets bypassed.

---

## Known limits

- **Impact analysis covers only the scanned components** (`components.include` — currently Button, Card, Typography). A token used elsewhere in IDS, or by a downstream consumer, will show fewer affected components than reality. This is why `ST-06` orphan detection is WARN, not FAIL.
- **IDS typography is not tokenized.** The 16 `typography-*` variants are `@utility` classes with hardcoded `rem` values, so they cannot be checked as tokens. `MT-04` reads them from CSS instead.
- **No spacing tokens exist**, so `MT-02` reports a coverage gap rather than passing by vacuum.
- **HDS comparison needs a local `fre` checkout.** `MG-01` degrades gracefully when absent.
- **Class J is stubbed**, so six rules report `SKIPPED`.
- **Contrast assumes opaque compositing over a single surface.** Layered translucency and gradients are not modelled.
- **`AX-05` reads `max-h-*` as a target height.** That is a maximum, not a minimum, so a real rendered target could differ.

---

## Layout

```
tools/token-qualifier/
├── README.md                  this file
├── SAMPLE-REPORT.md           generated output, committed as a reference
├── bin/qualify.mjs            CLI
├── config/qualifier.json      all policy: surfaces, scales, bands, gates
├── src/
│   ├── index.mjs              orchestrator
│   ├── color/wcag.mjs         contrast math + self-test
│   ├── parse/                 ids-css · resolve · variants
│   ├── rules/                 structure · accessibility · motortrend · judgment
│   ├── jev/                   client (stub) · questions · cache
│   └── report/markdown.mjs
└── test/
    ├── fixtures/{valid,invalid,jev}/
    └── rules.test.mjs         41 tests, including 6 regression guards
```
