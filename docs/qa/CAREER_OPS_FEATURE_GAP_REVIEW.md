# Career Ops feature-gap review

Reviewed on 2026-09-01 against the current
[`career-ops-hq/career-ops`](https://github.com/career-ops-hq/career-ops)
default branch at revision
[`42e6769f45becfaa28f1bd1c8922478b22260748`](https://github.com/career-ops-hq/career-ops/commit/42e6769f45becfaa28f1bd1c8922478b22260748).
The current repository still declares package version `1.31.0` and is MIT
licensed. It differs by 72 files from Career Workbench's normative import and
behavior-reference pin, `3a067ee580b7982cf5dd6edf7895112e4e99600b`, despite
declaring the same version. Package version alone is therefore not a revision
identity.

Career Workbench remains pinned to the source-of-truth revision in `SPEC.md`.
The newer revision was inspected only to answer current feature parity and must
not silently change the importer contract.

## Feature comparison

| Product area               | Current Career Ops                                                                                         | Career Workbench                                                                                                                 | Assessment                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-run profile          | CV paste, LinkedIn-style input, conversational experience intake, target role and search constraints       | One-name setup; résumé or freeform story; in-page DSH-native source organizer; grouped user confirmation; later search direction | Substantially present. Continue with AI now runs the source-bound DSH turn in place and returns canonical proposals to the same page; it is intentionally a bounded organizer rather than an open chat. |
| Job discovery              | Broad provider catalog, board normalization, reverse-ATS and funded-company discovery                      | DSH discovery into a deduplicated source-preserved inbox with user-only shortlist/dismiss triage                                 | Partial. The coherent user-facing workflow exists; board-specific provider adapters and reverse-ATS/funded-company catalogs are not built in.                                                           |
| Opportunity tracking       | Tracker and job records                                                                                    | Canonical opportunity source, independent liveness/legitimacy, revisioned application pipeline                                   | Substantially present; Workbench has stronger audit and correction semantics.                                                                                                                           |
| Fit evaluation             | Skills, gaps, level, compensation, personalization, interview, legitimacy, and work-authorization analysis | Versioned rubric, evidence decisions, deterministic totals, DSH evaluation operation                                             | Partial. Real DSH results render in the browser, but starting them still requires an external DSH conversation. Local demonstrations cannot satisfy fit/comparison readiness.                           |
| Résumé/CV output           | Tailored CV, PDF/LaTeX production, ATS-oriented checks                                                     | Evidence-backed staged CV Markdown artifact with provenance and sealing                                                          | Partial. No editing, evidence selection, ATS analysis, PDF, or LaTeX output.                                                                                                                            |
| Other application material | Cover letter and related application material                                                              | Cover-letter, outreach, and interview-prep Markdown drafts                                                                       | Partial. Drafts are template-like, not selectively tailored, and need a stronger review workflow.                                                                                                       |
| Interview workflow         | Preparation, practice, question support, and debrief-oriented commands                                     | One interview-preparation artifact type                                                                                          | Mostly missing.                                                                                                                                                                                         |
| Offer and negotiation      | Offer comparison and negotiation support                                                                   | No dedicated offer/negotiation surface                                                                                           | Missing.                                                                                                                                                                                                |
| Replies and follow-ups     | Reply/follow-up assistance and contact research                                                            | Local outreach draft and application notes                                                                                       | Mostly missing. Sending remains intentionally prohibited.                                                                                                                                               |
| Funnel analytics           | Search/application funnel reporting                                                                        | Summary counts, bounded search, export, and raw activity                                                                         | Missing decision-oriented funnel analytics.                                                                                                                                                             |
| Localization               | Multilingual modes/content support                                                                         | Locale stored; UI is English                                                                                                     | Missing.                                                                                                                                                                                                |
| Application autofill       | Browser-assisted autofill workflow                                                                         | None                                                                                                                             | Intentional exclusion for v0.1's no-consequential-external-action boundary.                                                                                                                             |
| Runtime/provider model     | Skills, plugins, providers, and terminal/web interfaces, including direct or nested execution paths        | DSH-only model authority, native children, native RLM, browser client, SQLite backend                                            | Intentional architectural difference. Workbench must not copy Career Ops workers, provider clients, or nested agent execution.                                                                          |

## Career Workbench capabilities not supplied by Career Ops parity

- source-bound candidate evidence with explicit confirmation outcomes;
- deterministic revisioned scoring and correction-driven staleness;
- canonical SQLite state and immutable content-addressed artifacts;
- ordered resumable activity, stable operation identity, and visible lineage;
- native continuable DSH children and selective persistent RLM computation;
- read-only, previewed, idempotent Career Ops migration with original-byte
  preservation; and
- a hard prohibition on submitting applications, sending messages, purchasing,
  or taking other consequential external actions.

## Release-impact priorities

P0 for the promised Workbench workflow:

1. Expose a real DSH-backed conversational/evaluation surface in the product;
   the three-role browser journey currently stops at an external handoff.
2. Connect browser cancellation intent to the owning DSH runtime and add clear
   retry/resume actions for indeterminate work.
3. Add an in-product DSH connection/owning-session surface. Exact application
   transitions can now be requested and approved in the browser, but execution
   still requires returning to the originating DSH conversation.
4. Completed for résumé intake: the page now starts one DSH-owned organizer
   turn, shows progress, and advances only after its canonical terminal. A
   general conversation/session surface remains outside this bounded flow.

P1 parity opportunities:

1. Expand the editable target/preferences rubric beyond the current skills and
   preferences dimensions, and make comparison roles/scenarios user-selectable.
2. Add selective, editable, diffable document drafting plus ATS/PDF output.
3. Add interview, offer/negotiation, and funnel-analysis workflows.
4. Add decision-oriented pipeline/funnel analytics and stale-result recovery.

The first three-person independent usability study remains external and unmet;
no participant or result is inferred in this review.
