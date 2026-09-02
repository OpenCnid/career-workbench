# Career Workbench dark interface refresh

Status: proposed for the next implementation session
Scope: browser UI only; no domain, storage, API, DSH, RLM, or evidence-policy
changes

## Product intent

Career Workbench should feel like a calm personal instrument: private, precise,
and capable without looking like enterprise software or a generic AI chat app.
The refresh combines four qualities:

- **Dark:** a near-black working canvas with readable warm text and restrained
  luminous accents.
- **Minimal:** one obvious next action, few simultaneous surfaces, and detail
  disclosed only when it helps a decision.
- **Retro and nostalgic:** terminal-like labels, ordered step numbers, hairline
  dividers, and the feel of a well-made late-1980s workstation.
- **Futuristic:** crisp live state, responsive layout, fast transitions, and an
  assistant that works inside the workflow instead of becoming the workflow.

This is not a cyberpunk theme. Avoid neon overload, faux CRT distortion,
scanlines over text, excessive glow, novelty cursors, skeuomorphic hardware, and
dense command-center dashboards.

## Experience principles

1. **One screen, one decision.** Home foregrounds only the next incomplete step.
   Secondary records stay behind explicit links or disclosures.
2. **The user is the source for their settings.** Name, target role, location,
   and priorities read like normal settings. Evidence language appears only when
   AI or an importer interpreted career material.
3. **Quiet until action is needed.** Success is understated. Warning and error
   color is reserved for states that require attention.
4. **Readable before decorative.** Nostalgia comes from rhythm, typography, and
   precise rules—not reduced legibility.
5. **No chat-shaped detour.** AI actions start and resolve within the relevant
   page, returning structured results for review.
6. **Local trust stays visible.** “Local” and “Private” are persistent, compact
   status cues. Technical diagnostics remain under More.

## Visual foundation

### Color tokens

The implementation should replace literal colors in `apps/web/src/styles.css`
with semantic tokens before restyling components.

| Token               | Proposed value | Use                                  |
| ------------------- | -------------- | ------------------------------------ |
| `--cw-canvas`       | `#0b0d0c`      | Page background                      |
| `--cw-sidebar`      | `#080a09`      | Navigation background                |
| `--cw-surface-1`    | `#121512`      | Primary panels and inputs            |
| `--cw-surface-2`    | `#191d19`      | Hover, expanded, and nested surfaces |
| `--cw-line`         | `#343a34`      | Hairline boundaries                  |
| `--cw-text`         | `#edf1e6`      | Primary text                         |
| `--cw-muted`        | `#a9b0a3`      | Secondary text                       |
| `--cw-phosphor`     | `#c8f169`      | Primary action and active progress   |
| `--cw-phosphor-ink` | `#11150b`      | Text on phosphor surfaces            |
| `--cw-signal`       | `#9eb8ff`      | Informational and AI-running state   |
| `--cw-warning`      | `#f3bd78`      | Actionable warning                   |
| `--cw-danger`       | `#ff9b91`      | Error and destructive boundary       |
| `--cw-focus`        | `#ffe082`      | Keyboard focus ring                  |

All text/background pairs must meet WCAG 2.2 AA. Normal text requires at least
4.5:1 contrast and large text at least 3:1. Interactive boundaries and focus
indicators require at least 3:1 against adjacent colors. Color never carries a
state without a text or icon companion.

### Typography

- Display and body: the existing system sans-serif stack. Do not add a network
  font.
- Interface labels, step numbers, timestamps, receipts, and compact status:
  `ui-monospace, SFMono-Regular, Consolas, monospace`.
- Headings use sentence case, slightly tight tracking, and no all-caps.
- Monospace labels may use uppercase with generous tracking, but never for
  paragraphs or form values.
- Body copy remains at least 16 CSS pixels in editable forms and at least 14 CSS
  pixels elsewhere.

### Geometry and depth

- Desktop content width: 72rem maximum, aligned to a consistent 8px spacing
  grid.
- Sidebar: 13.5rem desktop; compact bottom navigation below 720px.
- Corners: 8px for fields and panels, 999px only for true compact status pills.
- Borders: one-pixel neutral hairlines. Avoid stacked borders around every row.
- Shadows: none for normal content; one restrained shadow only for overlays.
- Touch targets: at least 44 by 44 CSS pixels.

### Motion

- 120–180ms transitions for hover, focus, disclosure, and route-state changes.
- AI-running state may use one slow, non-looping positional transition plus a
  static text status. Do not pulse whole panels.
- `prefers-reduced-motion: reduce` removes nonessential animation and smooth
  scrolling.

## Application shell

### Desktop

- Keep the left navigation, but reduce its visual weight.
- Brand becomes a compact `CW_` wordmark with “Career Workbench” beside it.
- Show the workbench name followed by a compact `LOCAL · PRIVATE` line.
- Keep Home, Career, and Jobs visible. More expands the remaining destinations.
- Active navigation uses phosphor text plus a two-pixel leading marker; it does
  not fill the entire row with a bright pill.
- Main content uses generous negative space and a single top-level focus area.

### Mobile and constrained windows

- Below 720px, use the existing four-item bottom navigation pattern.
- Panels, forms, review actions, and split layouts become one column before any
  input falls below 280px.
- No page-level horizontal scroll at 320px, 375px, 768px, or 1024px.
- Primary actions may become full width at 480px and below.
- Expanded editors remain in document flow; no modal is required for ordinary
  corrections.

## Route treatment

### Home

- Greeting and workbench status occupy one quiet header line.
- The dominant panel is **Your next move** with exactly one primary action.
- Show the six-stage journey as a thin ordered rail, not six large cards.
- Keep details, statistics, export, and information-use explanations inside the
  existing progressive disclosure.

### Career

- Intake choices resemble compact mode tabs: Upload résumé, Paste text, Tell my
  story, and Add role.
- AI organization uses the blue signal color and stays in the page.
- Pending claims use a dense editorial list: statement first, actions second,
  source detail collapsed.
- Confirmed and archived records remain collapsed by default.

### Settings

- Keep the current plain Name and Search preferences model.
- Do not show “verified,” “candidate is,” or provenance controls for direct user
  settings.
- Editors use one column and the full available width.
- Saving a direct setting is its confirmation.

### Jobs and downstream work

- Search criteria use a compact command strip followed by a bounded result list.
- A job row shows title, organization, location/work style, discovery reason,
  and its current user decision. Avoid decorative score cards.
- Evaluation, comparison, pipeline, and drafts share one status vocabulary and
  the same subdued record-row pattern.

### Activity and diagnostics

- Activity remains paginated with 10 records by default.
- Timestamps and sequence numbers use monospace type.
- Diagnostics remain factual and compact; green means ready, not decoration.

## Component rules

- **Primary button:** phosphor fill, dark text, 8px radius. At most one per
  decision group.
- **Secondary button:** transparent or surface fill with a visible line.
- **Text action:** underlined on hover/focus; includes an arrow only when it
  navigates.
- **Input:** surface-1 fill, readable border, full-width focus ring, and no
  glow.
- **Panel:** use only when grouping changes comprehension; otherwise use spacing
  and a divider.
- **Status:** short monospace label plus icon or plain-language text.
- **Notice:** one left rule and concise action-oriented copy; no oversized alert
  cards.
- **Source detail:** collapsed by default and labeled “Check source.”

## Accessibility and usability acceptance criteria

1. Axe reports zero serious or critical violations across every canonical route.
2. All interactive controls are reachable and operable by keyboard with a
   clearly visible focus indicator.
3. Normal text, large text, non-text controls, and focus indicators satisfy the
   contrast thresholds above.
4. At 320px, 375px, 768px, 1024px, and 1440px there is no horizontal page
   overflow, clipped control, overlapping text, or input narrower than 280px.
5. Browser zoom at 200% preserves access to every action without two-dimensional
   scrolling, except intrinsically wide data tables.
6. Reduced-motion mode removes nonessential transitions and animation.
7. Home exposes one primary next action; Career and Settings never require a
   provenance read to complete ordinary user-entered data.
8. Dark surfaces do not obscure native autofill, error, disabled, selected,
   hover, or focus states.
9. Screenshots are captured for Home, Career intake, claim review, Settings,
   Jobs, Activity, and one 375px constrained layout.
10. Existing Playwright workflow, DSH organization, SSE recovery, and domain
    tests continue to pass without weakened assertions.

## Implementation sequence for the next session

1. Add semantic dark tokens and replace literal light-theme colors without
   changing layout.
2. Restyle the application shell, navigation, focus states, fields, and buttons.
3. Convert Home to the single-panel focus composition and ordered stage rail.
4. Restyle Career intake and the compact claim-review queue.
5. Apply the shared record-row language to Settings, Jobs, Activity, and
   downstream routes.
6. Test every route at the required widths, 200% zoom, keyboard-only, reduced
   motion, and forced-colors mode.
7. Run formatting, lint, strict typecheck, all unit/integration/contract tests,
   Playwright workflow, accessibility tests, build, and package inspection.
8. Retain synthetic visual evidence in `docs/qa/generated/milestone-2/` and
   record any unresolved criterion as unmet.

## Out of scope

- Changing API or storage contracts.
- Changing DSH, RLM, import, evidence, confirmation, or authorization rules.
- Adding provider calls, chat history, external job submission, remote fonts,
  analytics, or a user-account system.
- Shipping a light/dark theme switch in the first pass. Dark is the deliberate
  product default; a user-selectable theme can be specified separately.
