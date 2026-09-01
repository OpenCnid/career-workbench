# Milestone 5 evidence

Milestone 5 integrates the pinned native RLM bundle without adding another Agent
loop. A live DSH Agent admits one comparison operation, owns one lazy Jupyter
kernel through public `ctx.rlm`, loads exactly three current evaluation
projections, computes bounded sensitivity scenarios, and submits a structured
proposal. Career Workbench recomputes every score and requires a separate
browser acceptance before the comparison becomes canonical accepted state.

## Product behavior

- The exact originating live Agent owns model, reasoning, cancellation, session,
  and RLM authority. The plugin retains that object and never reads
  continuation-manager private fields.
- Python state is working state only. The native provider snapshots by digest,
  restarts the kernel process, restores variables without replaying historical
  cells, and cleans up the process before the accepted SQLite comparison is
  queried again.
- Operation activity records bounded cell, bridge, snapshot, restore,
  interruption, and restart phases without code, environment values, Python
  paths, connection keys, or snapshot paths.
- The browser shows scenario rankings, revision binding, proposed/accepted/stale
  state, explicit acceptance, and a prominent warning that IPython has OS
  authority and is not sandboxed.
- With no `ctx.rlm` service, no RLM tool is registered; ordinary DSH evaluation
  remains supported and diagnostics report RLM unavailable.

## Executed evidence

```text
pnpm exec vitest run tests/integration/rlm-comparison.integration.test.ts --project integration
Test Files  1 passed (1)
Tests       1 passed (1)

pnpm test:e2e
chromium: 2 passed (12.3s)
axe: no serious or critical violations on seven primary routes

# Exact deepseek-rlm 0e9f030300f9e5b37b76cdcd3d39bc490a251e79
pnpm format && pnpm lint && pnpm typecheck && pnpm test
Test Files  9 passed (9)
Tests       21 passed (21)

# The upstream Windows script omitted the `--` command separator and failed
# after installing successfully. The unchanged test selection was rerun as:
uv run --project python/dsh-rlm-runtime --with-editable vendor/prime-agent-runtime --with pytest -- python -m pytest -q ...
62 passed, 2 deselected

pnpm provenance && pnpm verify:patches && pnpm package:check
provenance ok; 4 patches ok; 5 packages and bundle closure ok

pnpm test:integration
Test Files  3 passed (3)
Tests       11 passed (11)

pnpm build && pnpm test:e2e
Test Files  1 passed (1)
Tests       5 passed (5)
```

The product integration proves `x = 41`, a later `x + 1` result of `42`, Python
construction of two sensitivity scenarios, explicit snapshot, kernel restart,
restore of both `x` and the structured proposal, deterministic server
recomputation, explicit browser acceptance, provider disposal, and durable
accepted state after Python exits. Native upstream integration additionally
covers HMAC loopback transport, malformed frames, nested tools through the
originating Agent, cold DSH session reconstruction, interrupt and lazy restart,
output and snapshot limits, no-replay side effects, generation fencing,
connection-file removal, and active-process disposal.

Visual evidence: `docs/qa/generated/milestone-5/comparison-accepted.png`. The
authenticated 2026-09-01 route additionally executed `x = 41`, restarted the
kernel, restored without replay, obtained `x + 1 == 42`, accepted the product
comparison, disposed Python, restarted the backend, and re-read the durable
result. Its scrubbed record is `docs/qa/generated/live-acceptance.json`. All
retained data is synthetic.
