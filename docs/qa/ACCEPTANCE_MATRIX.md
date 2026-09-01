# Acceptance matrix

This matrix maps `SPEC.md` section 19 and every milestone exit to executable
evidence. `implemented` is not a pass: a row becomes `pass` only after its
relevant automated and real gates succeed. Environment- or human-dependent rows
remain `unmet` until real evidence exists.

| SPEC criterion                                     | Status | Primary evidence                                                     |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| 1. Safe local workspace                            | pass   | workspace safety/security tests; SQLite/filesystem integrations      |
| 2. Candidate source and confirmed facts            | pass   | deterministic workflow, API, and browser tests                       |
| 3. Three synthetic opportunities                   | pass   | comparison/RLM integrations and browser fixtures                     |
| 4. Real DSH Agent evaluation                       | pass   | authenticated live run, durable state, and Activity UI evidence      |
| 5. Evidence, gaps, scores, totals in UI            | pass   | Playwright journey, accessibility scan, visual evidence              |
| 6. Native continuable child                        | pass   | native-child integration and authenticated live DSH composition      |
| 7. Admission distinct from completion              | pass   | lifecycle contract/integration and Activity UI                       |
| 8. Same-child follow-up/report                     | pass   | cold-continuation integration and authenticated live follow-up       |
| 9. Persistent IPython comparison                   | pass   | real Jupyter integration and authenticated live no-replay restore    |
| 10. Result outside Python                          | pass   | accepted SQLite comparison after RLM disposal                        |
| 11. Backend/DSH restart without replay/duplication | pass   | restart integrations and authenticated live durability proof         |
| 12. Correction marks dependencies stale            | pass   | domain/API/Playwright correction journeys                            |
| 13. Cancel and fence late results                  | pass   | native child/RLM cancellation, live settlement, and security tests   |
| 14. Pinned Career Ops preview/import               | pass   | byte-identity/import/idempotency integration                         |
| 15. Credential-free export                         | pass   | export normalization and security scans                              |
| 16. All applicable gates                           | unmet  | product-team and three-person independent usability evidence remains |

| Milestone | Exit status | Evidence / remaining action                                                                       |
| --------- | ----------- | ------------------------------------------------------------------------------------------------- |
| 0         | pass        | frozen monorepo, schemas, pins, provenance, hygiene, CI definition                                |
| 1         | pass        | complete real SQLite/filesystem vertical and restart                                              |
| 2         | partial     | automated API/browser, SSE, CSRF, axe, and visual QA pass; first-time-human confirmation is unmet |
| 3         | pass        | authenticated ordinary DSH route persisted backend state and appeared in the Activity UI          |
| 4         | pass        | public continuation lifecycle/deletion and authenticated child/follow-up/cancel route pass        |
| 5         | pass        | real Jupyter and authenticated `41` → restore → `42` no-replay route pass                         |
| 6         | pass        | pinned read-only preview/import and source-byte proof                                             |
| 7         | pass        | complete browser pipeline, reviewed artifacts, search/export/recovery                             |
| 8         | unmet       | coordinate one product-team and three independent consenting sessions                             |
| 9         | unmet       | hosted Windows/Ubuntu/macOS gates pass; obtain Milestone 8 human evidence                         |

The detailed per-milestone records are `docs/qa/MILESTONE_2.md` through
`docs/qa/MILESTONE_9.md`; Milestones 0–1 are covered by the repository-wide
contract, provenance, storage, and deterministic integration gates.

The scrubbed authenticated record is `docs/qa/generated/live-acceptance.json`;
its real-browser Activity evidence is `docs/qa/generated/live-activity.png`.
