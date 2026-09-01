# Career Workbench Milestones

Status: proposed implementation sequence for `SPEC.md` Draft v0.1

The milestones deliver one coherent product through small vertical behaviors.
Each milestone must leave the repository buildable, testable, and honest about
what is not yet available. A later milestone may extend a contract but may not
silently weaken an earlier safety or ownership boundary.

## Delivery rules

For every milestone:

1. implement the smallest complete behavior;
2. add focused unit and contract tests;
3. add at least one real integration test for every external boundary changed;
4. run formatting, lint, type checking, tests, and package/build inspection;
5. fix failures before advancing;
6. update user documentation and compatibility records with behavior; and
7. preserve exact evidence for claims without retaining credentials or personal
   data.

No milestone may:

- create a second agent loop;
- call an LLM provider outside DSH;
- make Python the durable domain store;
- describe IPython as a sandbox;
- silently ignore an unsupported option;
- automate application submission or message sending; or
- claim success from assistant prose without verified domain state.

## Milestone map

| Milestone                        | Outcome                                                            | Depends on           |
| -------------------------------- | ------------------------------------------------------------------ | -------------------- |
| 0. Repository and contracts      | Reproducible project skeleton and frozen initial boundaries        | none                 |
| 1. Deterministic domain slice    | Profile, opportunity, evidence, evaluation, and SQLite persistence | 0                    |
| 2. Browser workbench slice       | Complete no-agent workflow through the web UI                      | 1                    |
| 3. Native DSH plugin             | One DSH Agent operates the deterministic backend                   | 1; integrates with 2 |
| 4. Native delegated research     | Continuable children produce explicit, inspectable evidence        | 3                    |
| 5. Selective RLM                 | Persistent IPython supports one useful workflow without owning it  | 3, 4                 |
| 6. Career Ops import             | Pinned upstream data imports through preview and confirmation      | 1, 2                 |
| 7. Product workflow expansion    | Comparison, applications, artifacts, and corrections form one loop | 2–6                  |
| 8. Qualitative evaluation        | Human comparison isolates backend, UI, DSH, and RLM value          | 7                    |
| 9. Hardening and preview release | Clean install, cross-platform evidence, security, and packaging    | 8                    |

## Milestone 0 — Repository and contracts

### Objective

Turn the initial documents into a reproducible monorepo with explicit
compatibility, licensing, development, and test boundaries.

### Deliverables

- Workspace/tooling bootstrap with pinned Node and package-manager versions.
- Root scripts for format, lint, typecheck, unit tests, integration tests,
  package inspection, and the complete check gate.
- Initial directory structure from `ARCHITECTURE.md`.
- `AGENTS.md` with repository invariants and scoped instructions where needed.
- Versioned JSON schemas or equivalent source definitions for public errors,
  identifiers, commands, queries, and events.
- Compatibility manifest pinning:
  - Career Ops `3a067ee580b7982cf5dd6edf7895112e4e99600b`;
  - DSH `dd6322d604e00eec1ba5e0c8541159906a21094a` plus required seam patches;
  - deepseek-rlm `0e9f030300f9e5b37b76cdcd3d39bc490a251e79`;
  - exact runtime and package-manager versions.
- Provenance and third-party license records.
- Synthetic candidate and opportunity fixture policy.
- CI on Windows, Ubuntu, and macOS for checks that are portable at this stage.

### Tests and checks

- Schema examples validate.
- Unknown/duplicate fields fail as specified.
- License and provenance inventory is complete.
- Lockfile and clean install are reproducible.
- Repository contains no secret-like fixture values or real personal data.
- Documentation links and pinned revisions resolve.

### Exit criteria

- A clean clone installs and runs the empty-package check suite.
- Public contracts and exact pins are inspectable without reading build output.
- No code path can call a model or mutate external state.

## Milestone 1 — Deterministic domain vertical slice

### Objective

Prove that Career Workbench can persist and validate a complete evaluation
without a model, DSH, browser, or Career Ops runtime.

### Vertical behavior

```text
create workspace
  -> capture synthetic candidate source
  -> confirm profile facts
  -> capture one synthetic opportunity
  -> propose and accept fixture evidence
  -> compute rubric deterministically
  -> seal a report artifact
  -> restart and read the same result
```

### Deliverables

- Domain identifiers, entities, commands, queries, errors, and state machines.
- Candidate-fact support and four-outcome confirmation flow.
- Versioned rubric representation and integer score aggregation.
- SQLite schema, migrations, transactions, audit events, and repository ports.
- Content-addressed artifact staging and sealing.
- Correction, supersession, dependency query, and staleness.
- Workspace creation, path safety, backup, and export foundation.
- A small non-HTTP application-service façade used by tests and later adapters.

### Tests and checks

- Data-driven tests for every accepted and rejected state transition.
- Candidate-fact cases covering unsupported metrics, combined fragments,
  authorship, qualifiers, contradiction, rejection, and cannot-confirm state.
- Deterministic scoring snapshots for multiple rubrics and missing inputs.
- SQLite concurrency, rollback, migration, backup, corruption, and restart.
- Artifact size, digest, replacement, path escape, interruption, and cleanup.
- Idempotency and optimistic-concurrency races.
- Two independently created fixture workspaces produce equivalent normalized
  exports.

### Exit criteria

- The vertical behavior passes against real SQLite and filesystem adapters.
- No test needs a provider, DSH, browser, or Python.
- Rejected evidence cannot influence a completed evaluation.

## Milestone 2 — Browser workbench vertical slice

### Objective

Make the Milestone 1 workflow usable without a terminal and prove that the
browser is a client, not an authority.

### Vertical behavior

A user creates a workspace, reviews proposed profile facts, captures a job
description, runs fixture evaluation, inspects evidence and scoring, corrects a
fact, and sees the evaluation become stale.

### Deliverables

- Local application server and `/api/v1` contract.
- Same-origin and CSRF protections for local mutations.
- Ordered resumable event stream.
- Web application shell, navigation, accessibility baseline, and error states.
- Profile/evidence, opportunity, evaluation, and activity views.
- Four-outcome candidate-fact confirmation UI.
- Revision-conflict and correction/invalidation UX.
- Diagnostics view with scrubbed capability and workspace health.

### Tests and checks

- API contract tests for every command, query, and error.
- Browser tests for the complete vertical behavior.
- Cross-origin, CSRF, stale revision, duplicate submission, reconnect, and
  malformed-event cases.
- Keyboard navigation, semantic labeling, focus, reduced-motion, and contrast
  checks for critical flows.
- Server restart while a browser is connected.

### Exit criteria

- A first-time tester can complete the vertical behavior from the browser.
- Direct browser-state modification cannot authorize backend state.
- Activity, failure, staleness, and artifact readiness are visually distinct.

## Milestone 3 — Native DSH plugin

### Objective

Let one exact DSH Agent operate Career Workbench through public Cordis and tool
services while the deterministic backend remains authoritative.

### Vertical behavior

```text
user asks DSH to evaluate one captured opportunity
  -> DSH reads bounded workspace/profile/source context
  -> DSH proposes structured evidence through native tools
  -> backend validates and computes the rubric
  -> web UI shows the live operation and completed evaluation
```

RLM and native children remain disabled for this milestone so the ordinary DSH
route is a useful control.

### Deliverables

- Provider-neutral `ctx.careerWorkbench` service definition.
- Backend provider and model-facing tool consumer.
- Closed, versioned, bounded tool schemas.
- Prompt guidance that treats external content as data and domain tools as the
  only mutation path.
- DSH session/operation correlation and activity translation.
- Readiness gates and stable missing-capability failures.
- Installable plugin/bundle patch for the exact compatible DSH profile.
- Isolated pack/install/import smoke test.

### Tests and checks

- One-Agent authority and service lifecycle.
- Tool guard, approval, logging, telemetry, error, and cancellation behavior.
- Exact model/reasoning forwarding and unsupported-option failures.
- No direct provider imports, nested agent CLIs, Prime sessions, or private DSH
  fields in production packages.
- DSH restart and backend restart reconciliation.
- Real DSH composition with the RLM plugin installed but RLM disabled for the
  operation.
- Live Codex OAuth run with `openai-codex/gpt-5.6-sol` and a recorded supported
  reasoning level using synthetic data.

### Exit criteria

- The live result is a verified backend evaluation, not only assistant text.
- The browser shows DSH activity and a trusted terminal.
- The same deterministic core tests pass without DSH.

## Milestone 4 — Native delegated research

### Objective

Add useful parallel or specialist research through native continuable DSH
children without moving truth or completion into child prose.

### Vertical behavior

For one synthetic opportunity, the parent starts bounded children for fit
evidence and company/posting research, consumes explicit reports, follows up
with one child, and synthesizes only backend-accepted evidence.

### Deliverables

- Child operation projection and public lineage correlation.
- Explicit admission, start, report, message, follow-up, terminal,
  cancellation, and deletion handling.
- Parent synthesis gate that requires child terminal/report conditions defined
  by the operation.
- Browser activity tree with child status and follow-up controls.
- Depth, concurrency, timeout, and result-size configuration.

### Tests and checks

- Model inheritance from the active request and explicit supported overrides.
- Child admission denial, delayed start, partial report, timeout, malformed
  result, cancellation, deletion, and cold restore.
- Follow-up reaches the same continuable child.
- Parent cancellation propagates and late reports are fenced.
- A returned child handle is never rendered as completed work.
- Domain safety treats child evidence exactly like parent evidence.

### Exit criteria

- A user can correctly identify what is running, complete, failed, or waiting.
- One child can fail without erasing already accepted evidence.
- No compatibility code reads DSH continuation-manager private state.

## Milestone 5 — Selective RLM

### Objective

Use the existing native DSH RLM bundle for one bounded workflow where persistent
computation provides an observable benefit, while DSH remains the orchestrator.

### Vertical behavior

```text
DSH Agent opens IPython
  -> x = 41
  -> later x + 1 returns 42
  -> load three validated evaluation projections
  -> compute a sensitivity/comparison table across user preferences
  -> optionally request one supervised DSH child through the host bridge
  -> return a structured proposal
  -> persist the accepted comparison in Career Workbench
  -> snapshot, restart, restore without replay
```

### Deliverables

- RLM capability readiness and operation route selection.
- Bounded domain projections designed for Python consumption.
- Structured proposal ingestion from IPython.
- Activity representation for cells, bridge calls, child work, snapshots,
  interruption, and restore.
- Explicit documentation and UI disclosure of OS authority.
- Snapshot authorization correlation without duplicating RLM internals.

### Tests and checks

- Real persistent Jupyter state.
- HMAC-authenticated loopback transport and malformed-frame rejection.
- Empty-by-default environment and allowlist validation.
- No Python provider clients or credentials.
- Bridge model/tool/subagent calls use the originating Agent.
- Output, variable, queue, timeout, artifact, and snapshot limits.
- Cancellation, ignored interrupt, process-tree cleanup, lazy restart, and
  stale-generation fencing.
- Digest-authorized restore, corruption, orphan file, mismatch, and no cell
  replay.
- Same task with RLM unavailable remains a supported ordinary DSH route or
  returns an explicit capability error when RLM was required.

### Exit criteria

- Persistent state and the product workflow both pass real integration tests.
- Durable comparison state survives after the Python process is gone.
- The product makes no sandbox or RLM-quality claim beyond the evidence.

## Milestone 6 — Career Ops import

### Objective

Move supported user data from the pinned current Career Ops contract into
Career Workbench without importing its prompt-driven runtime architecture.

### Deliverables

- Exact compatibility profile and upstream fixture inventory.
- Read-only discovery and parsing for the initial import scope.
- Bounded intermediate representation.
- Preview with deduplication, mappings, warnings, unsupported items, and
  candidate-fact confirmation requirements.
- One idempotent import transaction and manifest.
- Browser workflow for preview, selection, confirmation, execution, and report.
- Provenance and MIT-license review for any adapted deterministic code.

### Tests and checks

- Pristine pinned upstream fixture and multiple synthetic legacy workspaces.
- Missing, partial, corrupted, customized, multilingual, and duplicate data.
- Status mapping and unresolved mappings.
- Derived story facts lacking primary provenance.
- Source workspace byte identity before and after import.
- Repeated import idempotency and changed-source detection.
- No executable skills, agents, provider config, credentials, dependencies, or
  Recursus evidence treated as product behavior.

### Exit criteria

- A supported Career Ops fixture imports through preview with no source write.
- Every skipped or ambiguous record is visible.
- Imported candidate facts meet the same evidence gate as native facts.

## Milestone 7 — Product workflow expansion

### Objective

Complete a coherent day-to-day loop around opportunity decisions and human
review without adding autonomous external actions.

### Deliverables

- Multi-opportunity comparison and sensitivity views.
- Application pipeline and canonical state-transition UI.
- Draft CV, cover-letter, outreach, and interview-preparation artifacts from
  verified facts.
- Artifact editor/review, provenance inspection, stale marking, and regeneration.
- Opportunity liveness and legitimacy evidence as separate concepts.
- Search, filtering, next-action, and workspace export.
- End-to-end cancellation, correction, and recovery across all product views.

### Tests and checks

- Full browser journeys from capture to reviewed draft.
- Generated-content factuality, authorship, metric, and qualifier gates.
- Application transition races and stale approvals.
- Artifact render/parse checks appropriate to each shipped format.
- Restart at every operation boundary.
- No send, submit, purchase, accept, reject, or withdraw external action tool.

### Exit criteria

- A user can manage the complete synthetic search without a terminal.
- Every candidate-facing sentence can be traced to accepted facts or is labeled
  as non-factual style text.
- Corrections invalidate and regenerate only affected outputs.

## Milestone 8 — Qualitative evaluation

### Objective

Determine whether Career Workbench is easier to understand and control than the
upstream terminal/skill workflow, and whether RLM adds value beyond ordinary
DSH orchestration.

### Study design

Run the same synthetic tasks under:

1. pinned upstream Career Ops;
2. Career Workbench with RLM unavailable; and
3. Career Workbench with RLM available.

Begin with the product team, then include at least three first-time users who
did not implement the system. Use think-aloud sessions without explaining DSH,
subagents, IPython, or RLM before the tasks.

### Required tasks

- onboard and confirm a synthetic profile;
- evaluate and compare three ambiguous opportunities;
- explain the evidence behind a recommendation;
- inspect and follow up with a still-running child;
- correct a seeded candidate fact;
- cancel long work;
- restart and resume; and
- choose a reviewed artifact.

### Evidence

- completion and time to first useful result;
- operator interventions and repair turns;
- factual, provenance, state, and recovery errors;
- participant predictions about current system state;
- effort, control, trust, and route preference;
- screen recordings and notes using synthetic data; and
- severity-ranked usability findings.

### Exit criteria

- First-time users complete the core flow without terminal commands.
- Participants can distinguish admitted, running, waiting, completed, failed,
  canceled, indeterminate, and stale states at agreed preregistered thresholds.
- No critical candidate-fact or external-action failure occurs.
- The report distinguishes interface/backend value, DSH orchestration value,
  and incremental RLM value.
- Failures and negative results are retained rather than edited out of the
  conclusion.

## Milestone 9 — Hardening and preview release

### Objective

Produce a reproducible private or public preview whose claims match cross-
platform, security, package, live, and usability evidence.

### Deliverables

- Final installation, upgrade, backup, restore, import, export,
  troubleshooting, security, and operating documentation.
- Signed or checksummed package inventory and software bill of materials.
- Isolated install of all packages and the DSH bundle into a clean profile.
- Database migration and rollback rehearsal.
- Windows, Ubuntu, and macOS test matrix.
- Performance/resource ceilings for representative workspaces.
- Threat-model review and scrubbed QA evidence.
- Preview version and compatibility matrix.

### Complete gates

- format, lint, typecheck, unit, property, integration, browser, security, and
  package/build checks;
- real SQLite and artifact tests;
- real DSH profile composition;
- real Jupyter lifecycle and restore;
- live Codex OAuth runs for every claimed route;
- clean process-tree and port cleanup;
- isolated Career Ops import;
- credential/personal-data scan;
- accessibility checks; and
- completed qualitative report.

### Exit criteria

- A clean machine can install, create or import a workspace, run the complete
  vertical workflow, restart, export, and uninstall using documentation.
- Every skipped gate is displayed as an unmet release criterion.
- Release notes state exact supported revisions and security limitations.
- No registry publication, deployment, or public announcement occurs without
  separate user authorization.

## Project-wide acceptance rule

Completion is an evidence claim. A milestone is complete only when its behavior
exists, its relevant automated and real tests pass, its user-facing
documentation matches, and no required work remains hidden behind a scaffold,
mock, prompt convention, or manually asserted success.
