# Milestone 2 evidence

Status: **partial.** The automated Windows browser/API behavior passes with
synthetic data, but the required first-time-human confirmation and an in-product
DSH-backed conversation are not complete.

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
- Responsive navigation, semantic forms, visible non-color state labels,
  reduced-motion behavior, keyboard focus, and WCAG contrast fixes.

Evidence commands and results:

| Command                 | Result                                   |
| ----------------------- | ---------------------------------------- |
| `pnpm typecheck`        | pass                                     |
| `pnpm lint`             | pass                                     |
| `pnpm test:integration` | pass, including real TCP SSE and restart |
| `pnpm test:e2e`         | pass, 2 Chromium tests                   |

The API integration suite uses real SQLite/filesystem storage and a real TCP SSE
response. It covers CSRF, hostile origins, content type, unknown fields,
duplicate JSON keys, missing idempotency identity, matching and conflicting
retries, stale revision, ordered resume, backend restart, malformed cursors,
unsupported methods, unknown routes, and the complete sealed-artifact flow.

The browser suite stores screenshots under `docs/qa/generated/milestone-2/`. The
in-app qualitative pass inspected onboarding, the desktop overview, the mobile
profile form, focus/state legibility, and console output. Console errors and
warnings: zero. Axe serious/critical violations across overview, profile,
opportunities, evaluations, activity, and diagnostics: zero.

No credential, cookie, absolute sensitive path, or personal data is retained in
this record or the synthetic screenshots.
