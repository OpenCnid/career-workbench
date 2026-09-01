# Career Workbench 0.1.0-preview.0 release notes

This source preview implements the deterministic SQLite/filesystem career
workflow, protected browser UI, native DSH tools, continuable child lifecycle,
selective native RLM/Jupyter comparison, editable search direction, safe DSH job
discovery with a source-preserved triage inbox, Career Ops import, pipeline,
reviewed drafts, correction/staleness, search, export, and recovery. It is not
published, deployed, announced, or a consequential-action system.

Supported upstreams are Career Ops `3a067ee580b7982cf5dd6edf7895112e4e99600b`
(1.31.0), DSH `dd6322d604e00eec1ba5e0c8541159906a21094a` (`dsh-v0.1.2-alpha.3`)
with four recorded seam/lifecycle patches, native RLM
`0e9f030300f9e5b37b76cdcd3d39bc490a251e79` (0.1.0-preview.0), Cordis 4.0.2, Node
24.19.0, pnpm 11.24.0, and TypeScript 6.0.3. Wider versions are unsupported and
fail readiness. Three reproducible pnpm package adaptations apply the verified
session, continuable-deletion, and pi-ai Agent-cleanup seams to the installed
DSH packages.

Security limitations: the backend and IPython have OS authority; IPython is not
a sandbox; external content is untrusted; credentials remain with their owning
runtime; the local service token is sensitive; exports contain career data; and
human evidence decisions can be wrong. No v0.1 path performs external sends or
submissions. Job discovery requires a research capability supplied by the owning
DSH runtime; no browser or built-in board scraper bypasses DSH.

Release blockers remain visible until evidence changes:

- current Windows, Ubuntu, and macOS hosted matrix for this delta;
- packaged native SQLite/browser launch after the required local C++ toolchain
  is available;
- qualitative product-team rehearsal: not conducted;
- independent first-time participants: 0/3.

The authenticated live acceptance passed on 2026-09-01 through DSH's
`openai-codex/gpt-5.6-sol` provider at reasoning `high`, including ordinary
orchestration, native child/follow-up/cancel/delete, real Jupyter no-replay
restore (`41` to `42`), durable comparison acceptance, in-process server and
Cordis reconstruction, a real Chromium Activity view, and port/process cleanup.
Separate backend and DSH OS-process restart remains unexecuted. Only scrubbed
synthetic evidence is retained.

An earlier committed revision passed the hosted Windows, Ubuntu, and macOS
matrix. The current uncommitted 13-package delta has not; no cross-platform
result is inferred from that older run. `docs/qa/MILESTONE_9.md` is the
authoritative executed-gate record.
