# Milestone 3 evidence

Status: **partial.** All 20 native core tools compose and the corrected
authenticated ordinary-evaluation route passes. The browser still lacks a
DSH-backed conversation, and the expanded tool surface has not all been
exercised by the real authenticated Agent; those gaps prevent a complete claim.

Implemented behavior:

- installable native Cordis plugin with 20 closed-schema core tools plus
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

The corrected 2026-09-01 OAuth route used DSH-owned credentials with
`openai-codex/gpt-5.6-sol` and reasoning `high`. The Agent itself executed the
exact start → propose → decide → complete tool chain; new evidence was accepted,
the evaluation reached its trusted terminal, both survived in-process server
reconstruction, and no queued/running operation leaked. Separate backend and DSH
OS-process restart remains unexecuted. Scrubbed evidence is
`docs/qa/generated/live-acceptance.json` with browser evidence at
`docs/qa/generated/live-activity.png`. No credential or provider payload is
retained.
