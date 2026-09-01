# Provenance and adapted files

Career Workbench is MIT licensed. Upstream repositories are inspection,
compatibility, and fixture sources; Career Ops prompt-driven modes and workers
are never embedded or executed as the backend.

| Upstream                                                    | Use                                                                                  | Adapted files in this repository                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Career Ops `3a067ee580b7982cf5dd6edf7895112e4e99600b`       | Read-only data-contract, behavior reference, and synthetic upgrade fixture           | Five byte-identical files from `test-fixtures/upgrade/state-v1.18`; digests in `provenance/career-ops-fixture-files.json`; no production code copied                |
| DeepSeek Harness `dd6322d604e00eec1ba5e0c8541159906a21094a` | Public Cordis, Agent, tool, subagent, session, and bundle contracts                  | `packages/dsh-plugin/src/dsh-projection-compat.ts`, original minimal type augmentation; no runtime copied                                                           |
| deepseek-rlm `0e9f030300f9e5b37b76cdcd3d39bc490a251e79`     | Native kernel, bridge, IPython tool, runtime assets, and ordered public-seam patches | 51 byte-identical runtime files under `vendor/deepseek-rlm`; four byte-identical DSH patches under `provenance/patches/deepseek-harness`; digests in both manifests |

Inspection was performed from detached exact revisions. The compatibility
manifest in `provenance/upstreams.json` is machine checked. If deterministic
code is later adapted, this file must list every destination, upstream source,
revision, modifications, license, and digest before the change can pass.

The native bundle files are unmodified rather than adapted. Their exact source
paths and SHA-256 values are in `provenance/deepseek-rlm-files.json`; the
provenance gate reads every retained destination. The distribution-layout
adaptations under `provenance/patches/npm` implement the exact public
`appendIgnorable` seam from patch 0003, continuable-child deletion from patch
0002, and Agent-scoped pi-ai resource cleanup from patch 0004 in the pinned
published JavaScript and declarations. Their sources, modification statements,
MIT licenses, and digests are recorded under the DeepSeek Harness entry in
`provenance/upstreams.json`. Patch 0005 remains a DSH CLI host patch; Career
Workbench's own bounded server and RLM teardown paths are tested directly and do
not embed the upstream CLI.

The Career Ops importer is an original TypeScript implementation based on the
inspected public tracker/profile/report contracts; it does not copy or execute
Career Ops runtime code. Five upstream synthetic fixture files are retained
unmodified for interoperability testing. Their source paths, repository
revision, MIT license, destination paths, and byte digests are recorded in
`provenance/career-ops-fixture-files.json` and verified on every provenance
gate.
