# More panel self-play QA — 2026-09-04

## Scope and candidate identity

- Route surface: the desktop and mobile `More` navigation panel.
- Starting and ending Git SHA: `19b6fa1ed625dbab5b8a8d77d1f381afd6bf6f06`.
- Node: `v24.19.0`.
- pnpm: `11.24.0`.
- Fixture identity: the repository's deterministic synthetic browser workspace
  (`Avery Example`, synthetic career evidence, and synthetic saved jobs). No
  live provider, personal data, or network-dependent evaluation was used.
- Existing unrelated working-tree changes were preserved. No commit, push, PR,
  reset, rebase, or discard was performed.

Frozen baseline hashes:

| Artifact                                        | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/App.tsx`                          | `AB218FA0C0E111BAE6361DF241B40C94B99FE6BDB1B3A833B4A34E707FF85085` |
| `apps/web/src/styles.css`                       | `BDDF84DBB8C28DEF0D4E1D45C1F8D52CBF485C5B9DA596EA794BCF339A3CAD4C` |
| `tests/browser/workbench.spec.ts`               | `232D010AEDF7338137C12BC035DD9AC6CD91AE98BADB245254C8AB225B444A85` |
| `docs/qa/generated/milestone-2/mobile-more.png` | `D0E611B829548CE083AED7E27887FE7763630DBC3B7962F3244FDDC882D4F697` |

Final source and test hashes:

| Artifact                          | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/App.tsx`            | `3C4ABFC3B9A75590C9563D39CA36FA7CC90A9753056EC85F1F2A5D0D40549FAF` |
| `apps/web/src/styles.css`         | `5713ACFE43BEC1A85BE2B775DC2360BE7D3E5240FB1E260F6DE429A00D400874` |
| `tests/browser/workbench.spec.ts` | `0A14BAE567884B9A5832B7299AEF91AC01E21CCDB42FB804F3DE7F770920AE1B` |

## Falsifiable property and cases

Property: after a brief scan, a first-time user can identify one starting point,
the order of the core career journey, and which destinations are workspace
support rather than journey steps. The panel remains readable and operable on
desktop, 375×812 and 320×812 mobile, and keyboard/screen-reader paths.

The same frozen candidate was given to two read-only, conversation-clean
evaluators for these cases:

1. 1280×720 `/discover`, panel open, five-second scan.
2. 375×812 mobile, first viewport and all reachable content.
3. A route represented inside More, checking current and next context.
4. Tab, Shift+Tab, Escape, accessible names, clipping, and overflow.

Failure evidence was any reproducible misordering, inability to identify the
start or next step, support tool mistaken for a career step, hidden essential
description, ambiguous accessible name, clipping, overflow, or focus failure.

## Iterations

### Frozen baseline

Both clean evaluators returned `FAIL`.

- `Collect`, `Decide`, `Prepare`, and `Maintain` had equal visual weight, so
  `Maintain` could be read as another required career phase.
- The desktop overlay hid the five-step journey rail and did not state the
  earlier `Career record → Find roles` start.
- `Application progress` appeared under `Prepare`, conflicting with the route's
  Stage 4 `Track` / Stage 5 `Prepare` language.
- Mobile hid the descriptions that explained what each destination was for.

### Causal revision

- Added the explicit start `Career record → Find roles`.
- Replaced the four abstract buckets with one top-to-bottom continuation path:
  `Saved jobs (2) → Fit analysis (3A) → Compare roles (3B) → Application progress (4) → Materials (5)`.
- Moved import, activity, preferences, and diagnostics under `Workspace support`
  with the explicit message `not career steps`.
- Kept action-oriented descriptions visible at mobile sizes.
- Preserved concise link names while connecting each visible explanation with
  `aria-describedby`; the current route also shows `Current` and exposes
  `aria-current="page"`.
- Made the underlying mobile navigation and main content inert while the modal
  panel is open, and restored focus after Escape once the trigger is interactive
  again.

The first focused rerun found a new reproducible counterexample: the desktop
panel ended at `y=748.66` in a 720px viewport. The panel was anchored at 1rem
from the viewport top, after which the failing case and the existing
accessibility control passed.

### Clean recheck

Two new conversation-clean evaluators returned `PASS`. Both independently
recovered the same start, ordered path, support boundary, current-route state,
and keyboard behavior. Their remaining uncertainty was limited to the fact that
a five-second scan is a reviewer judgment rather than a timed user study.

### Accessibility and complete-stage follow-up

A subsequent screenshot review exposed two issues not represented by the first
property: the open desktop trigger did not visibly read as selected, and the
`2 / 3A / 3B / 4 / 5` tool sequence omitted canonical Stage 1. The follow-up
revision:

- highlights `More` whenever the desktop disclosure or mobile dialog is open;
- uses the canonical Stage 1–5 model: Career evidence, Find roles, Evaluate and
  compare, Track progress, and Prepare materials;
- nests Saved jobs and Compare roles as destinations within Stages 2 and 3
  instead of inventing substage numbers;
- exposes all five stages as an ordered list with headings announced as
  `Stage n of 5`, while decorative numerals and icons remain hidden from the
  accessibility name;
- gives the mobile dialog a visible programmatic name and description, adds
  `aria-haspopup="dialog"`, connects link help with `aria-describedby`, and
  preserves `aria-current="page"` for the active destination;
- makes background navigation and page content inert while the mobile dialog is
  open, traps Tab and Shift+Tab, and restores focus on Escape;
- adds a Chromium accessibility-tree assertion for the dialog, Stage 1 heading,
  Fit analysis description, and exclusion of inert background content.

The first full E2E follow-up run reached 33/34 tests but failed before the UI
assertions because an existing setup helper checked the sidebar before the React
snapshot finished rendering and attempted duplicate fixture setup. A bounded
readiness wait removed that race; the focused control and the next full E2E run
passed.

### Visual-density follow-up

A final first-time-user review found that the corrected hierarchy still made
every row explain itself twice. The visible panel now keeps only the title,
compact stage labels, and destination names. Stage and destination explanations
remain connected to their controls for assistive technology but use the shared
visually-hidden treatment. The two group prompts were shortened to
`Work top to bottom` and `Use when needed`.

This reduced the 1280px panel from 639px to 560px of content height and the
320px panel from 891px to 686px. All 11 destinations, including Workspace
support, now fit without internal scrolling at every measured viewport. The
focused accessibility-tree assertion still recovers the hidden Fit analysis
description.

### Deduplication follow-up

A screenshot comparison then exposed a second problem: `Five stages`,
`Career journey`, `Work top to bottom`, and the visible stage names repeated the
same meaning already expressed by the numbered destinations. The final revision
uses one visible `Career path` heading, the numerals 1–5, and the destination
names. It also removes the redundant support prompt and a duplicate divider
beneath the title.

The canonical stage names remain semantic headings in the accessibility tree,
and destination explanations remain available through `aria-describedby`.
Focused tests assert that these labels are available to assistive technology but
no longer add visual text. The final 1280px panel is 497px tall, and the mobile
panel is 593px tall with no internal scroll.

## DOM measurements

| Viewport | Panel bounds (L/T/R/B) | Panel client/scroll height | Journey bottom | Links | Minimum link box | Document overflow |
| -------- | ---------------------- | -------------------------- | -------------- | ----- | ---------------- | ----------------- |
| 1280×720 | `230 / 16 / 806 / 515` | `497 / 497`                | —              | 11    | `251×48`         | 0                 |
| 768×1024 | `230 / 16 / 750 / 515` | `497 / 497`                | —              | 11    | `223×48`         | 0                 |
| 375×812  | `9 / 113 / 366 / 708`  | `593 / 593`                | —              | 11    | `163×48`         | 0                 |
| 320×812  | `9 / 113 / 311 / 708`  | `593 / 593`                | —              | 11    | `135×48`         | 0                 |

All five career stages and all Workspace support destinations fit in the initial
panel viewport without internal scrolling. Every interactive destination exceeds
the 40×40 CSS pixel target.

## Verification

| Command                                                                                                 | Exit | Result                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                        |    0 | TypeScript project references and tool config passed.                                                                                        |
| `pnpm build`                                                                                            |    0 | Web production build passed.                                                                                                                 |
| `pnpm exec playwright test tests/browser/workbench.spec.ts --grep "More panel makes\|@a11y key routes"` |    0 | 2/2 focused and accessibility regression-control tests passed.                                                                               |
| `pnpm check`                                                                                            |    0 | Formatting, lint, typecheck, 26 test files / 336 tests, contracts, provenance, DSH patches, hygiene, docs, build, and package checks passed. |
| `pnpm test:e2e`                                                                                         |    0 | 34/34 browser tests passed.                                                                                                                  |
| `git diff --check`                                                                                      |    0 | No whitespace errors.                                                                                                                        |

Skipped or unavailable gates: none.

## Exact-viewport screenshots

| Screenshot                                                               | SHA-256                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `docs/qa/generated/more-panel-selfplay/more-panel-1280x720.png`          | `4B8E66E00535CCE4A7B147B7A9C53DC712700BA7F9D47E956EC23034AFFAD982` |
| `docs/qa/generated/more-panel-selfplay/more-panel-768x1024.png`          | `54E50E5E51F979FB1DA2D3930A468F0B59D6EEACC42B19D59762782F63380ED5` |
| `docs/qa/generated/more-panel-selfplay/more-panel-375x812.png`           | `55FDB116A5507CD461CF4EE5C9DE7DC03B80389EFCD3643E09DC0CBD42ED87C1` |
| `docs/qa/generated/more-panel-selfplay/more-panel-375x812-support.png`   | `55FDB116A5507CD461CF4EE5C9DE7DC03B80389EFCD3643E09DC0CBD42ED87C1` |
| `docs/qa/generated/more-panel-selfplay/more-panel-320x812.png`           | `66FB157A32FE19426AFAC2B067BB3C058988614B7ED446082B71FAF5E084BF0A` |
| `docs/qa/generated/more-panel-selfplay/more-panel-320x812-support.png`   | `66FB157A32FE19426AFAC2B067BB3C058988614B7ED446082B71FAF5E084BF0A` |
| `docs/qa/generated/more-panel-selfplay/more-panel-activity-1280x720.png` | `3653BBA3553296D5C02BC5B53CA803065C71685E6B27245468A1FDD9AB4049B1` |
