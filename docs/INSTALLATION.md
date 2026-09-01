# Installation and first use

Career Workbench `0.1.0-preview.0` is a source-distributed local preview. It is
not published or deployed. Use Node.js `24.19.0`, pnpm `11.24.0`, Git, and a
Chromium-compatible browser. A source build of native SQLite may require a
platform C++ toolchain and Python for node-gyp. Native RLM additionally requires
Python 3.11 and `uv`; the pinned package provisions its hash-locked environment
on first use. `CW_NODE_GYP_PYTHON` may name an explicit Python executable for
the clean-install verifier without changing product runtime configuration.

## Clean source installation

```sh
git clone https://github.com/OpenCnid/career-workbench.git
cd career-workbench
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Set an absolute workspace path that is not a home, repository, DSH, Codex,
browser-profile, credential, drive-root, symlink, or junction path. Then start
the loopback server:

```powershell
$env:CAREER_WORKBENCH_ROOT = 'D:\career-workspaces\preview'
$env:CAREER_WORKBENCH_PORT = '4317'
pnpm --filter @career-workbench/server start
```

Open `http://127.0.0.1:4317`, create the local workspace, and use Profile,
Opportunities, Evidence, Compare, Pipeline, Drafts, Activity, Import, and
Diagnostics. The browser supplies same-origin/CSRF proof automatically. The
server never listens beyond loopback.

For a reproducible import example, choose `tests/fixtures/career-ops-v1.18`,
inspect the preview and warnings, and confirm. The importer reads only its
allowlisted data files and never runs Career Ops skills, scripts, providers,
browsers, or workers.

## DSH plugin and RLM bundle

Run `pnpm release:prepare` and verify `release/SHA256SUMS`. The seven archives
and exact contents are listed in `release/package-inventory.json`. Install the
Career Workbench contracts/plugin archives and all five native RLM archives into
one clean DSH profile with the exact peers in `docs/COMPATIBILITY.md`. Apply all
three checked pnpm package adaptations under `provenance/patches/npm/`:
`dsh-session` exposes ignorable RLM events, `dsh-subagent` exposes durable
continuable deletion, and `dsh-llm-pi-ai` cleans provider session resources at
Agent teardown. The source-level patch inventory and exact hashes are in
`provenance/upstreams.json`. Do not install a second Cordis or DSH package set.

Configure one random local service token of at least 32 characters in the owning
server and DSH processes. Never place it in a URL, patch, screenshot, or
retained config. The example Cordis rows are in the bundle archive and
`packages/dsh-plugin/README.md`. Requested model/reasoning pairs must be listed
explicitly; unsupported settings fail rather than downgrade.

Authorize the live `openai-codex` route only through DSH's owning credential
runtime. The credential remains in DSH storage and is never copied into Career
Workbench:

```sh
pnpm dsh:authorize
pnpm test:live
```

## Uninstall

Stop the server and DSH profile, then remove the source checkout, its isolated
DSH profile, and any workspace only after making and verifying a backup. Package
uninstallation never removes workspace state automatically. No registry,
deployment, browser extension, background service, or desktop wrapper is
installed by this preview.
