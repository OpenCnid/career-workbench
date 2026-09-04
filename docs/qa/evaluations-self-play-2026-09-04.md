# Evaluations self-play evidence — 2026-09-04

## Scope and candidate identity

- Route: `/evaluations`
- Synthetic seed: `evaluations-self-play-v1`
- Start SHA: `19b6fa1ed625dbab5b8a8d77d1f381afd6bf6f06`
- Delivery branch: `fix/evaluations-pipeline-more-ux` (PR #6)
- Node: `v24.19.0`
- pnpm: `11.24.0`
- Starting worktree: clean
- The evidence was first captured before delivery; the user subsequently
  authorized commit, push, pull request, and merge.

The requested handoff baseline was `16a6be4dc6ddabe35d94ace59819b34a1e6e853f`.
The merge base between HEAD and that commit is the starting HEAD. HEAD is an
ancestor of the handoff commit, the handoff commit is not an ancestor of HEAD,
and `git diff --quiet HEAD 16a6be4...` returned exit 0. The trees were
equivalent, so the worktree was not moved.

All fixture values, retained screenshots, source locators, organizations, roles,
evidence, and timestamps are synthetic. No provider or network-backed evaluation
was used.

## Starting freeze

Relevant committed source SHA-256 values at the clean starting SHA:

| File                              | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `apps/server/src/routes.ts`       | `44E2A50F275F22C3851A279FED7D33CE58530EFEBB2F21CB5F76E532006D4967` |
| `apps/web/src/api.ts`             | `EF559CB8E41505DD4AC8695FCE1106BA14E7BEDC6227024441696B082B4F643B` |
| `apps/web/src/App.tsx`            | `7CF7EBF220C5C37739492D318157263CA04B7A77B21C5414C4B2672E7E46BB82` |
| `apps/web/src/styles.css`         | `C0B416A65D95D3B02646FD728A23613F578BFBFDB7E8EDC13BDFC57CFFC0C756` |
| `packages/contracts/src/api.ts`   | `A5041B8DD4F59E09E6C43B0E006F00281672F808E041F56562CAD6CCC997C3BB` |
| `playwright.config.ts`            | `603161B88018C2D88DE30A8CABE9770F02D168F12005E6FA30E6DF100BF35B1D` |
| `pnpm-lock.yaml`                  | `DB771CE99D18DBC7CCF55D6967DF86DC86A7680ABC9B878B0528CD59CF03CD4D` |
| `tests/browser/workbench.spec.ts` | `9F6110139A124BFF85456F6097FBFA8D08E32B8A7ED6D664C8D66F827312447F` |

No task-specific runtime log existed at the starting freeze. Exact command
outcomes are recorded below instead of retaining logs that could contain local
paths.

Starting exact-viewport captures:

| Screenshot                                                                        | SHA-256                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/qa/generated/evaluations-selfplay/start/evaluations-1280x720-collapsed.png` | `53CC7D605EAB153FEC802266F3F834842B23F03383DA31409AB3E2B61DB72E1F` |
| `docs/qa/generated/evaluations-selfplay/start/evaluations-768x1024-collapsed.png` | `F0044A9B26393C82F1411FE41C589A7708763EBC94A6A110916A52CCCF0D3D8F` |
| `docs/qa/generated/evaluations-selfplay/start/evaluations-375x812-collapsed.png`  | `AE90C1A9709299AB35125D383BB4BA748B280E24EC2217FAE73C065E8690337E` |
| `docs/qa/generated/evaluations-selfplay/start/evaluations-320x812-collapsed.png`  | `D26393F819A8EB2FEF1CB67079601F9371E7B0691B0E823A18DD37340B38086F` |

The starting candidate failed the first-viewport property at 1280, 375, and 320
pixels. It also used a native 50-item select, rendered unbounded history, lost
deep-link selection, lacked complete provenance recovery, repeated ambiguous
control names, exposed undersized controls, and allowed non-final states to
displace the last valid result.

## User-facing result

The collapsed surface now answers, in order: which job is selected, whether the
fit result is current or non-final, the non-recommendation caveat, one
deterministically selected priority concern, and the next action. Active,
failed, canceled, stale, and resultless terminal operations remain distinct from
the latest valid completed result. A recorded stale score remains inspectable
with its stale reason; a non-final run never presents `0/100` as a result.

The native select is replaced by a searchable, keyboard-operable picker. Fifty
jobs are ordered deterministically and duplicate role/organization pairs receive
requisition or saved-job discriminators. Selection is URL-backed, so a
deep-linked A-to-B switch survives refresh and the next fit check still targets
B.

History renders five compact rows initially and explicitly reveals all nine
historical runs. Rows are newest first and include contextual identity, absolute
locale/timezone timestamps with machine-readable datetimes, state, valid score,
and a signed percentage-point delta against the immediately preceding comparable
completed run. Current and historical detail use one focus-restoring dialog
capped at 65vh with internal scrolling.

Score, evidence, findings, and artifact tabs recover all accepted candidate
facts, additional accepted evidence, run-scoped rejected evidence and reason,
exact source/provenance locators, every gap and contradiction, dimension scores,
fixed-point arithmetic, and artifacts. Long unbroken values wrap and remain
recoverable.

## Deterministic case set

The supported test API serves exactly 50 saved jobs. Only the selected job has
ten evaluation runs: one current and nine historical. The seed includes exact
duplicates, the same role at another organization, long spaced and unbroken
names, four accepted candidate facts, three additional accepted records, two
run-scoped rejected records per run, long exact claims and locators, 12 gaps, 12
contradictions, two weighted dimensions, checked arithmetic, one artifact per
run, and stable timestamps.

Independent fixtures cover no jobs, no accepted career evidence, saved but
unevaluated, pending, running, waiting for user, completed, stale, failed,
canceled, queued, and indeterminate states. Extra boundary fixtures cover a lone
stale result, a lone failed run with retained partial detail, rubric
incomparability, and a resultless terminal operation above a valid prior
completion.

## Self-play revisions

Read-only clean evaluators always received the same frozen hash set and neutral
case matrix for a round. Any reproducible counterexample falsified that round.
The causal revisions were:

1. First-viewport, native-picker, unbounded-history, deep-link, evidence,
   non-final score, and hitbox failures caused the compact summary, searchable
   picker, URL selection, bounded history/dialog, complete detail tabs, and
   lifecycle/result separation.
2. Arithmetic mismatch, missing canonical candidate facts, cross-run rejected
   evidence, the waiting action, active relaunch, whitespace search, rubric
   comparability, and the no-jobs surface caused fixed-point fixture correction,
   canonical-fact recovery, operation-scoped rejection filtering, lifecycle
   action corrections, normalized search, rubric-aware deltas, and a complete
   empty summary.
3. An inaccessible stale run and a visually line-clamped 320px concern caused
   stale score/reason/detail recovery and removal of the concern clamp.
4. A failed current run hidden behind a prior valid completion caused separate
   “Review current run” and “Review last result” actions.
5. Queued and indeterminate dialogs inheriting `running` from the evaluation
   record caused authoritative operation state and terminal messaging to flow
   into the matching current-run dialog.
6. A lone failed run without history caused current-run review to be available
   for every non-recorded current result.
7. A resultless indeterminate operation relabeling a prior completed dialog
   caused state/message overrides to be scoped by operation identity.
8. Screenshot comparison against Find roles and Track progress exposed a split,
   right-aligned Fit check heading with no page-purpose band. The route now uses
   the shared `PageHeader` hierarchy and the existing evaluations story copy,
   with mobile-only density adjustments scoped to Fit check.
9. A setup-incomplete fixture hid the fixed mobile navigation from viewport
   checks. Adding a synthetic completed profile-organization operation exposed
   the overlap: first the completed next action, then seven multi-action
   lifecycle states. Mobile header gaps were tightened, the true fixed-nav top
   became the visibility boundary, and non-completed action sets now use a
   bounded responsive grid.

The final ordinary and adversarial clean evaluators both returned PASS against
the final frozen hashes. The adversarial evaluator also probed 58 visible picker
controls at 320×812 and found no undersized, clipped, or overflowing control.
Residual uncertainty is limited to non-Chromium engines, non-default OS text
scaling beyond the required reflow boundary, and malformed snapshots outside the
public contract.

## Follow-up: header and journey continuity

Interactive QA found that the custom compact evaluations header omitted the
five-step journey rail used by the neighboring workflow pages. The common rail
markup was extracted into `JourneyRail` and reused by both `PageHeader` and the
evaluations header. `/evaluations` now exposes all five links and marks “3
Evaluate and compare” with `aria-current="step"`.

Side-by-side comparison of the supplied Find roles, Fit check, and Track
progress screenshots then showed that the evaluations header still bypassed the
shared page hierarchy: title and description were split across two columns and
the “How this helps / Uses / Creates” band was absent. Two clean read-only
evaluators independently reproduced the structural mismatch. Fit check now uses
`PageHeader` directly, with the same left-aligned eyebrow → title → description
→ rail → purpose-band order as steps 2 and 4.

A second exact-size screenshot comparison found that desktop-only evaluation CSS
still overrode the shared component after the markup was corrected. At the same
1012×898 browser panel, Fit check had no header max-width, a 6.4px eyebrow gap
instead of 12px, a 5vw heading instead of the shared 4vw heading, a 13.6px
description instead of 16px, and 12px rail/story gaps instead of 21.6px/24px.
Those desktop overrides were removed; only the mobile compaction remains. A
computed-style browser regression now compares Discover and Fit check directly,
including header width, eyebrow spacing, title and description typography,
rail/story spacing, and title/description alignment.

The next live comparison exposed a separate shell-level issue: at the in-app
browser's 1397px viewport, the content started 83.84px inside the main column
after the 216px sidebar. The shared desktop gutter now uses a bounded 3vw scale,
measuring 41.92px on both sides in that browser. This correction applies to the
shared content shell, so Find roles and Fit check retain the same alignment. The
regression also requires equal left/right padding and a 24–48px visible desktop
inset rather than allowing the former 6vw drift.

The first shared-header revision passed the four `window.innerHeight` checks,
but a stronger setup-complete fixture showed the 320px fixed navigation
obscuring the next action. The same boundary then exposed wrapped lifecycle
actions in pending, waiting, stale, failed, canceled, queued, and indeterminate
states. Spacing and non-completed action layout were revised without removing
content. Both clean evaluators returned PASS on the frozen revision; one ran 22
non-retaining evaluation tests, and the adversarial evaluator ran 14 targeted
viewport/lifecycle/picker cases.

The first PR portability run exposed a final cross-platform counterexample:
Linux font metrics made the completed next action 16.5px taller than the fixed
navigation boundary and the stale next action 29.1px taller, despite the same
tests passing on Windows. A `max-width: 340px` density reserve now reduces only
spacing and type scale while keeping every required message and hitbox. The
320px regression also requires a 24px reserve above the fixed navigation so a
locally passing edge cannot hide a Linux overflow.

Focused assertions now require the shared DOM order, visible purpose band,
left-aligned title and description, five 40×40-or-larger rail links, every
decision element above the fixed navigation, and no horizontal overflow. The
final `pnpm check` and `pnpm test:e2e` runs are green.

## Final browser measurements

All values below are CSS pixels from the native in-app Chromium browser using
the synthetic supported backend. “Bottom” is the element bounding-box bottom;
each is less than the corresponding `window.innerHeight`.

| Viewport | Header bottom | Story bottom | Job bottom | Score bottom | State bottom | Caveat bottom | Concern bottom | Next action bottom | Fixed nav top | Document / viewport width |
| -------- | ------------: | -----------: | ---------: | -----------: | -----------: | ------------: | -------------: | -----------------: | ------------: | ------------------------: |
| 1280×720 |         381.0 |        377.0 |      535.9 |        542.6 |        578.5 |         618.6 |          666.2 |              719.8 |           n/a |               1280 / 1280 |
| 768×1024 |         402.0 |        398.0 |      548.6 |        563.6 |        599.5 |         639.7 |          724.0 |              777.6 |           n/a |                 768 / 768 |
| 375×812  |         270.1 |        266.1 |      385.5 |        390.8 |        426.1 |         474.8 |          546.5 |              600.6 |         691.7 |                 375 / 375 |
| 320×812  |         279.9 |        275.9 |      389.7 |        395.0 |        427.9 |         468.7 |          545.9 |              595.4 |         691.7 |                 320 / 320 |

At 1280×720, the shared header is 832px wide and its title and description both
begin at x=254.4, after a symmetric 38.4px content gutter. The 768px gutter is
24px. At mobile widths, the fixed-navigation top—not merely
`window.innerHeight`—is the visibility boundary. The 375px and 320px next
actions clear that boundary by 91.1px and 96.3px respectively. Minimum
journey-link boxes were 166.4×40, 100.8×47.2, 71.8×56.4, and 60.8×68 across the
four viewports.

At 320×812, the picker search control remained 44px high, focus entered the
search field, five useful results were visible, and the duplicate search
returned two uniquely labeled Synthetic Labs roles. Current and historical
dialogs remain capped at 65vh with `overflow-y: auto`. All four mobile tabs
remain on one row with 44px hitboxes and equal client/scroll widths. History
renders five rows and exposes “Show all 9 runs.” Escape restores focus to the
originating control.

Focused DOM assertions independently check every required bounding box, document
overflow, hitbox dimensions, concern text clipping, picker keyboard and focus
behavior, deep-link targeting, history counts/dialog dimensions, complete
evidence recovery, lifecycle truth, and axe results.

## Final screenshot inventory

All screenshots below use seed `evaluations-self-play-v1` and are exact viewport
captures, not full-page captures.

| Screenshot                                                                                | Dimensions | SHA-256                                                            |
| ----------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-empty.png`             | 1280×720   | `1674CD30A5B6C483CA33AE8B7AF13B0FE5A2D330E3F739E276B31EF6BC4880A7` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-completed.png`         | 1280×720   | `AEC96A09490496B1DCA51F9C68BB40BE27D5E6453EBB4EF4D2D85071055B09FD` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-768x1024-completed.png`         | 768×1024   | `A408F5C1667AEF08DC9E0C358631AFC76340FF977155CFDFC0CEB91CE69EE451` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-completed.png`          | 375×812    | `ECB7E039F18FA28B0CE7BCFDBCF3238E184306BEEC788465D73E066EA0DC93E4` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-320x812-completed.png`          | 320×812    | `F1077805BA1DE2AF7D68D7B110C1C1BDB7AAA4F9B8BF0BAD3F1A0C1D03CCB904` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-picker-50-jobs.png`     | 375×812    | `97477DA33BF305FA91CBDA9ACF0FD724D56D0F7400F6F4D485C321C1AD313354` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-picker-duplicates.png`  | 375×812    | `BD130F4DBBE9637F54208C00B782FD37ED35905BA2CDA15A9DEA672A52964EE1` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-current-detail.png`     | 375×812    | `FEBB2EDBDF397BF0108AF2FB7F90C8E0DE3F1EAD40660AA0FD041E52807709ED` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-history-five-rows.png`  | 375×812    | `3E401F33EE1B954942A85A77EBC37F9983FCE23ECE407B015F54137BEE7AAAB8` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-768x1024-history-five-rows.png` | 768×1024   | `DFC1C9AD5DBB79657FF5290771964576FB06AF40A5B1589F45E507F4623731F1` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-375x812-history-detail.png`     | 375×812    | `CB4BE4C0718DAB9D1E590FD7DE757ED2A876FFF960999703B1318F75F88DC2A1` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-pending.png`           | 1280×720   | `60852F2D80C8D6921F386D82D6FB1D2BE9C388600EDDC44F8C9AB8E691E42132` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-running.png`           | 1280×720   | `F5F5CE400E63E62790ED05865D590EB22726B49A1DBF5D316A14A5D077E29261` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-failed.png`            | 1280×720   | `1121580452FF8AC09D5C03324AA234312EC19F388B2C883E0DDC755513792807` |
| `docs/qa/generated/evaluations-selfplay/final/evaluations-1280x720-canceled.png`          | 1280×720   | `8BFA7090F95ADF512B76D678C6178E4F8DBF66E4E8DD950A22DA1408C3D839DF` |

## Final source freeze

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/App.tsx`                 | `D359EFE1F29D72F8237C3B7EDD46B39EEB8E7B8A26562E9BEAC080C596049F7E` |
| `apps/web/src/styles.css`              | `A768A4CD81F247A4EC5D0A87E8C0DDAFCFC909C4CA881E9E1991933B17F6B3F2` |
| `packages/contracts/src/api.ts`        | `56FDFBCE2486D830C584E5A8DB676B4EBA8820CD77BAC60D2C865747E5B80719` |
| `tests/support/evaluations-fixture.ts` | `1DD30BE18F6967C4A2489FC0C063CF2BDEE58D0F3D0D8102EF711DB36ED05654` |
| `tests/browser/evaluations.spec.ts`    | `FEA88E1CEC360E6546B04A61C6D7314F60248457F9BBC518ABA5AD739E1878BA` |
| `tests/browser/workbench.spec.ts`      | `0A14BAE567884B9A5832B7299AEF91AC01E21CCDB42FB804F3DE7F770920AE1B` |

## Verification commands

| Command                                                                                                                                                                           | Exit | Result                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/browser/evaluations.spec.ts --grep "content gutter geometry\|above the fold at 1280x720\|above the fold at 768x1024\|above the fold at 320x812"` |    0 | Four focused regression controls passed: shared desktop header/eyebrow/gutter geometry plus completed 1280px, 768px, and 320px viewport visibility                                                            |
| `pnpm check`                                                                                                                                                                      |    0 | Format, ESLint, typecheck, 26 Vitest files / 336 tests, 45 schemas, provenance, four DSH patches, hygiene over 282 retained text files, 27 required docs, production build, and nine package manifests passed |
| `pnpm test:e2e`                                                                                                                                                                   |    0 | 34 Chromium tests passed in 1.7m, including all evaluation, pipeline, More-navigation, and route accessibility coverage                                                                                       |

Two intermediate commands intentionally returned exit 1 while self-play
counterexamples remained: the first setup-complete lifecycle run failed seven
fixed-nav visibility assertions, and the first responsive-action revision left
the stale next-action row 14.2px behind the navigation. During the final shared
header geometry run, the 1280px next action was 3.3px below the viewport and a
parallel full-suite run exposed a 1.4px stale-state overlap at 320px. Each
failure was rerun with a previously passing control after its causal revision.

No required gate was skipped or unavailable. The full E2E command regenerated
synthetic milestone screenshots already tracked under `docs/qa/generated/`;
those outputs were preserved rather than discarded. No live-provider or
third-party mutation test was run because v0.1 forbids those operations and the
acceptance property requires deterministic local fixtures.
