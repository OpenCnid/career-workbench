# Search and discovery workflow evidence

Implemented on 2026-09-01 as a safe, non-consequential extension allowed by
`SPEC.md` §15.6. The canonical flow is search profile → DSH discovery operation
→ untrusted discovery leads → explicit user triage → canonical opportunity.

## Product behavior

- `SearchProfile` stores target roles, seniority, locations, work arrangements,
  optional compensation, AI focus, priorities, exclusions, active state, and
  optimistic revision.
- `DiscoveryLead` is distinct from `Opportunity`. It preserves the exact
  external posting source and digest, normalized URL, discovery operation, match
  reasons, gaps, and risks.
- Tracking parameters are removed for deduplication. URL user information and
  credential-like query parameters are rejected. A database uniqueness fence
  prevents a duplicate normalized URL even when requests race.
- Every operation and lead records the exact search-profile revision and digest.
  Editing or pausing that profile, or requesting cancellation, fences later
  writes from the old operation.
- One operation accepts at most 64 leads, 20 from one host, and 8 MiB of source
  text. A workspace accepts at most 512 discovery leads and 32 MiB of discovery
  source text before the user must triage and retain a bounded result set.
- Only the exact originating DSH Agent/session can start and populate a running
  discovery operation. Browser forgery fails.
- DSH cannot shortlist. A same-origin user decision atomically updates the lead
  and creates or reuses the canonical opportunity with the same immutable source
  identity and digest.
- A dismissed lead can be returned to the inbox with a revision-checked user
  action. A changed posting at the same normalized URL can supersede its source
  only in a later discovery run and only before the lead is shortlisted; equal
  bytes remain a duplicate.
- The Discover page puts a non-empty inbox first, shows newest leads first,
  exposes preserved source/run provenance, accepts an optional decision note,
  warns about unsaved criteria, and keeps at most five leads on a page.
- Discovery never applies, sends messages, contacts an employer, or performs a
  consequential external action.

## Automated evidence

- `tests/integration/discovery-flow.integration.test.ts`: real Fastify,
  SQLite/WAL, filesystem, CSRF, authenticated DSH session/operation, source
  preservation, unsafe-URL rejection, credential-free export, input-revision and
  cancellation fencing, normalized-URL deduplication, DSH triage denial, browser
  shortlist, atomic opportunity promotion, terminal operation, and restart.
- `tests/integration/dsh-plugin.integration.test.ts`: real Cordis tool runtime,
  TCP provider, start/record/complete discovery tools, exact Agent ownership,
  and persisted terminal/lead.
- `tests/browser/workbench.spec.ts`: saved criteria, DSH-populated nine-lead
  inbox, page 1/page 2 navigation, dismissal, state tabs, Chromium visual
  evidence, and axe scan for `/discover`.
- Visual evidence: `docs/qa/generated/milestone-7/discovery-inbox.png`.

## Remaining boundary

Career Workbench contains no job-board provider client. Automatic research
depends on a real research capability explicitly configured in the owning DSH
runtime. The browser handoff is copyable rather than an embedded DSH
conversation. These limitations are visible in the page and installation docs;
neither is represented as complete provider coverage.
