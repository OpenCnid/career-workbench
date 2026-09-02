# Next-session handoff: dark interface refresh

This handoff is for the Codex session that implements the Career Workbench dark
interface refresh. The design work is specified; the production dark styling has
not been implemented yet.

## Start here

Work from the current `main` branch after pulling the merged changes. Before
editing, read these files completely in this order:

1. `AGENTS.md`
2. `SPEC.md`
3. `MILESTONES.md`
4. `ARCHITECTURE.md`
5. `VISION.md`
6. `docs/design/DARK_MODE_REFRESH_SPEC.md`
7. `docs/design/DESIGN.md`

`SPEC.md` remains normative. The dark refresh is a browser presentation change;
it must not weaken the domain, authorization, evidence, DSH, RLM, storage, or
external-action boundaries.

## Current product baseline

The baseline entering the dark refresh includes:

- a focused onboarding flow that asks only for the candidate name;
- PDF/TXT upload, résumé/CV paste, informal career-story intake, and manual role
  entry;
- an in-page, bounded DSH-owned résumé organizer using the configured
  `openai-codex/gpt-5.6-sol` route and explicit reasoning `low` by default;
- compact review of AI-organized career claims before any claim is accepted;
- source details collapsed behind **Check source** for AI/import
  interpretations;
- plain **Name** and search-preference settings without “verified,” “Candidate
  is,” or provenance ceremony for direct user input;
- direct preference saving, where the explicit Save action is the user's
  confirmation;
- responsive settings correction fields, including an automated 880px viewport
  assertion;
- paginated activity, guided job discovery, evaluation, comparison, pipeline,
  reviewed drafts, Career Ops import, export, diagnostics, native children, and
  RLM workflows from the existing product baseline.

Do not replace these working behaviors with static demonstrations. Preserve the
existing route structure and tests while changing the visual system.

## How to use the dark-refresh specification

Treat `docs/design/DARK_MODE_REFRESH_SPEC.md` as the delivery contract for this
UI pass. Implement its sequence in order:

1. Introduce semantic dark tokens and remove literal light-surface assumptions.
2. Restyle the shared shell, navigation, focus treatment, form controls, and
   buttons.
3. Convert Home to the quiet single-focus composition and ordered journey rail.
4. Restyle Career intake and the compact claim-review queue.
5. Apply the same record-row language to Settings, Jobs, Activity, and the
   downstream routes.
6. Verify every specified width, 200% zoom, keyboard-only use, reduced motion,
   and forced-colors behavior.
7. Run the complete repository and browser gates.
8. Update the retained synthetic screenshots and milestone evidence.

The intended mood is a calm professional workstation: near-black surfaces, warm
readable text, phosphor-lime primary actions, blue informational state,
monospace taxonomy, one-pixel dividers, restrained corners, and generous empty
space. It is deliberately not a neon cyberpunk theme. Do not add scanlines over
text, glow-heavy panels, novelty cursors, remote fonts, or a dense dashboard.

Dark is the deliberate default for this pass. A theme switch is out of scope
unless the user expands the request.

## Local setup

Required versions are Node.js 24.19.0 and pnpm 11.24.0.

```powershell
pnpm install --frozen-lockfile
pnpm build
```

The default persistent workbench is stored under the product's existing local
application directory. Do not delete or reset it unless the user explicitly asks
to restart their workflow.

To run the persistent application with DSH and RLM enabled in PowerShell:

```powershell
$env:CAREER_WORKBENCH_DSH_TOKEN =
  ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
$env:CAREER_WORKBENCH_RLM_ENABLED = "1"
$env:CAREER_WORKBENCH_DSH_PROVIDER = "openai-codex"
$env:CAREER_WORKBENCH_DSH_MODEL = "gpt-5.6-sol"
$env:CAREER_WORKBENCH_DSH_REASONING = "low"
pnpm --filter @career-workbench/server start
```

Then open `http://127.0.0.1:4317`.

The generated service token above is an opaque local server capability, not the
OAuth credential. Never print, persist, or expose credentials. Provider
authorization belongs to DSH. If authorization is missing, use
`pnpm dsh:authorize` with the user present; do not inspect or copy the owned
credential.

Expected diagnostics for the current baseline:

- storage: `ok`
- DSH capability: `true`
- RLM capability: `true`
- compatibility: `ready`
- server binding: `127.0.0.1` only

If port 4317 is occupied, identify the exact listening process before stopping
anything. Do not terminate an unverified process.

## Required verification

At minimum, run:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:all
pnpm check:contracts
pnpm check:provenance
pnpm check:patches
pnpm check:hygiene
pnpm check:docs
pnpm build
pnpm check:packages
pnpm test:e2e
pnpm test:a11y
```

The convenient aggregate for the non-browser checks is `pnpm check`. Do not
weaken assertions to accommodate the redesign. Add focused browser assertions
for the new dark tokens, overflow, focus visibility, and essential route state.

Perform qualitative browser review at 320px, 375px, 768px, 1024px, and 1440px,
plus 200% zoom. Verify that the name editor and all other inputs remain usable
when the window is constrained. Check Home, Career intake, claim review,
Settings, Jobs, Activity, and Diagnostics. Retained screenshots must use
synthetic data only.

## Existing evidence and useful paths

- Dark refresh contract: `docs/design/DARK_MODE_REFRESH_SPEC.md`
- Current design principles: `docs/design/DESIGN.md`
- Browser flow: `tests/browser/workbench.spec.ts`
- Web implementation: `apps/web/src/App.tsx`
- Current styles: `apps/web/src/styles.css`
- Milestone 2 evidence: `docs/qa/MILESTONE_2.md`
- Current constrained editor image:
  `docs/qa/generated/milestone-2/profile-settings-narrow-editor.png`
- Installation and DSH startup behavior: `docs/INSTALLATION.md`
- Security boundaries: `docs/SECURITY.md`

The prior visual sketch is intentionally not a production artifact. The spec's
color, layout, route-treatment, and component sections are the authoritative
inputs for implementation.

## Guardrails that must survive the redesign

- DeepSeek Harness remains the only agent harness and provider route.
- The browser never authorizes domain mutations or calls an LLM provider.
- AI/imported career assertions still require accepted candidate evidence.
- Direct user settings may look simple, but canonical revision history remains
  in storage.
- Source detail remains available for model/import interpretations even though
  it is hidden from ordinary settings.
- No UI action submits an application, sends a message, purchases, accepts,
  rejects, withdraws, or posts to an external system.
- IPython retains operating-system authority and is not a sandbox.
- Do not expose credentials, cookies, keys, complete environment values,
  personal data, or raw private paths in visual evidence or logs.

## Completion standard

The refresh is complete only when the behavior exists in the production React
application, every relevant automated test passes, all specified viewport and
accessibility checks pass, visual QA has been performed in a real browser, and
the screenshots and documentation match the delivered interface.

Do not claim the repository's unrelated three-participant qualitative study or
an unavailable operating-system result unless it was actually completed.
