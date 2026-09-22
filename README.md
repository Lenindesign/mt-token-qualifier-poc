# MotorTrend Design Token Qualification — Proof of Concept

Research package for the IDS → HDS consolidation. Everything here is read-only
analysis; nothing in this folder changes a production system.

**Start here:** [Ignition Token Audit](https://claude.ai/artifact/DaSzEebpgMUJ1sa2HWv9kx)
— the narrative version, shared with the Hearst org. Read that first if you only
have ten minutes.

---

## What's in this folder

| File | What it is | Who it's for |
|---|---|---|
| `AUDIT.md` | The full audit — token architecture, nine verified defects, rule design, gating policy, open questions | Anyone going deeper than the artifact |
| `MIGRATION-ANALYSIS.txt` | IDS → HDS numbers: scale, brand reach, colour equivalence, category coverage, breakpoints | Migration planning |
| `SAMPLE-REPORT.md` | Example output of a full qualification run | Anyone deciding whether to adopt the tool |
| `token-qualifier/` | The tool itself — 22 rules, 41 tests, zero dependencies | Engineers |
| `fixes/*.patch` | The two accessibility fixes as reviewable patches | Whoever lands them |

---

## The five findings that matter

1. **Keyboard focus is invisible in light mode on every IDS component.** The ring
   was `secondary-2` `#33ccff` over a `neutral-8` `#fcfcfd` offset — **1.83:1**
   where WCAG 2.2 SC 1.4.11 requires 3:1. Fixed in `fixes/0001`.

2. **HDS has exactly one brand slot.** `--color-palette-brand-1` drives 56 tokens;
   hooks 2–14 drive **zero**. MotorTrend has six brand colours, and HDS has no
   secondary or accent role at all. The three blues have nowhere to go.

3. **HDS has no focus tokens.** Not one, in 2,965. So finding #1 regresses on
   migration unless HDS adds them.

4. **HDS brand values aren't in version control.** They arrive at runtime from
   Voltron, so contrast cannot be verified in CI after migration.

5. **Breakpoints disagree under the same names.** Only `md` and `lg` match;
   `sm` moves 640→320px and `xl` moves 1280→1440px. A component moved across
   changes behaviour with nothing in the diff to review.

Items 2, 3 and 4 are upstream asks on the HDS team. They block the migration
rather than delay it.

---

## Running the tool

Zero dependencies, Node 20+. It reads a checkout of
[`motortrend/ignition-design-system`](https://github.com/motortrend/ignition-design-system),
so clone that first:

```bash
git clone https://github.com/motortrend/ignition-design-system.git
cp -R token-qualifier ignition-design-system/tools/
cd ignition-design-system
node tools/token-qualifier/bin/qualify.mjs
```

| Command | What it does |
|---|---|
| `bin/qualify.mjs` | Human-readable report |
| `bin/qualify.mjs --format=json` | Machine-readable, for CI |
| `bin/qualify.mjs --all-themes` | All three brands at once |
| `bin/migrate.mjs` | IDS → HDS migration analysis |
| `bin/calibrate.mjs` | Emits a labelling sheet for validating the judgment layer |
| `node --test "tools/token-qualifier/test/**/*.test.mjs"` | 41 tests |

`bin/migrate.mjs` additionally needs a local `fre` checkout with `node_modules`
installed, for the HDS build. It fails with a clear message if that's missing.

The judgment layer (6 of the 22 rules) calls
[Jev](https://docs.typesafe.ai) and needs `TYPESAFE_API_KEY`. Without a key it
reports `SKIPPED` and the other 16 rules still work — deliberately, so the gate
survives a third-party outage. `--jev-dry-run` prints exactly what would be sent
before you spend anything.

Full detail in `token-qualifier/README.md`, including how to add a rule and how
to wire CI.

---

## How the rules are split, and why it matters

**Class D — deterministic (16 rules).** Arithmetic and graph traversal. Offline,
free, reproducible byte-for-byte. **Only these can fail a build**, because a
developer must be able to re-run a blocking verdict locally and get the identical
answer. Nobody should have to argue with a probability to land a change.

**Class J — judgment (6 rules).** The checks with no algorithm: do two
same-valued tokens share intent? Which tier does a token belong to? Answered by
Jev as typed values with calibrated probabilities. Below a confidence gate an
answer routes to a designer instead of failing a build. All six are currently
**advisory** — the thresholds are unvalidated guesses until a designer labels a
sample via `bin/calibrate.mjs`.

**Class H — human.** Reported, never automated: reliance on colour alone,
editorial hierarchy, and which tokens count as legal background surfaces.

---

## Honest limits

- **Impact analysis covers three components** (Button, Card, Typography), so a
  token used elsewhere under-reports.
- **`surfaces` in `config/qualifier.json` has not been signed off by design.**
  Every contrast verdict depends on that list; it was inferred from usage.
- **The judgment gates (0.85 / 0.90) are invented numbers.** One live run proves
  the integration works; it does not validate calibration.
- **HDS was read from its built `dist`**, not its source repo or Figma setup.
- **Contrast assumes opaque compositing over a single surface** — layered
  translucency and gradients aren't modelled.
- **The rendered IDS Storybook** (`ids.motortrend.com`) is behind SSO and was
  read by building it locally instead.

## Where the code lives

Committed locally on branch `fix/token-qualifier-and-a11y` in a clone of
`motortrend/ignition-design-system`. **Nothing has been pushed.** This folder is
a copy for sharing.
