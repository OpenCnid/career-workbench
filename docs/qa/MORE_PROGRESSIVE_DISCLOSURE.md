# Workflow progressive-disclosure evidence

Status: **pass.** Recorded at `2026-09-03T22:33:55Z` on Microsoft Windows NT
10.0.26200.0 with Node.js 24.19.0 and pnpm 11.24.0.

The final UI candidate is identified by scoped working-tree diff digest
`68b9dee154bc1a87fd0b2fb807061284beb81b40`. This is an evidence identity, not a
Git commit.

## Falsifiable property

At 1280 by 720 pixels and 375 by 812 pixels, every page exposes the current
workflow stage, critical state or blocker, applicable safety boundary, and one
interpretable next action without requiring optional disclosure. Supporting
mechanics such as source bytes, provenance, exact comparison tables, policy and
entity revisions, audit identifiers, digests, versions, and technical receipts
remain available through clearly named disclosures.

Primary decision results are not classified as technical detail. Fit scores,
scenario-leading scores, critical gaps, risks, and trade-offs remain visible
because they materially change the user's decision.

## Procedural information hierarchy

| Page          | Visible by default                                                                                        | Disclosed on request                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Home          | Workflow stage, one next move, supporting counts, and action                                              | Record search, export controls, and sealed-report metadata              |
| Career        | Saved career record and edit actions; intake only when needed                                             | Additional intake, source excerpts, record revisions, and exact builder |
| Jobs          | Search state, disabled-action reason, result count, role risks, Save/Pass, and evaluation handoff         | Extra match reasons, matched criteria, source note, and user note       |
| Opportunities | Saved-job identity, liveness, legitimacy, compact facts, and evaluation handoff                           | Posting text, identifiers, signal controls, and revisions               |
| Evaluations   | Score, non-recommendation caveat, state, evidence/gap counts, and exact critical findings                 | Score arithmetic, evidence provenance, artifacts, and prior checks      |
| Compare       | OS-authority warning, readiness blockers or scenario leaders, critical trade-offs, and approval           | Exact rankings, record binding, and policy version                      |
| Pipeline      | Current state, next action, no-submit boundary, and approval; capture-first guidance when empty           | Transition form, local note, history, and revisions                     |
| Drafts        | Prerequisite help, artifact state, inspection, used-fact count, no-send boundary, and approval            | Optional style, provenance, artifact revision, receipt, and content     |
| Import        | Three-step flow, read-only state, exclusions, warnings, mapping choices, confirmation, and import history | Path mechanics, selected bytes/version, state table, and receipts       |
| Activity      | Connection, active work, recent outcomes, cancellation, and older-work action                             | Audit events, lifecycle detail, IDs, and older completed records        |
| Settings      | Identity/search choices, edit actions, and missing-field explanation                                      | Revision shown only while editing                                       |
| Diagnostics   | Readiness, recovery action, OS-authority warning, and no-external-action boundary                         | Versions, capabilities, and complete trust-boundary list                |

The More menu preserves this procedure through Collect, Decide, Prepare, and
Maintain groups. Its mobile dialog contains the same nine destinations and
cycles focus from first to last in both directions.

## Browser evidence

The in-app browser was used to inspect populated Career, Jobs, Opportunities,
Evaluations, Compare, Import, Activity, and Diagnostics views. The final mobile
clean-room run measured zero horizontal overflow and a 10.15-pixel clearance
between the Diagnostics focus outline and fixed footer at 375 by 812 pixels. All
nine More links were visible; Tab and Shift+Tab wrapped within the dialog, and
Escape closed it and restored focus to More.

The automated browser suite additionally:

- completes the synthetic source-to-sealed-draft workflow;
- proves critical discovery risks, evaluation gaps, comparison trade-offs, and
  import exclusions begin visible;
- proves optional posting data, exact comparison tables, source bytes, audit
  events, receipts, identifiers, and digests begin hidden;
- exercises the opaque More overlay, first/last focus cycling, Escape restore,
  mobile footer clearance, long-card wrapping, and horizontal bounds;
- checks every canonical route for serious or critical axe violations; and
- regenerates only retained screenshots containing synthetic test data.

## Self-play revisions

The evaluator boundary was conversational and read-only, not filesystem
isolation. Each run used a fresh agent without inherited conversation history.
Evaluators could inspect the live local UI and current source/tests but were
forbidden to edit files or mutate application data.

| Candidate                                  | Verdict | Counterexample and minimal revision                                                                                                                                     |
| ------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `90a2e4295176b085d6ac3b8cdfa7b5750d7c4616` | fail    | Compare mislabeled agent-run readiness; mobile More leaked focus and footer-overlapped focus; several disabled-action reasons and decision blockers were hidden.        |
| `229648865de726f91d8591bbcddf3956d1935b14` | fail    | Mobile passed. Critical-first pages passed, but stray revision/version/provenance details remained visible and rare Diagnostics/Settings recovery branches lacked help. |
| `4f72d2cda4edf6704e3e673a2ac0a12d6e4416df` | pass    | Desktop workflow and negative controls passed; primary scores correctly remained visible as decision results. Mobile passed with marginal More-link focus clearance.    |
| `68b9dee154bc1a87fd0b2fb807061284beb81b40` | pass    | Final spacing rerun preserved focus cycling and increased the mobile focus-outline clearance to 10.15 pixels with zero overflow.                                        |

## Commands and results

| Command         | Exit | Bounded result                                                                                                                                              |
| --------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:e2e` |    0 | 4 Chromium tests passed in 1.3 minutes, including complete workflow, every route, populated comparison, mobile focus/overflow, and axe checks               |
| `pnpm check`    |    0 | Formatting, lint, TypeScript, 336 Vitest tests, 45 schemas, provenance, DSH patches, hygiene, docs, production build, and 9 package manifests passed        |
| final self-play |    0 | Desktop critical-first and negative-control cases passed; mobile focus, disclosure, long-title, footer-clearance, and horizontal-boundary cases also passed |

No applicable Milestone 2 UI gate was skipped or left unmet.

## Retained artifact digests

All files contain synthetic data only. SHA-256 digests:

| Artifact                                              | SHA-256                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `generated/milestone-2/mobile-more.png`               | `395981586aada3223fc999b6bf0f3d86eec7609cb27bd693d13a372b852cf814` |
| `generated/milestone-2/activity-recovered.png`        | `747b01c85150f1c685ffcc607ed84a62717c6f7d44d2d62b287f74aee242e3c7` |
| `generated/milestone-2/dark-diagnostics.png`          | `03d962a00e60ebe71054e3f6df7bb9a7362b616436df6a67783dfb875613cc0d` |
| `generated/milestone-2/dark-jobs.png`                 | `d6cd3379a45c13f4d3afb0450ed02279480d0a259dc8e928d6f203237613ff9b` |
| `generated/milestone-2/evaluation-sealed.png`         | `b6e42e1546ec0cc45c8f7a9cdff2c3455d4f400340a0c83274256e3e5266d62d` |
| `generated/milestone-5/comparison-accepted.png`       | `f0b6b5a3c964d9f9f4b5166bdeaf80c5d5efd5f69ecc28392b992396605daa3f` |
| `generated/milestone-6/career-ops-imported.png`       | `ffc6c54b1ed57cee342328e136b2bf3e5d2bd97bd0f081655ad16c3408c400b8` |
| `generated/milestone-7/reviewed-draft-provenance.png` | `4eb44f0815575826dd952deaa564209730a383b917af0c7aca4cef4f80c5f7b2` |

No credential, cookie, private absolute path, personal record, unrestricted
source content, or secret-like value is retained in this evidence.
