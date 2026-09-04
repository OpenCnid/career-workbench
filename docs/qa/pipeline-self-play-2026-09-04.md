# Application pipeline self-play evidence — 2026-09-04

## Scope and candidate identity

- Route: `/pipeline`
- Synthetic seed identity: `evaluations-self-play-v1` with the deterministic
  `pipeline-selfplay` application, event, and approval overlays
- Start SHA: `19b6fa1ed625dbab5b8a8d77d1f381afd6bf6f06`
- Delivery branch: `fix/evaluations-pipeline-more-ux` (PR #6)
- Node: `v24.19.0`
- pnpm: `11.24.0`
- The evidence was first captured before delivery; the user subsequently
  authorized commit, push, pull request, and merge.

All retained data is synthetic. Browser tests use the supported snapshot and
approval HTTP contracts; no provider, live evaluation, personal data, or
network-dependent state is used.

## Frozen candidates

The initial Stage 4 review froze these SHA-256 values:

| File                              | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/App.tsx`            | `C3770D734ED575A63712D3A3A0A8292D05C7EF7866EF9393958ABCDBB6D7C2AE` |
| `apps/web/src/styles.css`         | `3890AA5A6EAB26FE6F5D04118863579BF1DFB30BCDF58E6DD366695A246F624E` |
| `tests/browser/workbench.spec.ts` | `52469B6612975A1918DFDF629BBF2194974366EC7D4F78083BEBB72CBF51628F` |

The final source and test freeze is:

| File                              | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/App.tsx`            | `D359EFE1F29D72F8237C3B7EDD46B39EEB8E7B8A26562E9BEAC080C596049F7E` |
| `apps/web/src/styles.css`         | `A768A4CD81F247A4EC5D0A87E8C0DDAFCFC909C4CA881E9E1991933B17F6B3F2` |
| `tests/browser/pipeline.spec.ts`  | `877B7760EB281D3CCB13F2DE67985B2AF6913ADD517DA81CE6F20BDCE77D377E` |
| `tests/browser/workbench.spec.ts` | `0A14BAE567884B9A5832B7299AEF91AC01E21CCDB42FB804F3DE7F770920AE1B` |

## User-facing simplification

The application is now one scan path: organization and role, compact current
state, next action, status/history disclosure, then the explicit approval gate.
The stretched status capsule, filled next-action bubble, boxed tracking prompt,
and boxed approval receipt were replaced with flat separators and short left
rules. “Add another job” is a compact disclosure with explicit “Open form” and
“Close form” cues, and its count is shortened to “1 job tracked.”

At mobile widths, the Stage 4 story becomes one compact visible help line while
its Uses/Creates context remains available to assistive technology. The full
approval safety sentence remains visible, and the direct “Review change to
Preparing” label prevents the 44px control from wrapping behind the fixed
navigation.

The interaction follow-up also replaced internal workflow terms. “Update
status,” “Record next state,” “Record transition,” and “Transition history” are
now “Change status,” “New status,” “Save status,” and “Past status changes.” The
collapsed status editor visibly says “Edit” or “Close,” history says “View” or
“Hide,” the tracking form uses “Saved job” and “Add to pipeline,” and pending
agent decisions use “Approve status change” or “Keep current status.”

The current application now precedes the secondary “Add another job” disclosure,
so the current state, next action, and approval decision remain the first task
path at narrow widths. The opportunity selector uses the same deterministic
role/organization ordering as Fit check. Duplicate role, organization, and
requisition combinations receive stable ordinal labels. Application history is
newest first and describes the actual transition, rather than repeating only a
technical event name; timestamps are locale/timezone formatted and retain
machine-readable `datetime` values.

## Self-play counterexamples and revisions

Two read-only, conversation-clean evaluators received the same frozen candidate
and case matrix in each review round.

1. Both reproduced a status pill stretched to the whole identity header, bubble
   overload, duplicate selector ambiguity, unbroken-string overflow, repeated
   technical history labels, undersized history disclosure, and repeated
   context-free control names. This caused the flat status/action/receipt
   hierarchy, deterministic disambiguation, wrapping, semantic history, 40px
   disclosure, and application-scoped accessible names.
2. Both then reproduced that the 375×812 page framing left current status, next
   action, history/update context, and approval below the fixed navigation. The
   Stage 4 mobile header and tracking prompt were compacted without removing the
   journey rail or decision content.
3. Both then found that the approval explanation had been visually clipped, and
   that the authorization control touched the 320px fixed navigation. The safety
   copy was restored as visible text, the approval header became a compact
   two-row grid, journey links retained 40px targets, and the authorization
   label was shortened.
4. The final frozen revision received PASS from both evaluators. Neither found a
   reproducible failure in the ordinary, pending approval, 50-job duplicate,
   long-string, empty, keyboard/accessibility, or multi-transition cases.

The PR portability runs added two more counterexamples. Linux font metrics first
placed the 320px approval control below the fixed-navigation boundary. A second
run showed that an artificial 24px evaluation reserve was stricter than the
product boundary while the secondary “Add another job” disclosure still pushed
the pipeline decision too low. The evaluation assertion now retains an 8px
cross-platform reserve, with narrow-screen card padding reduced enough to clear
that reserve on macOS; the pipeline retains 6px, and the secondary disclosure
moves after the current application. The failing cases and passing lifecycle
controls were rerun before the full suite.

## Focused browser assertions

- At 1280×720, organization, role, current state, next action, and
  update/history disclosure have boxes wholly within `window.innerHeight`.
- At both 375×812 and 320×812, those elements plus the visible approval safety
  sentence and complete review-change button end above the fixed navigation at
  `y = 691.734375` CSS pixels.
- The compact state marker is at most 28px high and has no border radius.
- Journey links remain at least 40px high; native controls and buttons remain at
  least 44px high.
- The history disclosure is at least 40px high, history is newest first, and all
  dates have machine-readable values.
- Exactly 50 job choices remain bounded in a native selector. Even duplicate
  role, organization, and requisition values receive unique `duplicate 1 of 2` /
  `duplicate 2 of 2` labels.
- Long unbroken role and organization values wrap, and document width does not
  exceed viewport width at 1280, 768, 375, or 320 pixels.
- Expanded current/history controls and pending approval have no Axe violations.

## Verification

| Command                                                                                                                                                               | Exit | Result                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------ |
| `pnpm build`                                                                                                                                                          |    0 | TypeScript build and Vite production build passed.                                                     |
| `pnpm exec playwright test tests/browser/pipeline.spec.ts`                                                                                                            |    0 | 5 passed, including four exact viewport captures and focused Axe checks.                               |
| `pnpm exec playwright test tests/browser/workbench.spec.ts tests/browser/pipeline.spec.ts --grep "complete source-to-sealed-artifact\|pipeline hierarchy is compact"` |    0 | Failed integration path and previously passing hierarchy control both passed, 2/2.                     |
| `pnpm check`                                                                                                                                                          |    0 | 26 Vitest files, 336 tests, contracts, provenance, patches, hygiene, docs, build, and packages passed. |
| `pnpm test:e2e`                                                                                                                                                       |    0 | 34 Chromium tests passed in 1.5 minutes.                                                               |

The first full end-to-end attempt exposed two stale assertions for the previous
pipeline choice separator and lowercase state text; a focused rerun then exposed
the old long authorization label. The assertions were updated to the new unique
label, human-readable state, and contextual accessible name. The failing flow
and a passing control were rerun before the final 33/33 suite. No final gate was
skipped or left unmet.

## Final screenshots

All captures are exact viewport screenshots and use the synthetic seed identity
above.

| Viewport | Screenshot                                                        | SHA-256                                                            |
| -------: | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1280×720 | `docs/qa/generated/pipeline-selfplay/final/pipeline-1280x720.png` | `767C9CEFEF7C919BCB5B96683ADEDC5656C945FE06F43C5E47B188F0ED6E6B46` |
| 768×1024 | `docs/qa/generated/pipeline-selfplay/final/pipeline-768x1024.png` | `73A307CBFF72F293B62FFB9F98A4C1A9EBF45A6B675518D190BC68A5866EFA89` |
|  375×812 | `docs/qa/generated/pipeline-selfplay/final/pipeline-375x812.png`  | `7B56DAB063ED690D31E3920ABFCBE9A64947EF4230CB49BC0269E61DFE4FA2F0` |
|  320×812 | `docs/qa/generated/pipeline-selfplay/final/pipeline-320x812.png`  | `E1D4FAF857100779D56EE4CE8506130B0D4CBBDA286A3E7D73326B20DAEE61DF` |
