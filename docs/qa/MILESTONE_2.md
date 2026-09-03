# Milestone 2 evidence

Status: **partial.** The automated Windows browser/API behavior and bounded
in-page DSH résumé organizer pass with synthetic data, but the required
first-time-human confirmation and a general in-product DSH conversation are not
complete.

Implemented behavior:

- Fastify `/api/v1` server with closed TypeBox payloads, duplicate-key JSON
  rejection, stable public errors, idempotency keys, expected revisions, and
  `405`/`404` separation.
- Loopback binding, exact same-origin checks, `SameSite=Strict` CSRF cookie and
  header proof, mutation media-type checks, and no browser-state authority.
- Ordered SSE with sequence resume and bounded query fallback.
- React Router/TanStack Query browser flow for workspace setup, four fact
  outcomes, opportunity capture, deterministic evaluation, accepted evidence,
  gaps, score arithmetic, sealed artifacts, correction preview, staleness,
  activity, and scrubbed diagnostics.
- First-use explanations identify where each setup field is used, distinguish
  setup context from confirmed career evidence, and show both counts and the
  downstream trust boundary on Overview and Profile. Reopening the SSE
  connection refreshes the canonical snapshot so a restarted server cannot leave
  an old workspace rendered indefinitely.
- The focused first-use pass reduces setup to one name, presents one next action
  on Home, accepts a PDF/TXT upload, pasted résumé text, or an informal career
  story, and groups source-backed proposals into one compact explicit review.
  Each row exposes the four required decisions while keeping exact source text
  collapsed until requested. Confirmed career evidence and superseded history
  are separate collapsed records instead of being mixed into the pending list.
  Detailed search criteria remain deferred, and the remaining product surfaces
  stay behind accessible More and full-journey disclosures. Canonical routes
  remain directly addressable.
- Identity and reusable target-role, priority, and work-style records live on a
  dedicated Settings route. Career now contains career evidence only; Jobs
  retains the active discovery criteria built from those settings. Direct user
  entries render as ordinary labeled settings without evidence status or source
  ceremony, and saving them is the user's explicit confirmation. Revision and
  source records remain canonical internally; source inspection stays available
  for AI-organized and imported career claims where interpretation needs review.
- Continue with AI starts the source-bound DSH turn in the same page, exposes an
  accessible busy state, never asks the user to copy a prompt, and advances only
  after the canonical operation succeeds. Browser automation covers the click
  and progress state; API integration and live OAuth acceptance cover the real
  mutation and Agent boundaries.
- Responsive navigation, semantic forms, visible non-color state labels,
  reduced-motion behavior, keyboard focus, and WCAG contrast fixes.
- The production React application now uses the specified dark workstation
  presentation: semantic near-black surface tokens, warm text, phosphor-lime
  primary actions, blue informational state, square eight-pixel controls,
  one-pixel dividers, restrained notice treatments, and a visible three-pixel
  focus ring. Home is a quiet single-focus composition with one primary next
  action and an ordered six-stage journey rail. Career exposes four compact
  intake modes and a single-column claim-review queue; Settings, Jobs, Activity,
  Diagnostics, and the downstream records use the same subdued row language.

Evidence commands and results:

| Command                 | Result                                   |
| ----------------------- | ---------------------------------------- |
| `pnpm format:check`     | pass                                     |
| `pnpm typecheck`        | pass                                     |
| `pnpm lint`             | pass                                     |
| `pnpm test:all`         | pass, 333 tests across all Vitest suites |
| `pnpm test:integration` | pass, including real TCP SSE and restart |
| `pnpm test:e2e`         | pass, 4 Chromium tests                   |
| `pnpm test:a11y`        | pass, 1 Chromium test                    |

The API integration suite uses real SQLite/filesystem storage and a real TCP SSE
response. It covers CSRF, hostile origins, content type, unknown fields,
duplicate JSON keys, missing idempotency identity, matching and conflicting
retries, stale revision, ordered resume, backend restart, malformed cursors,
unsupported methods, unknown routes, and the complete sealed-artifact flow.

The browser suite stores screenshots under `docs/qa/generated/milestone-2/`,
including `profile-claim-review.png`, `profile-settings.png`, and
`profile-settings-narrow-editor.png`. The dark-refresh evidence adds
`dark-home.png`, `dark-home-375.png`, `dark-career-intake.png`,
`dark-settings.png`, `dark-jobs.png`, `dark-activity.png`, and
`dark-diagnostics.png`. The existing narrow-editor artifact captures the open
name editor at an 880-pixel viewport; its focused test requires the input to
remain wider than 300 pixels.

The browser assertions sweep Home, Career, Settings, Jobs, Activity, and
Diagnostics at 320, 375, 768, 1024, and 1440 pixels. They check the exact dark
token contract, page overflow, usable control widths, one Home primary action,
the ordered journey, keyboard focus, reduced motion, and forced-colors
boundaries. The in-app qualitative pass inspected those responsive compositions,
the claim queue, and the focused name editor at 200% browser zoom. At 320
pixels, the page and scrollbar remain within the client width. Console errors
and warnings: zero. Axe serious/critical violations across overview, profile,
settings, opportunities, evaluations, activity, and diagnostics: zero.

No credential, cookie, absolute sensitive path, or personal data is retained in
this record or the synthetic screenshots.
