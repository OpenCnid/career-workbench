# Compatibility profile

The v0.1 preview supports only this atomic upstream set. Other revisions fail
readiness checks and are not silently substituted.

| Component         | Repository                                        | Revision / tag                                                    | Resolved version                | License |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- | ------- |
| Career Ops        | `https://github.com/santifer/career-ops`          | `3a067ee580b7982cf5dd6edf7895112e4e99600b`                        | `1.31.0`                        | MIT     |
| DeepSeek Harness  | `https://github.com/deepseek-ai/deepseek-harness` | `dd6322d604e00eec1ba5e0c8541159906a21094a` / `dsh-v0.1.2-alpha.3` | DSH package set `0.1.2-alpha.3` | MIT     |
| Native RLM bundle | `https://github.com/OpenCnid/deepseek-rlm`        | `0e9f030300f9e5b37b76cdcd3d39bc490a251e79`                        | `0.1.0-preview.0`               | MIT     |
| Cordis            | npm                                               | pinned by native RLM / DSH                                        | `4.0.2`                         | MIT     |

Required DSH patches are reused from the native RLM bundle and applied in order:

1. `0002-continuable-child-deletion.patch`
2. `0003-public-ignorable-session-events.patch`
3. `0004-pi-ai-agent-session-cleanup.patch`
4. `0005-bounded-process-shutdown.patch`

The first two expose required public RLM/child seams. The latter two repair
generic pi-ai and CLI shutdown lifecycle behavior. Runtime diagnostics record
all four identities.

Runtime pins are Node.js `24.19.0`, pnpm `11.24.0`, and TypeScript `6.0.3`.

The Career Ops importer uses `yaml` `2.8.1` with duplicate-key rejection,
aliases disabled during materialization, a bounded allowlist, and the exact
Career Ops `tracker-aliases.json`/`templates/states.yml` behavior observed at
the pinned revision. Other observed Career Ops versions produce a visible
compatibility warning; the importer never silently substitutes contracts.

The native plugin pins these published peer packages exactly: `dsh-agent`,
`dsh-llm`, `dsh-system-prompt`, `dsh-tools`, `dsh-session`, `dsh-subagent`,
`dsh-session-projection`, `dsh-jobs`, `dsh-sandbox`, and `dsh-attachment` at
`0.1.2-alpha.3`, plus Cordis `4.0.2`. `dsh-attachment` is explicit because the
published `dsh-llm` type declarations reference it while its manifest lists it
only as a development dependency. Career Workbench source remains under strict
TypeScript checking; `skipLibCheck` is enabled only for external declaration
files because the exact published graph contains invalid optional/duplicate peer
declarations in Anthropic, Google MCP, and Vite packages. The local declaration
augmentation repairs alpha.3's omitted projection state-map entrypoint import
without copying runtime behavior.

All four retained patches are byte-identical to the native RLM revision. Their
SHA-256 values are checked by `pnpm check:patches`. Applied in order to DSH
`dd6322…`, the affected upstream suites passed 191/191 tests on Windows for
continuation/deletion/listing, pi-ai resource cleanup, and bounded CLI shutdown.

The 51-file runtime closure under `vendor/deepseek-rlm` is retained
byte-identically from `0e9f0303…` because the preview packages are not published
to npm. `provenance/deepseek-rlm-files.json` records and verifies every file.
The workspace also applies three reproducible pnpm package adaptations to the
published DSH layouts. They are mechanically built from the verified source
patches: `dsh-session` patch 0003
(`29ca46973e6c36b39df9dbc62cd4b8ad1dbdb61dc9427a93a86e83d4dc273601`),
`dsh-subagent` patch 0002
(`00d8bc7b92e96d534261b93e5ed6188e20751b1f7ada6d2d34722b9837e875c9`), and
`dsh-llm-pi-ai` patch 0004
(`9fe9532e3da4d7ece2a7345c9269dedb940d70e876646d818a7a06466f1c2899`). Patch 0005
applies to the upstream DSH CLI host and has no package in this workspace's
installable runtime composition.

The pinned RLM gate passed 21 TypeScript unit tests, 62 Python tests (2 excluded
by the upstream command), 11 real integration tests, and 5 bundle E2E tests on
Windows. The upstream `test:python` script requires a `--` separator before the
Python command on this host, and its E2E suite requires `pnpm build` to stage
the managed lock first; both exact test selections passed with those invocation
corrections.
