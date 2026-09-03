# Career Workbench

Career Workbench is a local-first, evidence-based career intelligence and
application operations product. Deterministic TypeScript code owns career facts,
evidence admission, state transitions, rubric arithmetic, SQLite state, and
sealed artifacts. DeepSeek Harness is the sole model harness and remains an
optional outer capability; the deterministic core has no provider dependency.

The primary product journey is:

1. create one private local workbench;
2. add résumé/CV or structured career history and confirm source-backed facts;
3. save editable role, location, compensation, AI-focus, priority, and exclusion
   criteria;
4. choose **Find jobs** to let the configured DSH Agent discover current
   listings into a deduplicated, source-preserved review inbox;
5. shortlist or dismiss each lead yourself, evaluate the roles worth deeper
   work, and explicitly compare your finalists; and
6. prepare reviewed materials and track the application without any automatic
   submission or messaging.

The browser never calls an LLM provider or authorizes a discovered listing as an
opportunity. DSH discovery needs a configured research capability; without one,
users can still capture opportunities manually.

## Status

This repository is an engineering preview, not a completed v0.1 release.
Substantial deterministic, DSH, child, RLM/Jupyter, import, browser, packaging,
and recovery behavior exists, but the Definition of Done remains open. In
particular, evaluation still uses a copyable DSH handoff rather than an embedded
DSH conversation, browser cancellation intent is not yet dispatched to the
owning runtime, application transition execution still depends on the exact
originating DSH conversation, and the independent three-person qualitative study
has not happened. Comparison and artifact approvals are completed in the
browser. Local evidence demonstrations are explicitly excluded from fit and
comparison readiness; only DSH semantic evaluations count. The exact current
pass/partial/unmet record is maintained in `docs/qa/ACCEPTANCE_MATRIX.md`; no
milestone is considered complete merely because a fixture or earlier candidate
passed.

## Development

Requirements: Node.js 24.19.0 and pnpm 11.24.0.

```sh
pnpm install --frozen-lockfile
pnpm check
```

Focused gates:

```sh
pnpm test:unit
pnpm test:property
pnpm test:contract
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm release:prepare
pnpm check:release
pnpm check:isolated
```

For the explicitly authorized live profile, first store OAuth through DSH's own
authorization runtime, then run the acceptance route. Neither command prints or
copies credential contents:

```sh
pnpm dsh:authorize
pnpm test:live
```

Exact upstream compatibility is in
[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Workspace and IPython authority
are documented in [docs/SECURITY.md](docs/SECURITY.md). IPython is OS-authority
execution, not a sandbox. No v0.1 path submits an application or sends an
external message.
