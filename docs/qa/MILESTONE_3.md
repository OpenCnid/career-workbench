# Milestone 3 evidence

Status: **partial.** All 23 native core tools compose and the corrected
authenticated ordinary-evaluation route passes. The browser still lacks a
DSH-backed conversation, and the expanded tool surface has not all been
exercised by the real authenticated Agent; those gaps prevent a complete claim.

Implemented behavior:

- installable native Cordis plugin with 23 closed-schema core tools plus
  capability-gated native child/RLM tools and ordered system-prompt guidance;
- loopback-only HTTP service provider backed by the canonical Fastify,
  application, SQLite, and artifact services;
- separate browser and DSH mutation authorities with constant-time service-token
  validation and authenticated session/operation correlation;
- exact provider/model/reasoning allowlists with no silent substitution;
- exact originating in-process Agent ownership for a running operation;
- bounded workspace/source context, duplicate-key rejection, explicit response
  projection, and no raw provider payloads or credentials;
- audited admission and start, proposed/decided evidence, deterministic
  evaluation, and a trusted terminal that alone concludes the Agent turn;
- browser-visible ordinary-DSH route, state, and terminal message.
- authenticated search-profile discovery admission, source-preserved lead
  ingestion, trusted terminal settlement, and user-only lead promotion.
- bounded candidate-source organization admission, exact-locator profile-fact
  proposals, trusted terminal settlement, and user-only grouped or individual
  confirmation. A browser request cannot impersonate the Agent proposal route;
- same-page résumé organization through the published DSH Agent loop and
  credential owner. The browser starts the bounded intent, sees progress, and
  receives only the canonical operation/result identities after the exact DSH
  model route reaches its trusted terminal. The organizer uses an explicit
  low-reasoning route and batches at most 12 source-linked proposals into one
  serial DSH tool step. User cancellation and an eight-minute provider deadline
  have distinct terminal messages; a deadline gets one bounded trusted-terminal
  recovery attempt. No prompt-copy handoff remains.

Primary automated evidence is
`tests/integration/dsh-plugin.integration.test.ts`. It boots the published
Cordis `Context`, `SystemPrompt`, and `ToolRuntime`, composes the HTTP service
and package plugin, and uses a real TCP Fastify server with real
SQLite/filesystem storage. It verifies schema exposure, prompt guidance, policy
denial before mutation, unsupported model and reasoning failures, pre-dispatch
cancellation, bounded context, exact-Agent rejection, browser and wrong-session
rejection, persisted evidence, deterministic completion, `concludesTurn`, plugin
unload and reload, in-process server recreation, and post-recreation
reconciliation.

Exact compatibility:

| Component                              | Resolved version                           |
| -------------------------------------- | ------------------------------------------ |
| DeepSeek Harness source                | `dd6322d604e00eec1ba5e0c8541159906a21094a` |
| DSH packages                           | `0.1.2-alpha.3`                            |
| Cordis                                 | `4.0.2`                                    |
| `dsh-attachment` declaration companion | `0.1.2-alpha.3`                            |

No upstream source file is copied or adapted in this package. Public contracts
were inspected at the pinned revision. The package contains no provider client,
Agent loop, continuation-manager field access, Prime integration, nested agent
CLI launch, or Python implementation.

The corrected 2026-09-02 OAuth route used DSH-owned credentials with
`openai-codex/gpt-5.6-sol`: reasoning `high` for the ordinary orchestration and
reasoning `low` for bounded same-page résumé organization. The ordinary Agent
executed the exact start → propose → decide → complete tool chain; new evidence
was accepted, the evaluation reached its trusted terminal, both survived
in-process server reconstruction, and no queued/running operation leaked. The
same acceptance run persisted source-bound résumé proposals and verified its
exact low-reasoning route. Separate backend and DSH OS-process restart remains
unexecuted. Scrubbed evidence is `docs/qa/generated/live-acceptance.json` with
browser evidence at `docs/qa/generated/live-activity.png`. No credential or
provider payload is retained.
