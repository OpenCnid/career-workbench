# Milestone 3 evidence

Status: **complete.** Automated composition and the authenticated live OAuth
route pass on Windows with synthetic data.

Implemented behavior:

- installable native Cordis plugin with five closed-schema DSH tools and ordered
  system-prompt guidance;
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

Primary automated evidence is
`tests/integration/dsh-plugin.integration.test.ts`. It boots the published
Cordis `Context`, `SystemPrompt`, and `ToolRuntime`, composes the HTTP service
and package plugin, and uses a real TCP Fastify server with real
SQLite/filesystem storage. It verifies schema exposure, prompt guidance, policy
denial before mutation, unsupported model and reasoning failures, pre-dispatch
cancellation, bounded context, exact-Agent rejection, browser and wrong-session
rejection, persisted evidence, deterministic completion, `concludesTurn`, plugin
unload and reload, backend restart, and post-restart reconciliation.

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

The authenticated route ran on 2026-09-01 through DSH-owned credentials with
`openai-codex/gpt-5.6-sol` and reasoning `high`. It verified a real tool call,
durable backend evaluation activity, exact unsupported-option failures, and the
trusted terminal in a real Chromium Activity view. Scrubbed evidence is
`docs/qa/generated/live-acceptance.json` and
`docs/qa/generated/live-activity.png`; no credential or provider payload is
retained.
