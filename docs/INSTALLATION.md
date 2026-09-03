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

```sh
CAREER_WORKBENCH_ROOT=/absolute/path/to/career-workspaces/preview \
CAREER_WORKBENCH_PORT=4317 \
pnpm --filter @career-workbench/server start
```

Open `http://127.0.0.1:4317` and set up the local workbench. Each server process
owns exactly one configured workspace root; the name identifies that workbench's
records and exports, not a browser-switchable project. To operate a different
root, stop this process and start a separately configured local server. Use
Profile, Discover, Opportunities, Evaluations, Compare, Pipeline, Drafts,
Activity, Import, and Diagnostics. In Discover, save an active search profile,
choose **Find jobs**, and review the returned source-preserved inbox without
leaving the page. The owning DSH Agent performs the bounded run and can query
only the fixed Remotive public job API for this workflow. The browser does not
scrape job boards or call an LLM provider. Outbound HTTPS access to
`remotive.com` is required to retrieve current listings. The browser supplies
same-origin/CSRF proof automatically. The server never listens beyond loopback.

First-time setup asks only for the candidate name. Home then accepts a PDF or
plain-text résumé file, pasted résumé/CV text, or an informal career story as
one immutable candidate source. File upload is limited to 5 MB; PDF intake
requires selectable text, and extracted text is limited to 48 KiB. Uploaded
source bytes are sealed in content-addressed storage while the bounded text
representation supports exact locators and review. Choose **Continue with AI**
to run one bounded DSH-owned organizer turn in the same page. The server uses
the configured `openai-codex/gpt-5.6-sol` route with reasoning `low` by default
for this bounded extraction task; override those exact values with
`CAREER_WORKBENCH_DSH_PROVIDER`, `CAREER_WORKBENCH_DSH_MODEL`, and
`CAREER_WORKBENCH_DSH_REASONING`. Unsupported values fail instead of being
substituted. The native organizer tools may create only exact, source-linked
proposals; they cannot confirm them. The page waits for the canonical completed
operation and then opens the grouped summary in Career. After confirmation, Home
asks for one target role or an explicit “help me explore” choice; the full
search criteria remain editable in Jobs.

Saving or uploading alone never invokes an LLM or verifies a claim. The browser
never calls a provider: DSH retains model, reasoning, session, approval,
cancellation, and lineage authority for organization and discovery.

For a reproducible import example, choose `tests/fixtures/career-ops-v1.18`,
inspect the preview and warnings, and confirm. The importer reads only its
allowlisted data files and never runs Career Ops skills, scripts, providers,
browsers, or workers.

## DSH plugin and RLM bundle

Run `pnpm release:prepare` and verify `release/SHA256SUMS`. The 13 archives
(eight Career Workbench packages and five native RLM packages) and exact
contents are listed in `release/package-inventory.json`. Run
`pnpm check:isolated` to install all archives as one linked clean profile, and
`pnpm check:packaged-product` to install the seven product archives, compile
native SQLite, launch the packed server, and fetch the packed web app. On this
Windows host the latter currently stops at the documented missing Visual Studio
C++ toolchain. The archives are not published, so a standalone `pnpm add` would
try to resolve their private inter-package dependencies from the public
registry; use the clean source installation above for first use of this preview.

Install the Career Workbench contracts/plugin archives and all five native RLM
archives into one clean DSH profile with the exact peers in
`docs/COMPATIBILITY.md`. Apply all three checked pnpm package adaptations under
`provenance/patches/npm/`: `dsh-session` exposes ignorable RLM events,
`dsh-subagent` exposes durable continuable deletion, and `dsh-llm-pi-ai` cleans
provider session resources at Agent teardown. The source-level patch inventory
and exact hashes are in `provenance/upstreams.json`. Do not install a second
Cordis or DSH package set.

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
