## Token qualification POC — findings

Audit and working proof of concept complete. Two links:

- **Findings, narrative form:** https://claude.ai/artifact/DaSzEebpgMUJ1sa2HWv9kx (shared org-wide, no access needed)
- **Code and reports:** https://github.com/Lenindesign/mt-token-qualifier-poc (private — ask me for access)

### What was built

A token qualifier for IDS: 23 rules, 41 tests, zero dependencies, runs before `npm install`.
Rules split by who decides — 16 deterministic (arithmetic and graph traversal, offline,
reproducible, eligible to block a build) and 7 judgment rules answered by Jev, TypeSafe's
System One model, which return a typed answer plus a calibrated confidence so uncertain cases
route to a designer rather than failing a PR.

Enforcement is live for six deterministic rules. Verified end to end: clean tree exits 0,
reintroducing a known defect exits 1.

### Verified defects in IDS

1. **Light-mode focus ring fails WCAG 2.2 SC 1.4.11.** Ring was `secondary-2` #33ccff over a
   `neutral-8` #fcfcfd offset — **1.83:1** where 3:1 is required. Keyboard focus effectively
   invisible on all 35 components. Fix is one class (`secondary-1`, 5.80:1). Neither class was
   wrong alone, which is why review and linting both missed it.
2. **Dangling token reference.** `var(--colors-neutral-4)` is plural and undefined; the dark
   scrollbar thumb had no colour. One character, twice.
3. **Four colour tokens fail contrast where they'll be used** — `primary-2`, `neutral-4`,
   `error-2`, `success-2`. The first three are safe on white and fail on our own light-grey
   surfaces, which is the shape that ships.
4. **Four tokens ship but aren't documented** — `error-4`, `info-4`, `success-4`, `warning-4`.
   The palette page hand-enumerates swatches, so adding a token doesn't add it to the docs.
5. **The font contract is unenforced.** Theme stylesheets carry zero font declarations, and
   `--font-heading` has no terminal fallback — if a consumer forgets to set it, every heading
   renders in the browser default with no error.

Patches for 1 and 2 are in the repo under `fixes/`. Neither has been landed.

### Blockers for the HDS consolidation — these need the HDS team

Measured from both token sets, not inferred:

| Finding | Measured |
|---|---|
| **HDS has one brand slot.** `brand-1` drives 56 tokens; hooks 2–14 drive **zero**. MotorTrend has six brand colours and HDS has no secondary or accent role, so our blue palette has nowhere to go. | 1.8% of HDS is brand-reachable |
| **HDS has no focus tokens.** Defect #1 above regresses on migration, and the rule that caught it has nothing to check. | 0 of 2,965 |
| **HDS brand values aren't in version control.** They arrive at runtime from Voltron, so contrast can't be verified in CI after migration. | 13 of 14 hooks default to `#fff` |
| **Breakpoints disagree under the same names.** A component moved across changes responsive behaviour with nothing in the diff. | 2 of 5 agree |
| **Neutrals aren't equivalent.** Our mid-ramp greys carry a blue cast; HDS's are hue-neutral, and neutrals aren't brand-reachable. | 0 of 8 exact matches |

The first three are missing capability in the target, not workarounds. Worth raising the focus-token
one as a platform contribution rather than a MotorTrend ask — every brand benefits.

Two independent methods reached the same conclusion on the brand-slot problem: traversing the
brand-hook dependency graph, and asking Jev to find an HDS home for our blue (it returned
"none"). Full mapping in `ROLE-MAPPING-LEDGER.md`.

### Asks

- **Design:** sign off the surface list in `config/qualifier.json` (every contrast verdict depends
  on it, and it was inferred from usage rather than confirmed), and label ~30 rows from
  `bin/calibrate.mjs` so the judgment thresholds come from evidence rather than my guesses.
- **Eng:** decide whether to land the two accessibility patches while IDS is still shipping.
- **Platform:** the three HDS blockers above.

### Honest limits

Impact analysis covers three components, so a token used elsewhere under-reports. The judgment
gates (0.85/0.90) are unvalidated. HDS was read from its built `dist`, not its source repo or
Figma setup. Contrast assumes opaque compositing over a single surface.
