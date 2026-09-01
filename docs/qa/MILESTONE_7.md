# Milestone 7 evidence

Status: **partial.** The implemented day-to-day human-controlled loop lets users
inspect and update independent opportunity liveness and legitimacy signals,
manage revision-checked application state, generate evidence-bound drafts,
inspect provenance, mark immutable drafts reviewed, search canonical records,
download a credential-free export, request cancellation, correct facts, and
recover every committed view after restart.

The loop now also includes an editable canonical search profile and a distinct
DSH-populated discovery inbox. Exact external listing sources remain untrusted
leads until the user shortlists or dismisses them; shortlisting atomically
promotes the same source into a canonical opportunity.

The exit is not complete: draft content cannot yet be edited or selectively
regenerated, and browser cancellation intent is not dispatched to the owning
DSH/RLM runtime. Those gaps are reported rather than hidden by the passing
deterministic workflow tests.

## Product behavior

- Application transitions use the closed domain state machine and expected
  entity revisions. The UI labels `applied` as a record of an action completed
  elsewhere; no route submits, sends, accepts, rejects, or withdraws externally.
- Pipeline cards show entity/state revisions, effective date, deterministic next
  action, local notes, and ordered transition history.
- Posting liveness and legitimacy confidence are separate revision-checked
  fields. Neither is inferred from the other.
- CV, cover-letter, outreach, and interview-preparation drafts require current
  verified facts plus accepted candidate evidence for every fact. Generated
  Markdown identifies each fact/evidence source, labels style text
  `[NON-FACTUAL STYLE]`, starts staged, and becomes sealed only after explicit
  human review.
- Corrections stale drafts that bind the superseded fact without touching
  unrelated reviewed drafts. Regeneration creates a new immutable artifact.
- Search is a bounded backend query over canonical records. JSON export contains
  normalized entities, ordered events, schema/digest manifests, and no raw
  source text/locator or sealed source bytes by default. Users can explicitly
  select immutable artifacts for a byte/digest-bearing export.
- Browser cancellation records durable user intent. It does not claim terminal
  cancellation until the owning DSH runtime settles the operation.
- Discovery keeps at most five cards on one page, exposes explicit state tabs
  and pagination, rejects byte-identical duplicate URLs, preserves changed
  posting versions across later runs, lets the user reconsider dismissals, and
  prevents DSH from making shortlist decisions.

## Executed evidence

```text
pnpm exec vitest run tests/integration/product-workflow.integration.test.ts
Test Files  1 passed (1)
Tests       2 passed (2)

pnpm test:e2e
chromium: 2 passed (42.9s)
axe: no serious or critical violations on eleven primary routes
```

The real API/SQLite/filesystem test covers signal separation, application
transition races, staged draft creation, accepted-evidence rejection, Markdown
render/parse invariants, restart before review, explicit review, bounded search,
fact correction, affected-only staleness, and source-text/locator export
scrubbing. The browser journey covers capture through reviewed draft, provenance
inspection, pipeline transitions, correction/staleness, search, download,
cancellation intent, restart recovery, responsive navigation, keyboard
operation, saved search criteria, a nine-lead paginated discovery inbox, and
lead dismissal/reconsideration and a mobile Discover layout.

Visual evidence: `docs/qa/generated/milestone-7/reviewed-draft-provenance.png`
and `docs/qa/generated/milestone-7/discovery-inbox.png`. All data is synthetic.
