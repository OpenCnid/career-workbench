# Career Workbench DSH plugin

This is the native Cordis/DeepSeek Harness adapter for Career Workbench. It
registers five deterministic-workflow tools, six native-child tools when the
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
- `career_workbench_start_child`
- `career_workbench_child_status`
- `career_workbench_child_followup`
- `career_workbench_child_report`
- `career_workbench_cancel_child`
- `career_workbench_delete_child`

Every mutation is authenticated to the local backend, idempotent, correlated to
one operation, and checked against the exact in-process originating Agent object
and authenticated DSH session. Completion marks a turn terminal only after the
backend has committed the deterministic evaluation and trusted operation
terminal.

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
