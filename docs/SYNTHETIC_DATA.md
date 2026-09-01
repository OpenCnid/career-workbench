# Synthetic-data policy

Tests, examples, screenshots, recordings, exports, and retained QA evidence use
only invented people, organizations, roles, URLs, contact details, and career
claims. Reserved example domains and the `555-01xx` fictional telephone range
are used where those fields are required.

Never copy production workspaces, browser profiles, DSH stores, environment
values, provider payloads, credentials, cookies, Jupyter connection data, or
real resumes into this repository. Evaluator-only truth stays under
`packages/evals/fixtures/private-truth/` and is never projected to a model.

The `check:hygiene` gate scans retained text for secret-like values, prohibited
credential fields, non-example contact domains, and machine-specific paths.
Failures must be scrubbed at the source; do not allowlist personal data.

`tests/fixtures/career-ops-v1.18` is the upstream Career Ops synthetic upgrade
fixture at the pinned revision. Its reserved `example.test` identities and
invented organizations are safe for retained interoperability evidence. The five
selected files are byte-identity checked from
`provenance/career-ops-fixture-files.json`.
