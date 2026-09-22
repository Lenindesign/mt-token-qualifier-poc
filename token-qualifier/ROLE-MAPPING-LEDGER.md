# IDS → HDS Role Mapping Ledger

Generated 2026-09-22 · theme `motortrend` · model `jev-1.13.0`

Ignition names colours by position in a ramp; HDS names them by the role they play.
There is no 1:1 value mapping to write — this ledger records which HDS **role** each
Ignition token should feed, judged by purpose and actual usage rather than by which
HDS colour happens to be closest in value.

Candidates are narrowed deterministically by how each token is used (a token only ever
applied as a background is never offered a text role). Jev chooses among them. Mappings at
or above **0.7 confidence** are proposed for acceptance; everything below needs a designer.

| | |
|---|---:|
| Mappings proposed | 28 |
| At or above the 0.7 gate | 4 |
| Below gate — needs design | 24 |
| No HDS role exists | 2 |

## Proposed — at or above the gate

| IDS token | used as | HDS role | conf. | used by |
|---|---|---|---:|---|
| `--color-primary-2` | border | `--color-palette-border-brand` | 0.86 | Button |
| `--color-primary-2` | txt | `--color-palette-txt-brand` | 0.75 | Button |
| `--color-neutral-8` | bg | `--color-palette-bg-default` | 0.74 | Button, Card, Typography |
| `--color-primary-1` | bg | `--color-palette-bg-brand` | 0.72 | Button, Card |

## Needs a designer — below the gate

Jev proposed a role but was not confident enough to assert it. Low confidence here is
informative rather than a failure: Ignition is single-tier, so a ramp step genuinely can
serve more than one HDS role depending on context.

| IDS token | used as | Jev suggests | conf. | used by |
|---|---|---|---:|---|
| `--color-neutral-1` | txt | `--color-palette-txt-default` | 0.69 | Button, Card, Typography |
| `--color-neutral-6` | border | `--color-palette-border-default` | 0.67 | Button, Card, Typography |
| `--color-primary-2` | bg | `--color-palette-bg-brand` | 0.63 | Button |
| `--color-neutral-2` | txt | `--color-palette-txt-default` | 0.62 | Button, Card, Typography |
| `--color-neutral-8` | border | `--color-palette-border-default` | 0.62 | Button, Card, Typography |
| `--color-neutral-3` | txt | `--color-palette-txt-default` | 0.61 | Button, Card, Typography |
| `--color-neutral-2` | border | `--color-palette-border-default` | 0.60 | Button, Card, Typography |
| `--color-neutral-3` | border | `--color-palette-border-default` | 0.60 | Button, Card, Typography |
| `--color-neutral-6` | bg | `--color-palette-bg-default` | 0.60 | Button, Card, Typography |
| `--color-secondary-1` | border | `--color-palette-border-brand` | 0.57 | Button |
| `--color-neutral-7` | bg | `--color-palette-bg-default` | 0.55 | Button, Typography |
| `--color-primary-3` | bg | `--color-palette-bg-brand` | 0.53 | Button |
| `--color-secondary-1` | txt | `--color-palette-txt-brand` | 0.45 | Button |
| `--color-secondary-1` | bg | `none` | 0.42 | Button |
| `--color-neutral-2` | bg | `--color-palette-bg-default` | 0.40 | Button, Card, Typography |
| `--color-neutral-3` | bg | `--color-palette-bg-default` | 0.40 | Button, Card, Typography |
| `--color-neutral-5` | bg | `--color-palette-bg-brand` | 0.39 | Button |
| `--color-neutral-4` | bg | `--color-palette-bg-brand` | 0.37 | Button |
| `--color-secondary-3` | bg | `none` | 0.36 | Button |
| `--color-secondary-3` | border | `--color-palette-border-brand` | 0.33 | Button |
| `--color-neutral-1` | bg | `--color-palette-bg-default` | 0.32 | Button, Card, Typography |
| `--color-neutral-8` | txt | `--color-palette-txt-knockout` | 0.28 | Button, Card, Typography |
| `--color-neutral-6` | txt | `--color-palette-txt-on-brand` | 0.19 | Button, Card, Typography |
| `--color-neutral-7` | txt | `--color-palette-txt-on-brand` | 0.16 | Button, Typography |

## Gaps — no HDS role fits

These confirm, from a second direction, the blocker measured in `MIGRATION-ANALYSIS.txt`:
**HDS has one brand slot and no secondary or accent role.** MotorTrend's blue palette has
nowhere to go. Jev reached this independently of the brand-hook graph analysis.

- `--color-secondary-1 (as bg)` — confidence 0.42
- `--color-secondary-3 (as bg)` — confidence 0.36

Either HDS gains a secondary role, or MotorTrend accepts losing its secondary palette.
That is a platform decision, not an engineering one.

## How to read the confidence column

These are calibrated probabilities from a judgment model, not facts. Nothing in this
ledger should be treated as decided until a designer has confirmed it. The gate exists to
separate "worth confirming" from "needs thinking about", not to replace the thinking.

Regenerate with:

```bash
node tools/token-qualifier/bin/qualify.mjs --format=json --out=report.json
```
