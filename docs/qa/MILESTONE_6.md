# Milestone 6 evidence

Milestone 6 provides a read-only Career Ops import workflow against revision
`3a067ee580b7982cf5dd6edf7895112e4e99600b` (observed version `1.31.0`). The
server discovers a bounded allowlist, creates a complete mapping preview, keeps
the executable plan server-side, and requires explicit confirmation of the exact
source fingerprint. Apply re-reads the directory and fails on any changed
selected byte.

## Product behavior

- Supported inputs are `config/profile.yml`, `cv.md`, the preferred
  `data/applications.md` (or legacy root tracker), report Markdown, bounded job
  description Markdown, the story bank, and explicit profile/custom preference
  files.
- Scripts, skills/prompts, provider credentials, environment files, browser
  profiles/cookies, package dependencies/workers, and Recursus state are never
  selected or executed.
- Header-aware English/Spanish tracker columns and pinned English, Spanish, and
  Turkish status aliases map to Workbench application states. Unknown and
  duplicate rows remain visible warnings rather than guessed records.
- Source bytes are sealed content-addressably before one SQLite transaction
  creates sources, proposed profile facts, opportunities, applications,
  original-label mappings, and the import manifest. Immutable unreferenced bytes
  are harmless if the transaction fails.
- Imported profile values remain `proposed`; story claims retain their original
  provenance label and never become accepted candidate evidence automatically.
- Re-importing an identical source identity/fingerprint returns the existing
  manifest without duplicate state or events. A modified tree is reported as a
  changed source and requires a fresh preview.
- Every supported mapping can be selected independently in preview. Confirmed
  receipts retain and display imported and skipped dispositions; selection never
  changes the preserved source bytes.

## Executed evidence

```text
pnpm exec vitest run packages/career-ops-import/tests/career-ops-import.unit.test.ts tests/integration/career-ops-import.integration.test.ts
Test Files  2 passed (2)
Tests       7 passed (7)

pnpm test:e2e
chromium: 2 passed (17.0s)
axe: no serious or critical violations on eight primary routes
```

The integration test verifies real SQLite/file-system persistence, exact source
byte identity, one confirmed import, identical re-import idempotency, restart,
and source-change rejection. Unit coverage includes the pristine pinned fixture,
missing/partial input, corrupt YAML, customized and multilingual headers/data,
duplicate rows, unknown status, Unicode identity, explicit unsupported inputs,
and changed-source detection.

The five retained fixture files are byte-identical to Career Ops
`test-fixtures/upgrade/state-v1.18`; their SHA-256 values and MIT provenance are
checked by `provenance/career-ops-fixture-files.json`.

Visual evidence: `docs/qa/generated/milestone-6/career-ops-imported.png`. All
retained fixture and visual data is synthetic.
