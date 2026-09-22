# MotorTrend Token Qualification Report

**Theme:** `motortrend` · **Generated:** 2026-09-22T01:58:40.831Z
**Enforcement:** `blocking` — Band A failures block

🔴 5 FAIL · 🟠 55 REVIEW · 🟡 41 WARN · 🟢 101 PASS

> ## 🟢 No blocking-eligible failures
> Advisory findings below are worth reading but do not gate a merge.

## Scope

| | |
|---|---|
| Tokens parsed | 54 |
| `var()` references checked | 26 |
| Components scanned | 3 |
| Themes available | motortrend, hotrod, caranddriver |
| Typography variants | 16 (0 tokenized) |
| WCAG self-test | passed |
| Judgment layer (Jev) | enabled · 0 calls · 161 cache hits |

## Components

| Component | Role in PoC | Files | Token uses | Distinct tokens | Raw values |
|---|---|---:|---:|---:|---:|
| Button | — | 3 | 180 | 13 | 0 |
| Card | Article Card (IDS: Card + CardTitle/CardContent/CardMedia) | 15 | 28 | 6 | 0 |
| Typography | Article Header (IDS: Typography variants — NOT tokenized, see R8) | 3 | 140 | 6 | 0 |

## 🔴 Failures (5)

#### 🔴 FAIL — AX-01 · --color-primary-2

**Rule:** WCAG AA contrast, normal text  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** #e90c17 on light surfaces — --color-neutral-8 4.52:1 · --color-neutral-7 4.25:1 · --color-neutral-6 3.78:1 · #ffffff 4.64:1  
**Expected:** ≥ 4.5:1 on every light surface

`--color-primary-2` (#e90c17) is a light-scheme foreground colour. It clears 4.5:1 on --color-neutral-8, #ffffff but fails on --color-neutral-7 (4.25:1), --color-neutral-6 (3.78:1). This is the most failure-prone shape a colour token can have: it is correct on the surface it was designed against and silently inaccessible on the others, so the bug ships whenever the token is reused one surface over. Used by Button.

**Affects:**
- Button

**Recommendation:** Darken `--color-primary-2` until it clears 4.5:1 on all light surfaces, or split it into surface-specific tokens so the unsafe combination cannot be expressed. Leaving it as-is makes correctness depend on every future author remembering which background is safe.

#### 🔴 FAIL — AX-01 · --color-error-2

**Rule:** WCAG AA contrast, normal text  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** #d32f2f on light surfaces — --color-neutral-8 4.86:1 · --color-neutral-7 4.56:1 · --color-neutral-6 4.06:1 · #ffffff 4.98:1  
**Expected:** ≥ 4.5:1 on every light surface

`--color-error-2` (#d32f2f) is a light-scheme foreground colour. It clears 4.5:1 on --color-neutral-8, --color-neutral-7, #ffffff but fails on --color-neutral-6 (4.06:1). This is the most failure-prone shape a colour token can have: it is correct on the surface it was designed against and silently inaccessible on the others, so the bug ships whenever the token is reused one surface over. Not used by any scanned component.

**Recommendation:** Darken `--color-error-2` until it clears 4.5:1 on all light surfaces, or split it into surface-specific tokens so the unsafe combination cannot be expressed. Leaving it as-is makes correctness depend on every future author remembering which background is safe.

#### 🔴 FAIL — AX-01 · --color-neutral-4

**Rule:** WCAG AA contrast, normal text  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** #6e7481 on light surfaces — --color-neutral-8 4.57:1 · --color-neutral-7 4.3:1 · --color-neutral-6 3.82:1 · #ffffff 4.69:1  
**Expected:** ≥ 4.5:1 on every light surface

`--color-neutral-4` (#6e7481) is a light-scheme foreground colour. It clears 4.5:1 on --color-neutral-8, #ffffff but fails on --color-neutral-7 (4.3:1), --color-neutral-6 (3.82:1). This is the most failure-prone shape a colour token can have: it is correct on the surface it was designed against and silently inaccessible on the others, so the bug ships whenever the token is reused one surface over. Used by Button.

**Affects:**
- Button

**Recommendation:** Darken `--color-neutral-4` until it clears 4.5:1 on all light surfaces, or split it into surface-specific tokens so the unsafe combination cannot be expressed. Leaving it as-is makes correctness depend on every future author remembering which background is safe.

#### 🔴 FAIL — AX-01 · --color-success-2

**Rule:** WCAG AA contrast, normal text  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** #388e3c — best available is 4.47:1 on --color-neutral-1  
**Expected:** ≥ 4.5:1 on at least one approved surface

`--color-success-2` (#388e3c) fails 4.5:1 against **every** approved surface in **both** schemes. There is no approved background on which this token is valid for normal-size body text, so it cannot safely carry any text at all. Not used by any scanned component.

**Recommendation:** Either adjust the value until it clears 4.5:1 on at least one approved surface, or document `--color-success-2` as large-text / non-text only and make that constraint visible at the point of use.

#### 🔴 FAIL — MT-03 · breakpoints (category)

**Rule:** Approved breakpoints  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** IDS: sm=40rem (640px), md=48rem (768px), lg=64rem (1024px), xl=80rem (1280px), 2xl=96rem (1536px)  
**Expected:** HDS: mobile=320px, tablet=768px, laptop=1024px, desktop=1440px, max=1600px

IDS and the HDS migration target agree on only 2 of 5 breakpoints (tablet=768px, laptop=1024px). They diverge on mobile=320px, desktop=1440px, max=1600px. Because both systems use the same generic names at different values, a component moved from IDS to HDS will change its responsive behaviour with no code diff to review — the most dangerous kind of migration bug.

**Recommendation:** Agree one breakpoint set before migrating any component. If HDS's set wins, audit every IDS responsive variant first: `sm` moves 640px → 320px and `xl` moves 1280px → 1440px, which will reflow layouts.

## 🟠 Needs human review (55)

#### 🟠 REVIEW — MG-02 · --color-primary-2 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.63  

**Actual:** --color-palette-bg-brand  
**Expected:** an HDS bg role, or none

Jev maps `--color-primary-2` (#e90c17, used as bg by Button) to HDS `--color-palette-bg-brand`. Confidence 0.63 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-primary-3 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.53  

**Actual:** --color-palette-bg-brand  
**Expected:** an HDS bg role, or none

Jev maps `--color-primary-3` (#ff858a, used as bg by Button) to HDS `--color-palette-bg-brand`. Confidence 0.53 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-secondary-1 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.57  

**Actual:** --color-palette-border-brand  
**Expected:** an HDS border role, or none

Jev maps `--color-secondary-1` (#0865b4, used as border by Button) to HDS `--color-palette-border-brand`. Confidence 0.57 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-secondary-1 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.42  

**Actual:** none  
**Expected:** an HDS bg role, or none

Jev found no HDS bg role that fits `--color-secondary-1`. HDS has one brand slot and no secondary or accent role, so this is expected for part of MotorTrend's palette — and it is the gap the migration has to resolve, not a mapping to force.

**Affects:**
- Button

**Recommendation:** Escalate: `--color-secondary-1` has no HDS home as a bg. Either HDS gains a role for it, or MotorTrend accepts losing it.

#### 🟠 REVIEW — MG-02 · --color-secondary-1 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.45  

**Actual:** --color-palette-txt-brand  
**Expected:** an HDS txt role, or none

Jev maps `--color-secondary-1` (#0865b4, used as txt by Button) to HDS `--color-palette-txt-brand`. Confidence 0.45 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-secondary-3 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.33  

**Actual:** --color-palette-border-brand  
**Expected:** an HDS border role, or none

Jev maps `--color-secondary-3` (#c1eaff, used as border by Button) to HDS `--color-palette-border-brand`. Confidence 0.33 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-secondary-3 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.36  

**Actual:** none  
**Expected:** an HDS bg role, or none

Jev found no HDS bg role that fits `--color-secondary-3`. HDS has one brand slot and no secondary or accent role, so this is expected for part of MotorTrend's palette — and it is the gap the migration has to resolve, not a mapping to force.

**Affects:**
- Button

**Recommendation:** Escalate: `--color-secondary-3` has no HDS home as a bg. Either HDS gains a role for it, or MotorTrend accepts losing it.

#### 🟠 REVIEW — MG-02 · --color-neutral-1 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.32  

**Actual:** --color-palette-bg-default  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-1` (#141416, used as bg by Button, Card, Typography) to HDS `--color-palette-bg-default`. Confidence 0.32 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-1 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.69  

**Actual:** --color-palette-txt-default  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-1` (#141416, used as txt by Button, Card, Typography) to HDS `--color-palette-txt-default`. Confidence 0.69 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-2 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.40  

**Actual:** --color-palette-bg-default  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-2` (#23262f, used as bg by Button, Card, Typography) to HDS `--color-palette-bg-default`. Confidence 0.40 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-2 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.62  

**Actual:** --color-palette-txt-default  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-2` (#23262f, used as txt by Button, Card, Typography) to HDS `--color-palette-txt-default`. Confidence 0.62 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-2 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.60  

**Actual:** --color-palette-border-default  
**Expected:** an HDS border role, or none

Jev maps `--color-neutral-2` (#23262f, used as border by Button, Card, Typography) to HDS `--color-palette-border-default`. Confidence 0.60 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-3 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.40  

**Actual:** --color-palette-bg-default  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-3` (#353945, used as bg by Button, Card, Typography) to HDS `--color-palette-bg-default`. Confidence 0.40 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-3 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.61  

**Actual:** --color-palette-txt-default  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-3` (#353945, used as txt by Button, Card, Typography) to HDS `--color-palette-txt-default`. Confidence 0.61 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-3 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.60  

**Actual:** --color-palette-border-default  
**Expected:** an HDS border role, or none

Jev maps `--color-neutral-3` (#353945, used as border by Button, Card, Typography) to HDS `--color-palette-border-default`. Confidence 0.60 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-4 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.37  

**Actual:** --color-palette-bg-brand  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-4` (#6e7481, used as bg by Button) to HDS `--color-palette-bg-brand`. Confidence 0.37 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-5 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.39  

**Actual:** --color-palette-bg-brand  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-5` (#b1b5c3, used as bg by Button) to HDS `--color-palette-bg-brand`. Confidence 0.39 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-6 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.60  

**Actual:** --color-palette-bg-default  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-6` (#e6e8ec, used as bg by Button, Card, Typography) to HDS `--color-palette-bg-default`. Confidence 0.60 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-6 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.19  

**Actual:** --color-palette-txt-on-brand  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-6` (#e6e8ec, used as txt by Button, Card, Typography) to HDS `--color-palette-txt-on-brand`. Confidence 0.19 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-6 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.67  

**Actual:** --color-palette-border-default  
**Expected:** an HDS border role, or none

Jev maps `--color-neutral-6` (#e6e8ec, used as border by Button, Card, Typography) to HDS `--color-palette-border-default`. Confidence 0.67 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-7 (as bg)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.55  

**Actual:** --color-palette-bg-default  
**Expected:** an HDS bg role, or none

Jev maps `--color-neutral-7` (#f4f5f6, used as bg by Button, Typography) to HDS `--color-palette-bg-default`. Confidence 0.55 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-7 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.16  

**Actual:** --color-palette-txt-on-brand  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-7` (#f4f5f6, used as txt by Button, Typography) to HDS `--color-palette-txt-on-brand`. Confidence 0.16 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-8 (as txt)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.28  

**Actual:** --color-palette-txt-knockout  
**Expected:** an HDS txt role, or none

Jev maps `--color-neutral-8` (#fcfcfd, used as txt by Button, Card, Typography) to HDS `--color-palette-txt-knockout`. Confidence 0.28 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MG-02 · --color-neutral-8 (as border)

**Rule:** HDS role mapping  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.62  

**Actual:** --color-palette-border-default  
**Expected:** an HDS border role, or none

Jev maps `--color-neutral-8` (#fcfcfd, used as border by Button, Card, Typography) to HDS `--color-palette-border-default`. Confidence 0.62 is below the gate, so this needs a designer to confirm.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Record the mapping. Confirm with design before migrating any component that uses it.

#### 🟠 REVIEW — MT-01 · --color-info-1

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.82  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.82 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-info-2

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.45  

**Actual:** brand  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.45 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-info-3

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.38  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.38 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-info-4

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.52  

**Actual:** brand  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.52 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-success-3

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.78  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.78 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-warning-1

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.64  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.64 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-warning-2

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.72  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.72 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-warning-3

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.63  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.63 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — MT-01 · --color-warning-4

**Rule:** Approved MotorTrend palette  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.82  

**Actual:** status  
**Expected:** brand, status, or neutral; gate 0.85

confidence 0.82 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-primary-1

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.42  

**Actual:** primitive (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.42 is below the 0.85 gate for this rule

**Affects:**
- Button
- Card

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-primary-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.54  

**Actual:** primitive (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.54 is below the 0.85 gate for this rule

**Affects:**
- Button

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-primary-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.71  

**Actual:** primitive (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.71 is below the 0.85 gate for this rule

**Affects:**
- Button

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-secondary-1

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.37  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.37 is below the 0.85 gate for this rule

**Affects:**
- Button

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-secondary-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.36  

**Actual:** primitive (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.36 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-secondary-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.53  

**Actual:** primitive (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.53 is below the 0.85 gate for this rule

**Affects:**
- Button

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-error-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.77  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.77 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-error-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.69  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.69 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-error-4

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.69  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.69 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-info-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.83  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.83 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-info-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.62  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.62 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-info-4

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.73  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.73 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-neutral-1

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.75  

**Actual:** primitive (declared: primitive)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.75 is below the 0.85 gate for this rule

**Affects:**
- Button
- Card
- Typography

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-neutral-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.81  

**Actual:** primitive (declared: primitive)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.81 is below the 0.85 gate for this rule

**Affects:**
- Button
- Card
- Typography

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-neutral-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.82  

**Actual:** primitive (declared: primitive)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.82 is below the 0.85 gate for this rule

**Affects:**
- Button
- Card
- Typography

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-success-1

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.76  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.76 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-success-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.73  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.73 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-success-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.76  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.76 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-success-4

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.49  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.49 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-warning-2

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.79  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.79 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-warning-3

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.74  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.74 is below the 0.85 gate for this rule

**Recommendation:** None.

#### 🟠 REVIEW — NM-03 · --color-warning-4

**Rule:** Tier classification  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.74  

**Actual:** semantic (declared: semantic)  
**Expected:** declared tier matches judged tier; gate 0.85

confidence 0.74 is below the 0.85 gate for this rule

**Recommendation:** None.

## 🟡 Warnings (41)

#### 🟡 WARN — AX-03 · Card

**Rule:** Visible focus indicator  
**Class:** deterministic · **Band A** (eligible to block)  

**Actual:** no focus styling anywhere in Card; stories pass interactive props  
**Expected:** a focus indicator wherever the component can receive focus

Card's own source renders no inherently focusable element, so SC 1.4.11 does not apply to it directly. However its stories (Card/Card.stories.tsx, Card/CardContent/CardContent.stories.tsx, Card/CardGrid/CardGrid.stories.tsx, Card/CardMedia/CardMedia.stories.tsx, Card/CardTitle/CardTitle.stories.tsx) demonstrate it with `href`/`onClick`, so it is used as an interactive target in practice, and the component declares no `focus-visible:` styling at all. Whoever wraps it must supply the focus indicator, and nothing enforces that.

**Affects:**
- Card

**Recommendation:** Either add a `focus-visible:` ring to Card for when it receives interactive props, or document that callers must provide one. WARN rather than FAIL because the obligation sits with the consumer, not this component.

#### 🟡 WARN — AX-04 · Button

**Rule:** Disabled state differentiation  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** disabled `aria-disabled:bg-primary-1/50` composites to #df8c8a on #fcfcfd; vs enabled #e90c17 = 1.81:1  
**Expected:** ≥ 3:1 between states, or a non-colour signal

Button's disabled background composites to #df8c8a, only 1.81:1 from the enabled #e90c17. Colour alone is a weak signal here. No opacity or other non-colour signal was detected, which makes this closer to a real problem.

**Affects:**
- Button

**Recommendation:** Confirm with design that the opacity change is sufficient. WCAG exempts inactive controls from text-contrast minimums, so the goal is perceivability, not a ratio.

#### 🟡 WARN — AX-04 · Card

**Rule:** Disabled state differentiation  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** no disabled-state styling found  
**Expected:** a disabled state distinguishable by more than colour

No `disabled:` or `aria-disabled:` styling was found in Card. If it can be disabled, users have no visual signal.

**Affects:**
- Card

**Recommendation:** Add disabled styling, or confirm Card has no disabled state.

#### 🟡 WARN — AX-04 · Typography

**Rule:** Disabled state differentiation  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** no disabled-state styling found  
**Expected:** a disabled state distinguishable by more than colour

No `disabled:` or `aria-disabled:` styling was found in Typography. If it can be disabled, users have no visual signal.

**Affects:**
- Typography

**Recommendation:** Add disabled styling, or confirm Typography has no disabled state.

#### 🟡 WARN — AX-05 · Button

**Rule:** Interactive target size  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** max-h-12 = 48px · max-h-10 = 40px · max-h-8 = 32px  
**Expected:** ≥ 24×24px (SC 2.5.8, AA); ≥ 44×44px (SC 2.5.5, AAA)

Button meets the 24px Level AA minimum (smallest is max-h-8 at 32px) but max-h-10, max-h-8 fall below the 44px Level AAA target. Note these are declared with `max-h-*`, a maximum rather than a minimum, so content cannot grow the target beyond the cap.

**Affects:**
- Button

**Recommendation:** If AAA is a goal, raise the smaller sizes to 44px or ensure adequate spacing around them. Consider whether `max-h-*` should be `min-h-*` — as written, a longer label is clipped rather than growing the target.

#### 🟡 WARN — MG-01 · 54 IDS tokens

**Rule:** IDS → HDS migration mapping  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** no mapping table exists  
**Expected:** config/ids-to-hds.json mapping every IDS token to its HDS equivalent

No IDS → HDS mapping table was found, so migration coverage cannot be verified. Scale of the gap: IDS declares 54 tokens (32 colour), HDS declares 2820. The migration is therefore not a rename but roughly a 52× increase in granularity plus a one-tier → three-tier restructure. Every IDS token will fan out into several HDS semantic and component tokens, and most HDS component tokens will have no IDS ancestor at all.

**Recommendation:** Create `config/ids-to-hds.json` as `{ "color-primary-2": ["comp-btn-primary-color-bg-solid", ...] }`. Generate a first draft from component usage, then have design correct it. Once it exists, this rule becomes a real gate: it will fail when a token is added to IDS without a migration plan.

#### 🟡 WARN — MT-02 · spacing (category)

**Rule:** Approved spacing scale  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** no spacing tokens defined in IDS; Tailwind defaults used implicitly  
**Expected:** an explicit, governed MotorTrend spacing scale

IDS declares zero spacing tokens — `ids.css` has no `--spacing-*` — so spacing is whatever Tailwind's default scale provides. This rule therefore cannot pass or fail: there is no MotorTrend spacing scale to check against. Reporting PASS here would be passing by vacuum. No arbitrary dimension values were found in the scanned components, which is a good sign.

**Recommendation:** Decide whether MotorTrend adopts Tailwind's default scale explicitly (declare it as tokens so it can be governed and themed) or adopts HDS's 12-step `--dim-space-*` scale ahead of migration. Until then, spacing is ungoverned by construction.

#### 🟡 WARN — MT-04 · 16 typography variants

**Rule:** Editorial hierarchy  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.29  

**Actual:** scores 1.76–1.85 (spread 0.09), median confidence 0.29  
**Expected:** a spread wide enough to separate well-placed variants from badly-placed ones

**This rule produced no usable signal and is reported as inconclusive rather than as 16 passes.** Every variant scored within 0.09 of every other, at a median confidence of 0.29 — the model is expressing uncertainty uniformly, not judging the variants differently. For comparison, the judgment rules that do discriminate on this codebase show confidence spreads above 0.55. The cause is that MotorTrend has no documented editorial hierarchy specification, so the question can only supply the existing ladder as its own reference and ask whether it is consistent with itself. That is close to circular, and the model is right to be unsure.

**Affects:**
- Typography

**Recommendation:** Do not read these scores as a verdict on the type scale. To make this rule work, one of two things has to change: either design documents the intended editorial hierarchy so there is a specification to check against, or the rule is narrowed to something answerable without one — for example "is the step between adjacent levels perceptible?" judged pairwise rather than "does this variant fit the ladder".

#### 🟡 WARN — MT-05 · motortrend font contract

**Rule:** Approved typography  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** 6 font tokens unresolved: --font-hero, --font-heading, --font-body, --font-subtitle, --font-button, --font-caption  
**Expected:** the motortrend theme supplies font-heading = Poppins, font-body = Geist Sans

`themes/motortrend.css` contains **zero** font declarations — it sets colour only — so every `--font-*` token is unresolved inside this repository. The documentation states this is intentional ("Setting the color theme does not change font families"), and the consuming application is expected to set them. But nothing verifies that it does, and `--font-heading: var(--font-heading)` has no terminal fallback: if a consumer forgets, every heading renders in the browser default font with no error, no warning, and no failing test. For motortrend that means losing Poppins and Geist Sans.

**Recommendation:** Either ship the font families in the theme stylesheet alongside the colours, or give each `--font-*` token a terminal fallback so a missed setup degrades to a chosen face rather than the UA default. Failing both, add a runtime assertion in the consuming application — this is the one part of the token contract that IDS cannot enforce for itself.

#### 🟡 WARN — NM-02 · --color-primary-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.99  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-primary-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-primary-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 1.00  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-primary-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-primary-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 1.00  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-primary-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-secondary-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.99  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-secondary-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-secondary-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.99  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-secondary-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-secondary-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.99  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-secondary-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-error-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.69  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-error-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-error-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.86  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-error-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-error-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.89  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-error-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-error-4

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.82  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-error-4` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-info-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.74  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-info-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-info-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.79  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-info-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-info-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.81  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-info-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-info-4

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.79  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-info-4` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.95  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.95  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.97  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-4

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.96  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-4` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-5

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.97  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-5` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-6

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.94  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-6` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-7

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.94  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-7` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-neutral-8

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.89  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-neutral-8` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Affects:**
- Button
- Card
- Typography

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-success-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.77  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-success-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-success-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.92  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-success-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-success-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.85  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-success-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-success-4

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.87  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-success-4` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-warning-1

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.64  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-warning-1` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-warning-2

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.75  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-warning-2` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-warning-3

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.78  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-warning-3` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — NM-02 · --color-warning-4

**Rule:** Semantic naming  
**Class:** judgment (Jev) · **Band B** (advisory)  
**Confidence:** 0.91  

**Actual:** bare-index  
**Expected:** role (advisory — see IDS Colors documentation)

Jev classified `--color-warning-4` as `bare-index`. Advisory only: IDS documents that numbered naming intentionally mirrors Figma, so this is migration input, not a defect.

**Recommendation:** Raise with the UX team as part of the IDS → HDS naming decision.

#### 🟡 WARN — ST-06 · 21 tokens

**Rule:** No orphaned tokens  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** --color-current, --color-transparent, --color-error-1, --color-error-2, --color-error-3, --color-error-4, --color-info-1, --color-info-2, --color-info-3, --color-info-4, --color-success-1, --color-success-2, --color-success-3, --color-success-4, --color-warning-1, --color-warning-2, --color-warning-3, --color-warning-4, --font-email, --aspect-paper, --aspect-vertical  
**Expected:** every token referenced somewhere

21 tokens are defined but not referenced by any other token, utility, or component in the scanned set (Button, Card, Typography). This is WARN not FAIL: IDS is a published library, so consumers outside this repo may use them, and usage scanning only covers the PoC's component subset.

**Recommendation:** Confirm against downstream consumers before removing any of these. Widening the component scan will shrink this list.

#### 🟡 WARN — ST-07 · 4 undocumented tokens

**Rule:** Shipped tokens are documented · `.storybook/blocks/ThemeColors/ThemeColors.jsx`  
**Class:** deterministic · **Band C** (advisory)  

**Actual:** --color-error-4, --color-info-4, --color-success-4, --color-warning-4  
**Expected:** every shipped ramp step enumerated in ThemeColors.jsx

4 colour tokens are defined in `ids.css` and published to consumers, but do not appear anywhere in the Storybook palette: `--color-error-4`, `--color-info-4`, `--color-success-4`, `--color-warning-4`. The `ThemeColors` block hand-enumerates each swatch rather than deriving them from the token set, so adding a token to the CSS does not add it to the documentation. A designer browsing the palette has no way to discover these exist, and an engineer who finds them has no guidance on when to use them.

**Recommendation:** Derive the swatch list from the token set instead of hand-listing it — that removes this entire class of drift permanently. Failing that, add the missing steps to ThemeColors.jsx, or remove them from ids.css if they were not intended to ship.

## 🟢 Passing (101)

<details><summary>Show passing checks</summary>

| Rule | Subject | Actual |
|---|---|---|
| AX-01 | --color-primary-1 | #c11b17 on light surfaces — --color-neutral-8 5.96:1 · --color-neutral-7 5.6:1 · --color-neutral-6 4.98:1 · #ffffff 6.11 |
| AX-01 | --color-primary-3 | #ff858a on dark surfaces — --color-neutral-1 7.86:1 |
| AX-01 | --color-secondary-1 | #0865b4 on light surfaces — --color-neutral-8 5.8:1 · --color-neutral-7 5.45:1 · --color-neutral-6 4.85:1 · #ffffff 5.95 |
| AX-01 | --color-secondary-2 | #33ccff on dark surfaces — --color-neutral-1 9.83:1 |
| AX-01 | --color-secondary-3 | #c1eaff on dark surfaces — --color-neutral-1 14.44:1 |
| AX-01 | --color-error-1 | #4c272e on light surfaces — --color-neutral-8 12.51:1 · --color-neutral-7 11.75:1 · --color-neutral-6 10.46:1 · #ffffff  |
| AX-01 | --color-error-3 | #e38a8a on dark surfaces — --color-neutral-1 7.24:1 |
| AX-01 | --color-error-4 | #fae5e5 on dark surfaces — --color-neutral-1 15.25:1 |
| AX-01 | --color-info-1 | #1d3b54 on light surfaces — --color-neutral-8 11.34:1 · --color-neutral-7 10.65:1 · --color-neutral-6 9.48:1 · #ffffff 1 |
| AX-01 | --color-info-2 | #0865b4 on light surfaces — --color-neutral-8 5.8:1 · --color-neutral-7 5.45:1 · --color-neutral-6 4.85:1 · #ffffff 5.95 |
| AX-01 | --color-info-3 | #33ccff on dark surfaces — --color-neutral-1 9.83:1 |
| AX-01 | --color-info-4 | #c1eaff on dark surfaces — --color-neutral-1 14.44:1 |
| AX-01 | --color-neutral-2 | #23262f on light surfaces — --color-neutral-8 14.74:1 · --color-neutral-7 13.84:1 · --color-neutral-6 12.32:1 · #ffffff  |
| AX-01 | --color-neutral-3 | #353945 on light surfaces — --color-neutral-8 11.24:1 · --color-neutral-7 10.56:1 · --color-neutral-6 9.39:1 · #ffffff 1 |
| AX-01 | --color-neutral-5 | #b1b5c3 on dark surfaces — --color-neutral-1 9:1 |
| AX-01 | --color-success-1 | #283d32 on light surfaces — --color-neutral-8 11.35:1 · --color-neutral-7 10.67:1 · --color-neutral-6 9.49:1 · #ffffff 1 |
| AX-01 | --color-success-3 | #81c784 on dark surfaces — --color-neutral-1 9.14:1 |
| AX-01 | --color-success-4 | #e7f4e7 on dark surfaces — --color-neutral-1 16.2:1 |
| AX-01 | --color-warning-1 | #553925 on light surfaces — --color-neutral-8 10.25:1 · --color-neutral-7 9.63:1 · --color-neutral-6 8.57:1 · #ffffff 10 |
| AX-01 | --color-warning-2 | #f57c00 on dark surfaces — --color-neutral-1 6.8:1 |
| AX-01 | --color-warning-3 | #ffb74d on dark surfaces — --color-neutral-1 10.63:1 |
| AX-01 | --color-warning-4 | #fff1df on dark surfaces — --color-neutral-1 16.56:1 |
| AX-03 | Button (dark mode) | 14.44:1 — ring `--color-secondary-3` #c1eaff on offset `--color-neutral-1` #141416 |
| AX-03 | Button (light mode) | 5.8:1 — ring `--color-secondary-1` #0865b4 on offset `--color-neutral-8` #fcfcfd |
| AX-03 | Typography | not interactive — no focusable element detected |
| MG-02 | --color-primary-1 (as bg) | --color-palette-bg-brand |
| MG-02 | --color-primary-2 (as border) | --color-palette-border-brand |
| MG-02 | --color-primary-2 (as txt) | --color-palette-txt-brand |
| MG-02 | --color-neutral-8 (as bg) | --color-palette-bg-default |
| MT-01 | --color-error-1 | status |
| MT-01 | --color-error-2 | status |
| MT-01 | --color-error-3 | status |
| MT-01 | --color-error-4 | status |
| MT-01 | --color-neutral-1 | neutral |
| MT-01 | --color-neutral-2 | neutral |
| MT-01 | --color-neutral-3 | neutral |
| MT-01 | --color-neutral-4 | neutral |
| MT-01 | --color-neutral-5 | neutral |
| MT-01 | --color-neutral-6 | neutral |
| MT-01 | --color-neutral-7 | neutral |
| MT-01 | --color-neutral-8 | neutral |
| MT-01 | --color-success-1 | status |
| MT-01 | --color-success-2 | status |
| MT-01 | --color-success-4 | status |
| NM-01 | --color-primary-1 | noul 0.88 |
| NM-01 | --color-primary-2 | noul 0.75 |
| NM-01 | --color-primary-3 | noul 0.92 |
| NM-01 | --color-secondary-1 | noul 0.85 |
| NM-01 | --color-secondary-2 | noul 0.78 |
| NM-01 | --color-secondary-3 | noul 0.84 |
| NM-01 | --color-error-1 | noul 0.80 |
| NM-01 | --color-error-2 | noul 0.88 |
| NM-01 | --color-error-3 | noul 0.91 |
| NM-01 | --color-error-4 | noul 0.86 |
| NM-01 | --color-info-1 | noul 0.85 |
| NM-01 | --color-info-2 | noul 0.83 |
| NM-01 | --color-info-3 | noul 0.85 |
| NM-01 | --color-info-4 | noul 0.87 |
| NM-01 | --color-neutral-1 | noul 0.92 |
| NM-01 | --color-neutral-2 | noul 0.90 |
| NM-01 | --color-neutral-3 | noul 0.92 |
| NM-01 | --color-neutral-4 | noul 0.93 |
| NM-01 | --color-neutral-5 | noul 0.94 |
| NM-01 | --color-neutral-6 | noul 0.93 |
| NM-01 | --color-neutral-7 | noul 0.93 |
| NM-01 | --color-neutral-8 | noul 0.95 |
| NM-01 | --color-success-1 | noul 0.87 |
| NM-01 | --color-success-2 | noul 0.86 |
| NM-01 | --color-success-3 | noul 0.87 |
| NM-01 | --color-success-4 | noul 0.90 |
| NM-01 | --color-warning-1 | noul 0.85 |
| NM-01 | --color-warning-2 | noul 0.86 |
| NM-01 | --color-warning-3 | noul 0.88 |
| NM-01 | --color-warning-4 | noul 0.89 |
| NM-03 | --color-error-1 | semantic (declared: semantic) |
| NM-03 | --color-info-1 | semantic (declared: semantic) |
| NM-03 | --color-neutral-4 | primitive (declared: primitive) |
| NM-03 | --color-neutral-5 | primitive (declared: primitive) |
| NM-03 | --color-neutral-6 | primitive (declared: primitive) |
| NM-03 | --color-neutral-7 | primitive (declared: primitive) |
| NM-03 | --color-neutral-8 | primitive (declared: primitive) |
| NM-03 | --color-warning-1 | semantic (declared: semantic) |
| NM-05 | --color-secondary-1 ≡ --color-info-2 | both resolve to #0865b4; noul 0.15 |
| NM-05 | --color-secondary-2 ≡ --color-info-3 | both resolve to #33ccff; noul 0.16 |
| NM-05 | --color-secondary-3 ≡ --color-info-4 | both resolve to #c1eaff; noul 0.15 |
| ST-01 | 26 references | all references resolve |
| ST-02 | 54 tokens | no cycles |
| ST-03 | typed tokens | all typed values valid |
| ST-04 | --color-primary-1 | motortrend theme = #c11b17 · --color-primary-1-default = #c11b17 |
| ST-04 | --color-primary-2 | motortrend theme = #e90c17 · --color-primary-2-default = #e90c17 |
| ST-04 | --color-primary-3 | motortrend theme = #ff858a · --color-primary-3-default = #ff858a |
| ST-04 | --color-secondary-1 | motortrend theme = #0865b4 · --color-secondary-1-default = #0865b4 |
| ST-04 | --color-secondary-2 | motortrend theme = #33ccff · --color-secondary-2-default = #33ccff |
| ST-04 | --color-secondary-3 | motortrend theme = #c1eaff · --color-secondary-3-default = #c1eaff |
| ST-04 | src/tailwind/config.ts | all resolved colours present |
| ST-05 | --font-hero | var(--font-hero, var(--font-heading)) — supplied at runtime |
| ST-05 | --font-heading | var(--font-heading) — supplied at runtime |
| ST-05 | --font-body | var(--font-body) — supplied at runtime |
| ST-05 | --font-subtitle | var(--font-subtitle, var(--font-heading)) — supplied at runtime |
| ST-05 | --font-button | var(--font-button, var(--font-heading)) — supplied at runtime |
| ST-05 | --font-caption | var(--font-caption, var(--font-body)) — supplied at runtime |

</details>

## Token → component impact

Which components break if a token changes. Limited to the scanned component set.

| Token | Used by |
|---|---|
| `--color-neutral-1` | Button, Card, Typography |
| `--color-neutral-2` | Button, Card, Typography |
| `--color-neutral-3` | Button, Card, Typography |
| `--color-neutral-4` | Button |
| `--color-neutral-5` | Button |
| `--color-neutral-6` | Button, Card, Typography |
| `--color-neutral-7` | Button, Typography |
| `--color-neutral-8` | Button, Card, Typography |
| `--color-primary-1` | Button, Card |
| `--color-primary-2` | Button |
| `--color-primary-3` | Button |
| `--color-secondary-1` | Button |
| `--color-secondary-3` | Button |

---

Generated by `npm run tokens:report` · see `tools/token-qualifier/README.md` to add or change a rule.
