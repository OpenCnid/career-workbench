# Career Workbench DSH plugin

This is the native Cordis/DeepSeek Harness adapter for Career Workbench. It
registers twenty deterministic-workflow tools, six native-child tools when the
public DSH subagent service is present, and a security-critical prompt section.
It does not contain an LLM provider, Agent loop, Python runtime, worker, or
browser mutation bypass.

Compatibility is exact: Cordis `4.0.2` and DSH `0.1.2-alpha.3` from revision
`dd6322d604e00eec1ba5e0c8541159906a21094a`. The package also declares
`@deepseek-ai/dsh-attachment` because the published `dsh-llm` declarations
reference its types without declaring the package as a dependency.

## Composition

Start the Career Workbench server with one process-owned service token:

```powershell
$env:CAREER_WORKBENCH_DSH_TOKEN = '<random value of at least 32 characters>'
pnpm --filter @career-workbench/server start
```

Install this package into the DSH plugin environment and add the provider before
the tool plugin in a DSH patch layer:

```yaml
- name: "@career-workbench/dsh-plugin/http-provider"
  config:
    baseUrl: "http://127.0.0.1:4317/"
    serviceToken: !!js process.env.CAREER_WORKBENCH_DSH_TOKEN
    supportedModels:
      - provider: "openai-codex"
        model: "gpt-5.6-sol"
        reasoningEfforts: ["high"]
- name: "@career-workbench/dsh-plugin"
```

The allowed model and reasoning pairs are an explicit deployment allowlist.
Missing or unsupported selections fail; the adapter never substitutes or
downgrades them.

## Native tools

- `career_workbench_inspect`
- `career_workbench_start_evaluation`
- `career_workbench_propose_evidence`
- `career_workbench_decide_evidence`
- `career_workbench_complete_evaluation`
- `career_workbench_capture_source`
- `career_workbench_inspect_source`
- `career_workbench_capture_opportunity`
- `career_workbench_inspect_opportunity`
- `career_workbench_inspect_evaluation`
- `career_workbench_cancel_evaluation`
- `career_workbench_record_gap`
- `career_workbench_inspect_application`
- `career_workbench_transition_application`
- `career_workbench_draft_artifact`
- `career_workbench_inspect_artifact`
- `career_workbench_inspect_operation`
- `career_workbench_start_discovery`
- `career_workbench_record_discovery`
- `career_workbench_complete_discovery`
- `career_workbench_start_child`
- `career_workbench_child_status`
- `career_workbench_child_followup`
- `career_workbench_child_report`
- `career_workbench_cancel_child`
- `career_workbench_delete_child`

Every mutation is authenticated to the local backend and idempotent.
Evaluation-scoped mutations are correlated to one operation and checked against
the exact in-process originating Agent object and authenticated DSH session.
Completion marks a turn terminal only after the backend has committed the
deterministic evaluation and trusted operation terminal.

Job discovery starts only against an active user-owned search profile. The
originating Agent may record exact HTTP(S) posting sources and bounded match,
gap, and risk summaries into a deduplicated inbox. Those records remain
untrusted leads: DSH cannot shortlist them. Only a same-origin browser/user
decision can atomically promote a lead into a canonical opportunity. The plugin
does not itself provide a web scraper or job-board client; discovery depends on
research capabilities explicitly composed into the owning DSH runtime.

Source capture is deliberately restricted to external opportunity, company, and
market text. It cannot create candidate-primary material. Candidate artifact
generation produces only a staged draft, requires verified facts plus accepted
candidate evidence, and never marks the artifact reviewed. Application
inspection is read-only. A transition tool call succeeds only when it presents
an unexpired browser-requested and browser-approved `application.transition`
approval bound to the exact application revision, state, effective date, and
note. The backend consumes that approval atomically with the transition; model
prose cannot create or approve it.

The HTTP provider accepts only uncredentialed loopback HTTP URLs, bounds
responses, rejects duplicate JSON keys, and projects backend entities onto
closed model-facing results. Source excerpts remain untrusted data. This plugin
cannot perform consequential external actions.

Native child start resolves at DSH inbox acceptance, not completion. The plugin
uses only public `ctx.subagents.startContinuable()`, `followup()`,
`reportFrom()`, `interrupt()`, and the required patched `deleteContinuable()`
seam. Each follow-up is a linked operation epoch over the same durable child
session, so a cold child resumes from DSH persistence. Model/reasoning
inheritance and explicit overrides are forwarded exactly; unsupported pairs,
depth, concurrency, time, context, and result bounds fail loudly.

The browser may record a follow-up request, but it cannot deliver it. The exact
live direct parent Agent must claim the request identity through
`career_workbench_child_followup`; the backend then records the accepted DSH
message identity. Deletion requires the byte-verified patch retained under
`provenance/patches/deepseek-harness` and reports `CAPABILITY_UNAVAILABLE`
without mutation when the host lacks that public method.
