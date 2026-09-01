# Milestone 8 evidence

Status: **partially complete; independent human evidence is unmet.**

The executable study package fixes three conditions, eight tasks, eight
observable states, consent-safe retained records, preregistered thresholds,
per-condition reducers, and a report renderer. Closed validation excludes names,
contacts, paths, free-form notes, and recordings. Automated tests prove that
empty or product-team-only samples cannot pass independent-user gates and that
negative safety outcomes remain visible.

Public synthetic material is in
`packages/evals/fixtures/ambiguous-opportunities/`. Evaluator-only expected
observations are physically separated under
`packages/evals/fixtures/private-truth/` and must never enter model-visible
input. The preregistration, session script, consent/recording procedure, finding
codebook, and report template are under `packages/evals/protocols/`.

No participant or product-team session has been claimed. Current independent
sample: **0/3**. Satisfying the remaining exit criteria requires the user to
coordinate one product-team rehearsal and at least three consenting first-time
humans who did not implement the system. Their outcomes must be validated and
reduced without editing out failures.
