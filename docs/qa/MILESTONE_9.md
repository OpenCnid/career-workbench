# Milestone 9 evidence

Status: **engineering behavior implemented; external gates remain visible.**

The source preview has a frozen pnpm lockfile, ordered migration 4, real SQLite
online backup and atomic restore rehearsal, workspace administration CLI,
representative-workspace performance bounds, threat model, security regressions,
seven package archives, CycloneDX SBOM, SHA-256 inventory, and a clean isolated
install/import verifier. The verifier applies the exact three DSH package
adaptations rather than testing an unpatched profile. `pnpm check:clean-install`
copies source without local modules or release output, performs a frozen install
in a fresh temporary directory, and removes it. The current developer Windows
host lacks Visual Studio Build Tools, so its native rebuild remains a documented
local prerequisite failure. The hosted Windows runner completed the same full
native clean-install verifier successfully, and hosted Ubuntu and macOS runners
completed the corresponding clean-install, full-check, browser, release, and
isolated-install routes.

The complete local Windows gate record is refreshed before handoff. The GitHub
Actions matrix configures frozen install, all repository checks, Chromium E2E,
release construction, release verification, and isolated installation on
Windows, Ubuntu, and macOS with Node 24.19.0, pnpm 11.24.0, and uv 0.12.7. A
three-platform workflow run is retained in GitHub Actions. The macOS tests
canonicalize the `/var` temp-directory alias to `/private/var` before applying
the workspace boundary, and `.gitattributes` pins source checkouts to LF so the
same formatting gate is reproducible on Windows.

## Executed gate summary

| Environment / command                                 | Exact result                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Windows `pnpm check`                                  | exit 0; 17 files / 279 tests; 32 schemas; provenance, hygiene, docs, build, 9 manifests passed                             |
| Windows `pnpm test:e2e`                               | exit 0; Chromium 2/2 including ten-route axe and keyboard checks                                                           |
| Windows `pnpm test:security`                          | exit 0; 3/3                                                                                                                |
| Windows representative performance                    | 250 opportunities; create 449 ms; list 1 ms; export 26 ms / 490,298 bytes; SQLite 1,265,664 bytes; RSS +44,113,920 bytes   |
| Windows release / isolated install                    | 7 packages; 642 SBOM components; 9 checksums; exact DSH-peer install/import passed                                         |
| Windows clean frozen lockfile install                 | exit 0                                                                                                                     |
| Windows full native clean install                     | exit 1; external Visual Studio Build Tools unavailable                                                                     |
| Windows authenticated live acceptance                 | exit 0; `openai-codex/gpt-5.6-sol`, reasoning `high`; ordinary, child, RLM, restart, UI, cleanup passed                    |
| Hosted Windows clean install / full matrix            | exit 0; native clean install, 279 tests, Chromium, release, and isolated install passed                                    |
| Hosted Ubuntu clean install / full matrix             | exit 0; native clean install, 279 tests, Chromium, release, and isolated install passed                                    |
| Hosted macOS clean install / full matrix              | exit 0; native clean install, 279 tests, Chromium, release, and isolated install passed                                    |
| Linux/amd64 Docker full native install + `pnpm check` | exit 0; Node 24.19.0 / pnpm 11.24.0 / uv 0.12.7; 17 files / 279 tests                                                      |
| Linux representative performance                      | 250 opportunities; create 1,155 ms; list 1 ms; export 56 ms / 490,298 bytes; SQLite 1,265,664 bytes; RSS +40,067,072 bytes |
| Linux Chromium / release / isolated install           | 2/2 E2E; 7 packages; 642 SBOM components; 9 checksums; exact DSH-peer install/import passed                                |

The authorized live runner is `scripts/live-acceptance.ts`. It uses DSH's own
credential and `openai-codex` provider services, preserves `gpt-5.6-sol`/`high`,
rejects unsupported model and reasoning settings, checks ordinary orchestration,
native child completion/follow-up/cancellation/deletion, executes `x = 41` then
restores `x + 1` as `42` without cell replay, accepts a deterministic
comparison, shuts Python down, restarts the backend, and verifies durability and
port cleanup. Its scrubbed result is `docs/qa/generated/live-acceptance.json`
and its real-browser Activity screenshot is
`docs/qa/generated/live-activity.png`. The route passed on 2026-09-01 with all
recorded checks true; DSH reported the credential configured without Career
Workbench reading or printing its value.

An in-app Chromium qualitative pass created a workspace, verified navigation,
summary cards, next-step guidance, canonical search/export controls, and the
visible SSE-connected state. The retained scrubbed screenshot is
`docs/qa/generated/in-app-overview.png`; the loopback server port was verified
closed after inspection. Automated Playwright evidence for sealed evaluation,
recovery, child lineage, accepted comparison, Career Ops import, and reviewed
draft provenance is under `docs/qa/generated/milestone-*`.

Release blockers that cannot be inferred or fabricated:

- product-team qualitative rehearsal: not conducted;
- independent first-time participants: 0/3.

No package was published, no deployment was made, and no release/commit/push/PR
action was taken by the release preparation workflow.
