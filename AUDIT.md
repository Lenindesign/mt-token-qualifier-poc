# MotorTrend Design Token Qualification — Phase 1 Audit

**Date:** 2026-09-21
**Auditor:** Claude Code (read-only; nothing in either repo was modified)
**Decision layer:** JEV — TypeSafe AI System One (`typesafe@typesafe-ai` v0.5.7 installed, live docs read)

**Systems audited**

| | Repo | Role | Published at |
|---|---|---|---|
| **IDS** | `motortrend/ignition-design-system` (TypeScript, `main`, pushed 2026-07-13) | **Current source of truth for MotorTrend tokens** | `ids.motortrend.com` (private GH Pages, SSO) |
| **HDS** | `Media-Platforms/hearst-design-system` v3.4.1 | **Migration target** | npm, consumed by `fre` |
| **FRE** | `Media-Platforms/fre` @ `d48f387129` | Runs motortrend.com | `apps/fre/scopes/motortrend` |

---

## 0. Corrections to the brief

**0.1 — The working directory was empty.** `/Users/lenin.aviles/Projects/MT Tokens` had no files and no git. This audit reads three other repos; this file is the only thing written.

**0.2 — JEV is TypeSafe AI, not a schema validator.** Jev returns *typed judgments with calibrated probabilities* — `Choice`, `Noul` (probability a condition holds), `Score` — via `@typesafe-ai/sdk` (`client.systemOne({ state, questions })`). TypeSafe's own guidance: *"Keep control flow, deterministic rules, and side effects in code."* So contrast math, dangling references and scale membership must **not** go to Jev. What Jev is for is the rules in the brief that have no algorithm: semantic-vs-raw naming, conflicting duplicate intent, tier classification, editorial hierarchy. Its confidence score is also the mechanism that satisfies the brief's own constraint about separating automated validation from human judgment — see §8.

**0.3 — The real project is not "validate tokens." It is "govern the IDS → HDS migration."** You said MotorTrend's tokens live in IDS *for now* and you want to migrate them to HDS. Those two systems are not two dialects of the same thing:

| | IDS (now) | HDS (target) |
|---|---|---|
| Tokens | **~54** | **~2,965** |
| Tiers | **1** — flat numbered ramps | **3** — primitive → semantic → component |
| Color naming | `--color-primary-2`, `--color-neutral-4` | `--comp-btn-primary-color-bg-solid` |
| Component tokens | none | 1,458 |
| Typography | 17 hardcoded `@utility` classes | 574 `--type-*` tokens |
| Spacing tokens | **none** (Tailwind defaults) | 12-step `--dim-space-*` |
| Theming | 3 brands × 6 overridden vars | runtime Voltron injection |
| Consumed by | IDS React components | `fre` scopes incl. motortrend |

**That is a ~55× increase in granularity and a 1-tier → 3-tier restructure.** A qualification system that only checks today's 54 tokens will be obsolete the moment the migration starts. A system built to check *both*, and to check the *mapping between them*, is the thing worth building. §6 scopes the PoC accordingly.

---

## 1. Current token architecture

### IDS — where MotorTrend tokens live today

```
Figma (UX team naming)  ──  docs state the code naming mirrors Figma deliberately
        │
        ▼
motortrend/ignition-design-system
   src/tailwind/ids.css          @import 'tailwindcss'; @theme inline { … }
     │  --color-*: initial       ← wipes Tailwind's default palette
     │  ~38 color, 7 font, 2 aspect, 7 animate tokens
     │  17  @utility typography-* classes (hardcoded rem)
     │  @utility main-container / ripple / z-high / z-top / scrollbar-* 
     │
     ├── src/tailwind/themes/motortrend.css     @layer base :root { 6 vars }
     ├── src/tailwind/themes/hotrod.css         @layer base :root { 6 vars }
     └── src/tailwind/themes/caranddriver.css   @layer base :root { 6 vars }
     │
     └── src/tailwind/config.ts   ← a THIRD copy of the same hex values
        │
        ▼
   35 React components (cva + Tailwind utilities) → rollup → npm.pkg.github.com
   Storybook → ids.motortrend.com  +  Chromatic VRT (light/dark × desktop/mobile)
```

**MotorTrend's actual brand palette** (`themes/motortrend.css`):

| Token | Value | |
|---|---|---|
| `--color-primary-1` | `#c11b17` | MT red, dark |
| `--color-primary-2` | `#e90c17` | MT red, bright |
| `--color-primary-3` | `#ff858a` | MT red, light |
| `--color-secondary-1` | `#0865b4` | blue, dark |
| `--color-secondary-2` | `#33ccff` | blue, bright |
| `--color-secondary-3` | `#c1eaff` | blue, light |

Plus brand-independent ramps in `ids.css`: `error` 1–4, `info` 1–4, `neutral` 1–8, `success` 1–4, `warning` 1–4.

**The theming mechanism is a self-referencing fallback**, `ids.css:22`:
```css
--color-primary-1: var(--color-primary-1, var(--color-primary-1-default));
```
This works, but only by relying on two subtleties at once: CSS's invalid-at-computed-value-time rule (a self-referential custom property becomes guaranteed-invalid, so the `var()` fallback *is* used) and Tailwind v4's layer order (`theme` before `base`, so `themes/motortrend.css` wins). It is not obviously correct on reading, and it is the kind of thing that breaks silently on a Tailwind major. A qualification rule should assert it resolves rather than assume it.

### HDS — the migration target

Three real tiers, all `var()`-aliased and browser-resolved:
```css
--comp-btn-primary-color-bg-solid: var(--color-btn-bg-primary-solid);   /* component */
--color-palette-neutral-600:       var(--_palette-gray-46);             /* semantic  */
--_palette-gray-46:                #757575;                            /* primitive */
```
Chains run 2–4 hops. 190 private primitives (`--_palette-*`, `--_size-*`, `--_font-*`, `--_z-*`), 2,820 public properties (1,458 `--comp-*`, 599 `--color-*`, 574 `--type-*`, 132 `--dim-*`, 45 `--tw-*` Tailwind internals to exclude).

**HDS brand values are not in version control.** `--color-palette-brand-1..14` ship as `#5539cc` + thirteen `#fff` placeholders, overridden at runtime from Voltron theme JSON. Thirteen of fourteen default to pure white, so an unresolved brand chain silently yields white-on-white — a 1:1 ratio that reads as a catastrophic FAIL that isn't real.

### FRE — how motortrend.com consumes all this

`apps/fre/scopes/motortrend` (Next.js, `fallbackScopes: ['autos','hdm']`) styles via `@media-platforms/theme-system` Emotion `sx()` with `var(--hds-token)` strings. It depends on `@media-platforms/hearst-design-system@3.4.1` — **not on IDS.** So today IDS and motortrend.com are two separate styling worlds, which is precisely why the migration matters.

---

## 2. Current source of truth

| Question | Answer |
|---|---|
| MotorTrend tokens today | `motortrend/ignition-design-system` → `src/tailwind/ids.css` + `src/tailwind/themes/motortrend.css` |
| Format | Tailwind v4 `@theme inline` CSS. **Not** JSON, Style Dictionary, or TypeScript |
| Design authoring | Figma; IDS docs state the code naming deliberately mirrors the UX team's Figma names |
| Migration target | `Media-Platforms/hearst-design-system`, `src/index.css` (Tailwind v4 `@theme`), authored via Figma Token Studio |
| What production reads | `node_modules/@media-platforms/hearst-design-system/dist/index.css` (330 KB, minified) |
| Brand values for HDS | **Not in version control** — runtime Voltron injection |

**For the PoC, parse both:** IDS `src/tailwind/*.css` from a clone (small, readable, authored) and HDS `dist/index.css` from `fre`'s `node_modules` (what actually ships). Neither needs a build step.

---

## 3. Token categories

**IDS** — Color (~38: 2 keyword, 6 brand + 6 defaults, 24 ramp) · Font family (7, all `var()` indirections with fallback) · Typography (17 `@utility typography-*`: hero, h1–h6, subtitle1–2, body1–3, button1–2, caption1–2 — **hardcoded rem, not tokens**) · Breakpoints (`screens` sm/md/lg/xl/2xl = 40/48/64/80/96rem) · Container queries (13 steps) · Aspect (2) · Animation (7) · Z-index (`z-high` 2000000000, `z-top` 2147483647 — utilities, not tokens) · **Spacing: none.**

**HDS** — adds the semantic and component tiers, 574 typography tokens on a 6-property × 3-breakpoint grid (`size`/`line-height`/`family`/`weight`/`letter-spacing`/`txt-case` × `mobile`/`tablet`/`desktop`), a 12-step `--dim-space-*` scale (0/2/4/8/12/16/20/24/32/48/64/80px), `--dim-border-*`, `--dim-layout-viewport-*` (320/768/1024/1440/1600px) and `--dim-layout-elevation-*`.

**Two category mismatches that will bite during migration:**
- **Breakpoints disagree.** IDS: 640/768/1024/1280/1536px. HDS: 320/768/1024/1440/1600px. Only `md` (768) and `lg` (1024) coincide. This is a silent, layout-breaking mismatch, not a rename.
- **Spacing has no source.** IDS has no spacing tokens, so there is no MotorTrend spacing scale to migrate *from*. Adopting HDS's 12-step scale is a new design decision, not a mapping.

---

## 4. Problems and risks

Ordered by consequence. **F-items are verified defects with reproduced numbers. R-items are structural risks.**

### F1 — Light-mode focus ring fails WCAG 2.2 SC 1.4.11 on every IDS Button *(verified)*
`Button.variants.tsx` base class list:
```
focus-visible:ring-2  focus-visible:ring-offset-2
focus-visible:ring-secondary-2         focus-visible:ring-offset-neutral-8
focus-visible:dark:ring-secondary-3    focus-visible:dark:ring-offset-neutral-1
```
| Mode | Ring | Offset | Ratio | 3:1 required |
|---|---|---|---|---|
| Light | `secondary-2` `#33ccff` | `neutral-8` `#fcfcfd` | **1.83:1** | **FAIL** |
| Dark | `secondary-3` `#c1eaff` | `neutral-1` `#141416` | 14.44:1 | PASS |

Keyboard focus is effectively invisible in light mode on all 35 components that inherit this. Remediation, all passing: `ring-secondary-1` (5.80), `ring-primary-1` (5.96), `ring-neutral-3` (11.24). `secondary-1` keeps the blue focus affordance.

*This single finding would justify the project. It is deterministic, it is in the PoC's stated scope, and nothing today catches it.*

### F2 — Two dangling token references *(verified)*
`ids.css:258` and `ids.css:264` in `@utility scrollbar-dark`:
```css
background-color: var(--colors-neutral-4);   /* --colors- is PLURAL */
scrollbar-color:  var(--colors-neutral-4);
```
`--colors-neutral-4` is never defined anywhere (the token is `--color-neutral-4`, singular). Both declarations are inert — the dark scrollbar has no thumb color. Adjacent typo on `ids.css:253`: `&::-webskit-scrollbar` should be `-webkit-`. Rule ST-01 catches the first; both are one-character fixes.

### F3 — MotorTrend's entire secondary ramp duplicates the info ramp *(verified)*
| Hex | Names |
|---|---|
| `#0865b4` | `--color-secondary-1` , `--color-info-2` |
| `#33ccff` | `--color-secondary-2` , `--color-info-3` |
| `#c1eaff` | `--color-secondary-3` , `--color-info-4` |

Identical values, genuinely different intent — brand accent vs. informational status. So it is *not* a bug to be deduplicated, but it *is* a trap: a designer who retunes MotorTrend's blue will silently restyle every info alert, and `hotrod.css` already breaks the coincidence (`secondary-*` is all `#ffcb05` yellow while `info-*` stays blue). This is the exact case rule NM-05 exists for, and it is why NM-05 needs judgment rather than hex comparison — hex equality alone would report three false duplicates.

### F4 — Brand values are duplicated across hand-maintained files *(verified, revised)*
`#c11b17` appears in three places: `themes/motortrend.css` (`--color-primary-1`), `ids.css` (`--color-primary-1-default`), and `config.ts` (`colors.primary['1']`).

**Correction to my first reading.** `config.ts` is not hand-maintained — it is *generated* from `ids.css` by `scripts/generate-tw-config.mjs`, wired to `prebuild`. So that copy is a committed build artifact, and the right guard is a regenerate-and-diff step in CI, not a value comparison.

The genuine risk is narrower and still real: the generator reads **only** `ids.css`. It never opens the theme files. So `themes/<brand>.css` and the `@theme` `-default` fallbacks are two independently hand-edited copies of the same six values per brand, with nothing enforcing agreement. They agree today (verified across all three themes). A consumer loading IDS without the brand stylesheet silently gets the `-default` value, so a drift here is invisible until someone reports one surface looking wrong. Rule ST-04 guards both halves.

### F5 — Four colour tokens fail contrast in a way that will ship *(verified, refined)*
Computed against a self-checked WCAG implementation (`#000`/`#fff` = 21.00, `#767676`/`#fff` = 4.54, `#777777`/`#fff` = 4.48 ✓).

**Correction to my first reading.** I initially framed this as "large parts of the palette can never carry normal text". That over-counted: comparing every token against both light *and* dark surfaces is a mistake, because a near-black text colour cannot pass on a near-black background and that is not a defect. Judged against each token's own colour scheme, the palette is mostly healthy — **22 of 26 colour tokens pass**. Four do not:

| Token | Scheme | Ratios on its own surfaces | Used by |
|---|---|---|---|
| `primary-2` `#e90c17` | light | `#fff` 4.64 · `neutral-8` 4.52 · **`neutral-7` 4.25** · **`neutral-6` 3.78** | **Button** |
| `neutral-4` `#6e7481` | light | `#fff` 4.69 · `neutral-8` 4.57 · **`neutral-7` 4.30** · **`neutral-6` 3.82** | **Button** |
| `error-2` `#d32f2f` | light | `#fff` 4.98 · `neutral-8` 4.86 · `neutral-7` 4.56 · **`neutral-6` 4.06** | — |
| `success-2` `#388e3c` | either | **fails on every surface in both schemes**, peaking at 4.47 | — |

The shape of the first three is the dangerous one: each is correct on the surface it was designed against and silently inaccessible one surface over. MotorTrend's headline red and its obvious secondary-text grey are both in this set, and both are already used by Button. `success-2` is the harder case — there is no approved background on which it is valid for normal text at all.

This is precisely the failure mode in your brief's worked example, and nothing in the token names communicates it.

### F6 — Disabled states differentiate weakly *(verified, WARN)*
`aria-disabled:bg-primary-1/50` composites to `#e08d8b` on white. Enabled `primary-2` `#e90c17` vs. that disabled background is **1.84:1** — below the 3:1 you would want for a state change conveyed by color. Label contrast drops to 2.45:1, though WCAG explicitly exempts inactive controls, so that part is correct-by-exemption. The saving grace is that `Button.variants.tsx` also sets `disabled:opacity-50` and `cursor` changes, so color is not the only signal. WARN, not FAIL — but worth a designer's eye.

### R7 — MotorTrend scope in `fre` has no hardcoded-value linting
`fre/no-hard-coded-styles-in-hds` exists, is well built, and is enabled `"error"` — but only under `apps/fre/scopes/hdm/hds/**` (`.oxlintrc.json:203`). `apps/fre/scopes/motortrend/**` is not covered. Measured now in that scope: **122 hex colors, 182 literal `px`, 407 literal `rem`** across 20+ style files, against **139** total token references. MotorTrend uses raw values ~5× more than tokens. One glob, plus a burn-down.

### R8 — IDS typography is not tokenized
16 `@utility typography-*` classes with `font-size: 6rem; /* 96px */` inline — hero, h1–h6, subtitle1–2, body1–3, button1–2, caption1–2. **Zero** of them reference a token. Nothing can alias, override or theme them, so per-brand typography is impossible. HDS models the same territory with 574 tokens. Migrating typography is therefore a *creation* exercise, not a mapping — and the PoC's "typography tokens" target is thin on the IDS side by construction.

### R13 — Card has no focus styling, but is used interactively *(verified)*
`src/components/Card/` contains no `focus-visible:` styling of any kind, yet `Card.stories.tsx` demonstrates it with both `href` and `onClick`. So Card is used as an interactive target in practice while shipping no focus indicator, and the obligation silently falls on whichever consumer wraps it. WARN rather than FAIL — the component itself renders nothing inherently focusable — but it is a real gap in a component that is the analogue of Article Card.

*(What this replaces: I earlier reported "Card has 12 arbitrary values bypassing tokens." That was wrong. All twelve `88px` literals are in `Card.stories.tsx` — demo code, not shipped styling. With stories excluded, **all three PoC components contain zero raw hardcoded values**. IDS is considerably more disciplined than the `fre` MotorTrend scope, which is the opposite of what I implied.)*

### R9 — Deprecation is not expressible in either system
Tailwind's build discards Token Studio metadata, so neither IDS nor HDS `dist` carries `$deprecated`, `$description` or `$type`. "Deprecated tokens clearly identified" needs a sidecar registry in this repo, or a change to the upstream builds.

### R10 — Editorial hierarchy is undocumented *(revised — typography is NOT)*

**Correction.** I originally wrote that approved typography, weights and editorial hierarchy were all undocumented. That was wrong, and it was wrong because I read only `1-Colors.mdx` and the visual-regression doc from the IDS file tree and never opened the theme docs. `documentation/foundations/3-themes/1-MotorTrend.mdx` states MotorTrend's typography explicitly:

```css
:root {
  --font-heading: 'Poppins';   /* "Poppins Semibold is used to power MotorTrend's headings" */
  --font-body: 'Geist Sans';   /* "powers our non-heading content" */
}
```

HotRod and CarAndDriver have equivalent theme docs. So **approved typefaces and the heading weight have a source of truth**, and "approved typography and weights" becomes a writable Class D rule rather than a Class H gap:

- `--font-heading` must resolve to Poppins, `--font-body` to Geist Sans (per theme).
- A component applying `font-heading` at a weight other than semibold is off-spec.
- `--font-email: 'Arial'` is the one hardcoded family, presumably deliberate for email clients.

`documentation/foundations/5-Component Design.mdx` likewise documents policy I had treated as absent: atomic-design structure (atoms/molecules = "Components", organisms = "Blocks"), required per-component file patterns, and *"You should be able to style any element using only Tailwind classes"* — the no-hardcoded-values rule, written down.

**What still stands:** editorial hierarchy has no documented specification anywhere, and `HEARST-TOKEN-NAMING-TAXONOMY.md` in `~/Projects/hearst` is genuinely 0 bytes. MT-04 remains a judgment rule with no ground truth to check against.

**Why this was missed:** `ids.motortrend.com` is private GitHub Pages behind SSO and could not be loaded, so I worked from the repository source instead and read selectively from the file tree rather than reading all ten documentation files. The rendered Storybook — colour swatches, component stories, the `ThemeColors` blocks — was never seen at any point in this audit.

### R11 — The numbered naming is deliberate, so "use semantic names" is contested
IDS `1-Colors.mdx`: *"The naming convention for each color follows the naming convention the UX team uses inside the Figma design files, making mapping colors from design to code much easier."* A rule that FAILs `--color-primary-2` for not being semantic would be overruling a documented, intentional decision made for design-to-code fidelity. It belongs in the report as a migration consideration, addressed to the UX team — not in a PR gate. This is why NM-02 is confidence-gated and advisory.

### R12 — No MotorTrend visual regression in `fre`
IDS is in good shape here: Chromatic with light/dark × desktop/mobile modes, `tests.yml` running build + Playwright Storybook tests on every PR. But `fre` has **0 stories** in `apps/fre/scopes/motortrend` and `motortrend` is absent from `storybook-addon-brands/src/brands.ts` (13 brands, MT not among them). So VRT exists for IDS components and not at all for motortrend.com.

---

## 5. Recommended integration points

**IDS is the better first home.** It already has PR CI (`tests.yml`), Chromatic, ESLint, Prettier, lint-staged, and its token files are small, authored and readable. `fre` is a large monorepo whose only lint path is oxlint via `bin/lint`, with no precedent for an *enforced* custom repo check — `bin/check-hds-folder-boundaries` exists as an npm script but `grep -rn` over `.github/workflows/` shows it is never run in CI.

| Layer | Hook | Repo |
|---|---|---|
| Local | `npm run tokens:qualify` / `tokens:report` / `tokens:check` | IDS |
| PR | new job in `.github/workflows/tests.yml` alongside `build` and `test` | IDS |
| Pre-commit | `.lintstagedrc.js` (exists) — phase 3 only | IDS |
| VRT | Chromatic modes (exists, healthy) | IDS |
| Raw values | extend `fre/no-hard-coded-styles-in-hds` glob to `apps/fre/scopes/motortrend/**` | FRE |
| Impact analysis | scan `src/components/**/*.variants.tsx` for Tailwind utility → token | IDS |
| Migration gate | assert every IDS token has an HDS mapping, and that mapped pairs agree | both |
| Upstream | structural rules eventually in HDS CI so bad tokens never publish | HDS |

None of the three `tokens:*` script names is taken in either repo.

---

## 6. Proof-of-concept scope

**Primary target: IDS**, because it is MotorTrend's current source of truth, it is small enough to cover completely, and it has verified defects (F1–F6) to prove detection against. HDS is parsed read-only to support the migration rules.

**In scope**
- Parse IDS `src/tailwind/ids.css`, `themes/*.css`, `config.ts` into a token graph; resolve `var()` chains with cycle detection.
- Parse HDS `dist/index.css` read-only for migration mapping.
- Categories: **color**, **typography**, **spacing** (spacing coverage is necessarily a gap report on the IDS side — R8/§3).
- Components: **Button**, **Card** (+`CardTitle`, `CardContent`, `CardMedia` — the IDS analogue of Article Card), **Typography** (the IDS analogue of Article Header; `ArticleCard`/`ArticleHeader` do not exist by those names in either system).
- Extract tokens from `cva` utility class lists in `*.variants.tsx` for component impact analysis.
- 20 rules (§8): 14 deterministic, 6 Jev-judgment.
- Outputs: `report.md` + `report.json`.

**Out of scope for the PoC:** changing any token or component; new Chromatic modes; other Hearst brands (data model allows them, PoC does not attempt them); CI *blocking* (built capable, wired advisory); any change to HDS.

**Component reality check** — worth knowing before the run:

| Brief's target | Closest real thing | State |
|---|---|---|
| Button | `IDS Button` | Strong: `cva`, 35 focus/disabled classes, no hardcoded values. Has **F1** |
| Article Card | `IDS Card` + 4 subcomponents | Good structure, fully tokenized |
| Article Header | `IDS Typography` (17 variants) | **Not tokens** — hardcoded rem in `@utility` classes (R8) |

---

## 7. Proposed file structure

```
motortrend/ignition-design-system
└── tools/token-qualifier/
    ├── README.md                          # how to add a rule (required deliverable)
    ├── bin/qualify.mjs                    # CLI: --format=md|json --component= --rule= --fail-on=
    ├── src/
    │   ├── index.mjs                      # qualify(config) → Report
    │   ├── parse/
    │   │   ├── ids-css.mjs                # ids.css + themes/*.css → TokenGraph
    │   │   ├── ids-config.mjs             # config.ts → third copy, for F4
    │   │   ├── hds-css.mjs                # HDS dist/index.css (read-only, migration)
    │   │   ├── resolve.mjs                # var() chain resolution + cycle detection
    │   │   └── variants.mjs               # cva class lists → component→token edges
    │   ├── color/
    │   │   ├── wcag.mjs                   # relative luminance, contrast, self-tested
    │   │   └── composite.mjs              # /50 /70 /75 alpha over background
    │   ├── rules/
    │   │   ├── registry.mjs               # id → { impl, class: D|J|H, band }
    │   │   ├── structure/                 # ST-01…06        (D)
    │   │   ├── accessibility/             # AX-01…05        (D)
    │   │   ├── motortrend/                # MT-02, MT-03    (D)
    │   │   ├── migration/                 # MG-01           (D)
    │   │   └── judgment/                  # NM-01…05, MT-04 (J)
    │   ├── jev/
    │   │   ├── client.mjs                 # @typesafe-ai/sdk, TYPESAFE_API_KEY
    │   │   ├── questions.mjs              # Choice/Noul/Score defs, versioned
    │   │   ├── thresholds.mjs             # per-rule confidence gates
    │   │   └── cache.mjs                  # content-hash answer cache
    │   ├── impact/scan-usage.mjs
    │   └── report/{markdown,json}.mjs
    ├── config/
    │   ├── motortrend.rules.json           # thresholds, allowlists, severity
    │   ├── surfaces.json                   # which tokens are legal backgrounds
    │   └── deprecated.json                 # sidecar registry (R9)
    └── test/
        ├── fixtures/{valid,invalid,jev}/
        └── rules/*.test.mjs
```

`package.json`:
```json
"tokens:qualify": "node tools/token-qualifier/bin/qualify.mjs",
"tokens:report":  "node tools/token-qualifier/bin/qualify.mjs --format=md --out=token-report.md",
"tokens:check":   "node tools/token-qualifier/bin/qualify.mjs --format=json --fail-on=fail"
```

`tokens:check` runs Class D always; Class J only when `TYPESAFE_API_KEY` is set, reporting `SKIPPED` otherwise. Unit tests never hit the network — they replay `test/fixtures/jev/`.

**`config/surfaces.json` is the load-bearing config.** Contrast is meaningless without knowing which tokens are legal backgrounds. F5 only became a finding because I chose `#fff`, `neutral-8`, `neutral-7`, `neutral-6`, `neutral-1` as the surface set. That list is a **design decision and needs a designer's sign-off** — it is the cleanest example in this whole audit of where automation ends and human judgment begins.

---

## 8. First 20 rules

Every result emits: `token`/`component`, `rule`, `actual`, `expected`, `explanation`, `recommendation`, `affects[]`. Judgment rules add `confidence`.

Split by **who decides** — the load-bearing distinction:
- **Class D — Deterministic.** Arithmetic and graph traversal. Offline, free, reproducible. May block a PR.
- **Class J — Judgment (Jev).** Semantic questions with no algorithm. Verdict *plus* calibrated probability. Blocks only above a confidence gate; below it, routes to a designer.
- **Class H — Human.** Reported, never automated.

### Class D — Structure (ST) · 6
| ID | Rule | Default | Real hit today |
|---|---|---|---|
| ST-01 | Every `var()` reference resolves to a defined token | **FAIL** | **F2** — `--colors-neutral-4` ×2 |
| ST-02 | No circular alias references | **FAIL** | prerequisite for AX to terminate |
| ST-03 | Value format matches token type | **FAIL** | — |
| ST-04 | Theme override, `@theme` default, and `config.ts` agree | **FAIL** | **F4** — 3-way drift risk |
| ST-05 | Self-referential fallback pattern resolves under Tailwind layer order | WARN | `ids.css:22–37` |
| ST-06 | Orphaned tokens (defined, referenced nowhere) | WARN | — |

### Class D — Accessibility (AX) · 5
Contrast is arithmetic on resolved sRGB. Never goes to Jev.

| ID | Rule | Default | Real hit today |
|---|---|---|---|
| AX-01 | Text on each declared surface ≥ 4.5:1 (AA normal) | **FAIL** | **F5** — `primary-2`, `neutral-4`, `success-2` |
| AX-02 | Large text / UI components ≥ 3:1 | **FAIL** | — |
| AX-03 | Focus indicator ≥ 3:1 vs. its offset and surface (SC 1.4.11) | **FAIL** | **F1** — 1.83:1, every Button |
| AX-04 | Disabled state differs by ≥ 3:1 or a non-color property | WARN | **F6** — 1.84:1, mitigated by opacity |
| AX-05 | Interactive target ≥ 44×44px from resolved padding + line-height | WARN | — |

HDS chains passing through an unresolved `--color-palette-brand-*` return **UNKNOWN**, never FAIL.

### Class D — MotorTrend + Migration · 3
| ID | Rule | Default |
|---|---|---|
| MT-02 | Spacing resolves to the approved scale | **FAIL** *(IDS has none — reports as a coverage gap, R8)* |
| MT-03 | Breakpoints resolve to the approved set | **FAIL** *(IDS 640/768/1024/1280/1536 vs HDS 320/768/1024/1440/1600 — §3)* |
| MG-01 | Every IDS token has a declared HDS mapping, and mapped pairs' resolved values agree | WARN → FAIL once the mapping table exists |

MG-01 is the rule that makes this system outlive the migration rather than be invalidated by it.

### Class J — Judgment via Jev · 6
Facts from the token graph go in as `state`; independent questions are batched into one `systemOne` call per token and run in parallel.

| ID | Rule | Primitive | The judgment | Blocks at |
|---|---|---|---|---|
| NM-01 | Name follows the documented grammar | `Noul` | Does this parse as IDS's `{role}-{step}` (or HDS's tier grammar)? | ≥ 0.90 |
| NM-02 | Semantic, not raw-color or bare-index naming | `Choice` → `role \| color-word \| bare-index \| ambiguous` | `danger` is a role, `crimson` a color word, `primary-2` a bare index. Advisory only — see **R11** | never (PoC) |
| NM-03 | Declared tier matches actual meaning | `Choice` → `primitive \| semantic \| component \| unclear` | Classifies from meaning, not prefix — the only way to handle HDS's undeclared `--color-{component}-*` layer without ~200 false positives | ≥ 0.85 |
| NM-05 | Same-value tokens: same intent, or different? | `Noul` | **F3** — `secondary-1` vs `info-2` share `#0865b4` but differ in intent. Hex equality alone reports 3 false duplicates | ≥ 0.90 |
| MT-01 | Color belongs to the approved MotorTrend palette | `Choice` → `brand \| status \| neutral \| off-brand` | MT palette is now known, so this is answerable | ≥ 0.85 |
| MT-04 | Editorial hierarchy is coherent | `Score` | Does this typography variant sit correctly in the hero → h1–h6 → subtitle → body → caption ladder? | never — WARN |

Two notes from TypeSafe's own warnings:
- NM-01/NM-05 use `Noul` because the probability *is* the signal. A `Noul` of 0.5 means *"yes and no equally likely"*, **not** *"half-compliant"* — so 0.4–0.6 must route to a human, never score as a partial pass.
- MT-04 is a `Score` because editorial hierarchy is a genuine spectrum with describable levels, and it never blocks, because a legitimate design decision can sit anywhere on it.

Deterministic prefilters run first, so Jev is only asked about tokens a rule could not settle. Request volume tracks genuine ambiguity, not token count — and with ~54 IDS tokens, a full Jev pass is a handful of batched calls.

### Class H — Human only
| Rule | Why |
|---|---|
| "No reliance on color alone" | Needs component markup *and* editorial intent |
| Approved typography and weights | **No source exists** (R10) |
| Which tokens are legal surfaces | A design decision; `surfaces.json` needs sign-off (§7) |
| Whether numbered naming should survive migration | Documented deliberate choice (R11) — UX team's call |

### Cost and determinism

| | Class D | Class J |
|---|---|---|
| Offline | yes | no |
| Reproducible byte-for-byte | yes | no |
| Cost / latency | zero / ms | per-question / 70–500 ms batched |

`tokens:check` must stay useful with no network: Class D alone produces a valid blocking report, Class J degrades to `SKIPPED`. A gate that fails closed on a third-party outage gets disabled within a week.

---

## 9. Required test fixtures

**Deterministic (Class D)**

| Fixture | Expected |
|---|---|
| `valid/ids-minimal.css` | clean graph → all PASS |
| `invalid/plural-typo.css` | reproduces **F2** → ST-01 FAIL ×2 |
| `invalid/circular.css` | `a→b→c→a` → ST-02 FAIL, terminates |
| `invalid/type-mismatch.css` | `--color-x: 16px` → ST-03 FAIL |
| `invalid/theme-drift/` | `config.ts` hex ≠ theme CSS hex → ST-04 FAIL (**F4**) |
| `invalid/focus-ring-low.css` | reproduces **F1** at 1.83:1 → AX-03 FAIL |
| `valid/focus-ring-fixed.css` | `ring-secondary-1` at 5.80:1 → AX-03 PASS |
| `invalid/text-on-surface.css` | reproduces **F5** `neutral-4` on `neutral-6` → AX-01 FAIL |
| `boundary/contrast-4.48.css` | `#777777` on white = 4.48 → FAIL |
| `boundary/contrast-4.54.css` | `#767676` on white = 4.54 → PASS *(proves no off-by-one)* |
| `invalid/disabled-weak.css` | reproduces **F6** at 1.84:1 → AX-04 WARN |
| `invalid/breakpoint-mismatch/` | IDS vs HDS screens → MT-03 FAIL |
| `usage/button-variants.tsx` | real `cva` list → impact analysis names Button |
| `golden/report.{md,json}` | snapshot → catches format regressions |

**Judgment (Class J)** — recorded answers, replayed offline

| Fixture | Expected |
|---|---|
| `jev/conflicting-intent.json` | **F3** real data: `secondary-1` vs `info-2`, same hex → NM-05 `noul` **low** (not a duplicate) |
| `jev/true-duplicate.json` | same name-intent, same value → `noul` high |
| `jev/bare-index.json` | `primary-2` → NM-02 `bare-index`, **advisory only** (R11) |
| `jev/raw-color-word.json` | `crimson`, `slate` vs `danger` → beats a word allowlist |
| `jev/tier-ambiguous.json` | HDS `--color-card-bg` → `semantic` or `unclear`, not a confident FAIL |
| `jev/noul-midpoint.json` | `noul` ≈ 0.5 → routes to human, **never** a partial pass |
| `jev/offline.json` | no API key → Class J `SKIPPED`, Class D still blocks, exit code correct |

The last two matter most: `noul-midpoint` encodes the one misreading that would quietly corrupt every judgment result, and `offline` proves the gate survives a TypeSafe outage.

**Every F-finding has a paired fixture.** The PoC is credible only if it reproduces all six verified defects and passes their fixed counterparts.

---

## 10. What blocks a pull request

**Band A — block (exit 1). Class D only.**
1. ST-01 dangling reference — **fails today (F2)**
2. ST-02 circular reference
3. ST-03 type mismatch
4. ST-04 three-way value drift — **guards F4**
5. AX-03 focus indicator < 3:1 — **fails today (F1)**
6. AX-01/AX-02 contrast, only for chains resolving to literal colors, only for declared surfaces, only for PoC components — **fails today (F5)**
7. MT-03 off-scale breakpoint

Every Band A rule is deterministic, offline and reproducible. **A PR may only be blocked by something a developer can re-run locally and get the identical answer to.** Nobody should have to argue with a probability to land a change.

**Band B — Class J, confidence-gated.** NM-03 and NM-05 may block above their gates (0.85–0.90) **only after** validation on IDS's real tokens. TypeSafe's guidance is that typed output guarantees the interface, not the truth, and thresholds must be set on your own data and consequences. **For the PoC, all of Band B is advisory** — measuring the confidence distribution is what tells us whether 0.85 is right, and that has not happened.

**Band C — warn, never block.** NM-01, NM-02 (R11), MT-04, ST-05, ST-06, AX-04, AX-05, MG-01, MT-02.

**Band D — report only.** Class H rules, the Typography-not-tokenized gap (R8), and R7's 711 raw values in `fre`. All true; none fixable by the author of an unrelated PR. Failing someone's PR for a pre-existing systemic gap is how a governance system loses its mandate.

**Rollout**
1. Weeks 1–2: everything advisory, exit 0, annotate only. **F1, F2, F4 and F5 will fail immediately** — that is the point, and it is why Band A cannot start blocking on day one.
2. Fix F1 and F2 (both trivial). Then promote Band A to exit 1.
3. Band B stays advisory until thresholds are validated against designer-labelled outcomes.

**Never enable a blocking rule that currently fails on `main`.** Fix or waive first — otherwise the first PR after enablement is blocked by someone else's bug.

---

## 11. Open questions

| # | Question | Blocks? | Assumption if you say "just pick" |
|---|---|---|---|
| **Q1** | **Which tokens are legal surfaces?** Contrast results are entirely determined by this. I used `#fff`, `neutral-8/7/6/1`; that set produced F5 | **Yes — for AX-01/02 only** | Ship `config/surfaces.json` with those five, clearly marked as needing design sign-off |
| **Q2** | May I clone `motortrend/ignition-design-system` locally? Your `gh` (`Lenindesign`) has access; I read it via the API for this audit | **Yes — for implementation** | Clone to `~/Projects/ignition-design-system`, matching your existing layout |
| **Q3** | **Does an IDS → HDS token mapping table exist?** MG-01 needs it | No | Generate a draft mapping from the PoC and hand it to design for correction |
| **Q4** | `TYPESAFE_API_KEY` available, and may token names + hex values go to `api.typesafe.ai`? | No | Build Class J against recorded fixtures; live call stays behind the env var, unexercised *(your answer: stub it)* |
| **Q5** | Fix **F1** (focus ring) and **F2** (plural typo) now, or only report them? F1 is a live accessibility defect on every IDS component | No | Report in the PoC; raise as separate PRs. Both are one-line fixes but they change production styling, which this phase is scoped not to do |
| **Q6** | Is extending `fre`'s lint glob to MotorTrend (R7) in scope? | No | Separate ticket, referenced from the report. Don't couple a 711-occurrence cleanup to a new tool's first release |
| ~~Q7~~ | ~~Where does the code live?~~ | — | **Answered: `packages/token-qualifier` in `fre`.** I am proposing IDS instead (§5) — IDS holds the tokens, has PR CI and Chromatic, and `fre` has no precedent for an enforced custom check. Flagging the divergence rather than silently overriding you |

---

## 12. Assumptions on record

1. `motortrend/ignition-design-system` → `ids.motortrend.com` (verified: `gh api .../pages` returns `cname: ids.motortrend.com`, `build_type: workflow`, branch `main`).
2. IDS is MotorTrend's current token source of truth; HDS is the migration target (your statement).
3. IDS naming deliberately mirrors Figma (IDS `1-Colors.mdx`), so numbered names are intentional, not accidental.
4. motortrend.com in `fre` consumes **HDS**, not IDS — the two are separate styling worlds today.
5. HDS brand values are injected at runtime from Voltron and are not statically analysable.
6. `--tw-*` (45) are Tailwind internals, excluded from governance.
7. Contrast uses WCAG 2.x relative luminance, sRGB, self-tested against `#000`/`#fff` = 21.00 and `#767676`/`#fff` = 4.54.
8. Nothing in this phase changes a token, a component, or CI enforcement.

---

## 13. Proof of concept — built and run

Location: `motortrend/ignition-design-system` → `tools/token-qualifier/` (untracked, uncommitted). **Zero existing files modified** — `git status` shows one new folder and nothing else. F1 and F2 are still present in the repo exactly as found.

Zero dependencies, Node 20+, runs before `npm install`.

### What it does

Parses `ids.css` + `themes/<brand>.css` into a token graph, resolves `var()` chains with cycle detection, extracts token usage from `cva()` class lists in components, then runs 14 deterministic rules and 6 stubbed judgment rules. Outputs human Markdown and machine JSON.

### Results against real IDS, `motortrend` theme

```
FAIL 8 · REVIEW 3 · WARN 8 · SKIPPED 5 · PASS 39
54 tokens · 26 var() references · 3 components · WCAG self-test passed
```

| Verdict | Rule | Subject | Corresponds to |
|---|---|---|---|
| FAIL | ST-01 | `--colors-neutral-4` ×2 | **F2** |
| FAIL | AX-01 | `--color-primary-2`, `--color-neutral-4`, `--color-error-2`, `--color-success-2` | **F5** |
| FAIL | AX-03 | Button (light mode) — 1.83:1 | **F1** |
| FAIL | MT-03 | breakpoints — IDS vs HDS | §3 |
| REVIEW | NM-05 | `secondary-1 ≡ info-2`, `secondary-2 ≡ info-3`, `secondary-3 ≡ info-4` | **F3** |
| WARN | AX-03 | Card — no focus styling, interactive in stories | **R13** |
| WARN | AX-04 | Button — disabled differentiation 1.84:1 | **F6** |
| WARN | AX-05 | Button — `max-h-8`/`max-h-10` below 44px AAA | new |
| WARN | MT-02 | no spacing tokens exist | **R8** |
| SKIPPED | NM-01/02/03, MT-01, MT-04 | judgment layer disabled | — |

**Every verified defect was independently reproduced by the tool**, and it found two more (AX-05 target size, R13 Card focus). All three themes run: `hotrod` and `caranddriver` produce the same 8 blocking-eligible failures, confirming these are structural rather than brand-specific.

A worked example of the output, matching the shape your brief specified:

> **🔴 FAIL — AX-03 · Button (light mode)**
> **Actual:** 1.83:1 — ring `--color-secondary-2` `#33ccff` on offset `--color-neutral-8` `#fcfcfd`
> **Expected:** ≥ 3:1 (WCAG 2.2 SC 1.4.11)
> Keyboard focus is effectively invisible in light mode. Neither class is wrong on its own, which is why review and linting both miss it.
> **Affects:** Button
> **Recommendation:** Replace `focus-visible:ring-secondary-2` with `--color-secondary-1` (5.8:1) — same ramp. Stays in the `secondary` ramp, so the focus affordance keeps its current colour identity.

### Tests

41 tests, all passing, zero dependencies (`node --test`). Each rule has both a firing fixture and a quiet one. Boundary cases pinned at 4.48 (FAIL) and 4.54 (PASS).

### Four false positives found and fixed in my own tool

This is the part worth reading, because it is the main risk to the whole project. Each is now pinned by a regression test.

| Bug | Impact if shipped |
|---|---|
| `AX-01` compared every token to light **and** dark surfaces | 26 failures out of 26 tokens. Nothing can pass both; pure noise |
| `ST-05` flagged IDS's `--font-*` tokens | 6 false failures. They are injected at runtime by the host app |
| `AX-03` demanded a focus ring on `Typography` | It renders no focusable element |
| Scanner counted `*.stories.tsx` | Card's twelve `88px` literals are demo code — this produced the wrong claim I corrected in R13 |
| Contrast used `n & 255 >= 0`, which parses as `n & 1` | Destroyed the blue channel and shifted **every** ratio in the report |

The first version of this tool reported 38 failures. The corrected version reports 8, and all 8 are real. **A governance tool that cries wolf gets switched off in a week**, so the false-positive rate matters more than the rule count — which is also why `AX-01`'s surface list needs design sign-off before enforcement.

### Not built

Live Jev calls (stubbed per your instruction), `package.json` scripts (documented, not added — tracked file), CI wiring (documented in README, not added), IDS→HDS mapping table, Chromatic tie-in.

---

## 14. State of play

**Done.** Located the real source of truth (IDS, which was not in the brief). Mapped both token systems and quantified the migration gap (~54 → ~2,965 tokens, 1 → 3 tiers). Verified seven defects with reproduced numbers. Established JEV's role from TypeSafe's live docs and installed the skill. **Built and ran a working proof of concept** that independently reproduces every verified defect, with 41 passing tests and both report formats. Corrected three of my own earlier findings once the implementation disproved them.

**Changed in any existing repo.** Nothing. One untracked folder in the IDS clone; no tracked file touched, nothing committed or pushed.

**Still open:** `surfaces` needs design sign-off (it determines every contrast verdict). The judgment layer is stubbed pending your call on the API key. `package.json` scripts and the CI job are documented but not added, since both mean editing tracked files.

**Immediate recommendations, in order:**
1. **Fix F1** — one class, `ring-secondary-2` → `ring-secondary-1`. A live WCAG failure affecting keyboard users on every IDS component.
2. **Fix F2** — one character, `--colors-neutral-4` → `--color-neutral-4`, twice.
3. **Sign off `surfaces`** so the AX-01 findings become defensible to design.
4. **Wire the advisory CI job.** Zero dependencies, no `npm ci`, report lands in the PR summary.
5. **Then** decide on Jev, and on the `fre` lint glob (R7).

**The headline.** Your success criterion is: change a token, run one command, know whether it is valid, what it affects, and whether it is safe to merge. On IDS that is achievable and close — the repo is small, tokenized, has PR CI and Chromatic, and the PoC has six real defects to prove itself against. On motortrend.com in `fre` it is currently **not** achievable at any price, because that scope uses raw values roughly five times more often than tokens (711 vs. 139) and the lint rule that would prevent it is scoped to a different brand's directory. Impact analysis there will be confidently, quietly incomplete until R7 is fixed — which is worse than having none. R7 is one glob in `.oxlintrc.json:203` plus a burn-down, and it is worth doing whether or not this system ships.
