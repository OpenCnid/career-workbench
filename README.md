# Career Workbench

Career Workbench is a local-first, evidence-based career intelligence and
application operations product. Deterministic TypeScript code owns career facts,
evidence admission, state transitions, rubric arithmetic, SQLite state, and
sealed artifacts. DeepSeek Harness is the sole model harness and remains an
optional outer capability; the deterministic core has no provider dependency.

## Status

The preview implements Milestones 0–7 and the safe engineering work for
Milestones 8–9: deterministic SQLite/filesystem state, the protected browser
workbench, native Cordis/DSH tools and continuable children, persistent native
RLM/Jupyter comparison with no-replay restore, read-only Career Ops import, the
application/review workflow, release packages, SBOM, checksums, backup/restore,
and a passing hosted Windows/Ubuntu/macOS clean-install and full-check matrix.
The independent three-person qualitative study remains an explicit unmet
external gate. The authenticated DSH ordinary/child/RLM acceptance profile has
passed on Windows with scrubbed evidence retained. See
`docs/qa/ACCEPTANCE_MATRIX.md`.

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
