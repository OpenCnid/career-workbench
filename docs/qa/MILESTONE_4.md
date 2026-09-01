# Milestone 4 evidence

Status: **partial.** The native lifecycle below passes, but the milestone's
required regression proving that a failed child cannot erase already accepted
candidate evidence has not yet been executed.

Milestone 4 implements native DSH continuable children without a second Agent
loop. Canonical operation state distinguishes queued admission, inbox-accepted
start, selected report, assistant message, exact follow-up, cancellation
request, terminal settlement, and retention-preserving deletion audit.

## Product behavior

- The plugin calls only public `ctx.subagents` operations and retains exact live
  Agent objects for authority. No continuation-manager fields are read.
- Initial starts and cold follow-ups use one durable DSH child session. Each
  follow-up creates a linked canonical operation epoch, preventing a terminal
  operation from being reopened.
- Explicit provider/model/reasoning overrides are forwarded; inheritance uses
  native DSH behavior. Unsupported selections fail before admission.
- Depth, concurrency, start/task/report/context/response, timeout, and result
  bounds are enforced. Cancellation is nonterminal until DSH emits settlement.
- Browser follow-up controls record user intent only. The originating Agent must
  claim and deliver the exact request; browser state never gains DSH authority.
- Deletion fails with `CAPABILITY_UNAVAILABLE` and no backend mutation on the
  unpatched published package. The pinned public deletion patch is retained and
  verified byte-for-byte.

## Executed evidence

```text
pnpm exec vitest run --project integration tests/integration/native-child.integration.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)

pnpm test:e2e
chromium: 2 passed (9.2s)
axe: no serious or critical violations on six primary routes

# In a clean clone of DSH dd6322… with the four retained patches applied:
pnpm exec vitest run packages/subagent/subagent/tests/deletion.spec.ts \
  packages/subagent/subagent/tests/continuation.spec.ts \
  packages/subagent/subagent/tests/list-children.spec.ts \
  apps/cli/tests/process-shutdown.spec.ts \
  packages/llm/llm-pi-ai/tests/session-resources.spec.ts
Test Files  5 passed (5)
Tests       191 passed (191)
```

The integration uses the real published AgentLoop, JSONL session persistence,
session query/projection services, in-process spawn provider, Cordis,
ToolRuntime, SQLite backend, filesystem artifacts, and TCP Fastify server. It
verifies handle receipt before completion, selected reporting, cold resume,
exact-parent denial, explicit depth denial, unsupported override before
mutation, cancellation and terminal fencing, browser-request delivery, lineage,
and fail-loud unpatched deletion.

Visual evidence: `docs/qa/generated/milestone-4/native-child-lineage.png`. The
authenticated 2026-09-01 route additionally verified native child completion,
same-child follow-up, cancellation settlement, deletion, visible lineage, and
cleanup through `openai-codex/gpt-5.6-sol` at reasoning `high`. Its scrubbed
record and Activity screenshot are `docs/qa/generated/live-acceptance.json` and
`docs/qa/generated/live-activity.png`. All retained data is synthetic.
