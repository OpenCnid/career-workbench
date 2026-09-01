# Acceptance matrix

This matrix maps `SPEC.md` section 19 and every milestone exit to executable
evidence. `implemented` is not a pass: a row becomes `pass` only after its
relevant automated and real gates succeed. Environment- or human-dependent rows
remain `unmet` until real evidence exists.

| SPEC criterion                                     | Status  | Primary evidence                                                                            |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1. Safe local workspace                            | pass    | workspace safety/security tests; SQLite/filesystem integrations                             |
| 2. Candidate source and confirmed facts            | pass    | deterministic workflow, API, and browser tests                                              |
| 3. Three synthetic opportunities                   | pass    | comparison/RLM integrations and browser fixtures                                            |
| 4. Real DSH Agent evaluation                       | pass    | corrected authenticated Agent tool chain and durable terminal passed                        |
| 5. Evidence, gaps, scores, totals in UI            | pass    | Playwright journey, accessibility scan, visual evidence                                     |
| 6. Native continuable child                        | pass    | native-child integration and authenticated live DSH composition                             |
| 7. Admission distinct from completion              | pass    | lifecycle contract/integration and Activity UI                                              |
| 8. Same-child follow-up/report                     | pass    | cold-continuation integration and authenticated live follow-up                              |
| 9. Persistent IPython comparison                   | pass    | real Jupyter integration and authenticated live no-replay restore                           |
| 10. Result outside Python                          | pass    | accepted SQLite comparison after RLM disposal                                               |
| 11. Backend/DSH restart without replay/duplication | partial | in-process reconstruction passes; separate backend and DSH OS-process restart is unexecuted |
| 12. Correction marks dependencies stale            | pass    | domain/API/Playwright correction journeys                                                   |
| 13. Cancel and fence late results                  | partial | native child/RLM tests pass; browser intent lacks a runtime dispatcher                      |
| 14. Pinned Career Ops preview/import               | pass    | byte-identity/import/idempotency integration                                                |
| 15. Credential-free export                         | pass    | scrubbed normalized export plus explicit selected-artifact byte export pass                 |
| 16. All applicable gates                           | unmet   | product-team and three-person independent usability evidence remains                        |

| Milestone | Exit status | Evidence / remaining action                                                                                             |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 0         | pass        | frozen monorepo, schemas, pins, provenance, hygiene, CI definition                                                      |
| 1         | pass        | complete real SQLite/filesystem vertical and restart                                                                    |
| 2         | partial     | automated API/browser, SSE, CSRF, axe, and visual QA pass; DSH conversation and first-time-human confirmation are unmet |
| 3         | partial     | 20 native core tools pass; no embedded browser DSH conversation or complete live coverage of the expanded surface       |
| 4         | partial     | lifecycle passes; required failed-child/accepted-evidence preservation case remains unexecuted                          |
| 5         | partial     | Jupyter no-replay route passes; same comparison with RLM unavailable has no ordinary route/stable capability error      |
| 6         | pass        | pinned preview, per-mapping selection/receipt, byte preservation, confirmation, and idempotency pass                    |
| 7         | partial     | selected artifact bytes and approval gates pass; editing/selective regeneration and cancel dispatch remain open         |
| 8         | unmet       | coordinate one product-team and three independent consenting sessions                                                   |
| 9         | unmet       | current delta lacks hosted matrix/native packaged-server smoke; Milestone 8 human evidence also remains                 |

The detailed per-milestone records are `docs/qa/MILESTONE_2.md` through
`docs/qa/MILESTONE_9.md`; Milestones 0–1 are covered by the repository-wide
contract, provenance, storage, and deterministic integration gates.

The corrected authenticated record is `docs/qa/generated/live-acceptance.json`;
its Activity evidence is `docs/qa/generated/live-activity.png`. It records the
exact four-tool ordinary Agent chain, durable accepted evidence/evaluation,
child/follow-up/cancellation/deletion, RLM restore without replay, comparison
durability, no leaked nonterminal operation, and port cleanup.
