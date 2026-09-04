# Find Roles density self-play evidence

Date: 2026-09-03

## Property

With 2, 10, or 50 discovered roles, the default Find Roles page exposes only the
information required to triage: role, organization, practical constraints, one
reason, one concern, and decision actions. All supporting evidence remains
recoverable, no more than five cards appear on a page, only one optional detail
drawer can be open, and maximum-length content cannot create page-level overflow
or an uncontrolled wall of text.

## Final candidate

- `apps/web/src/App.tsx`:
  `7cf7ebf220c5c37739492d318157263ca04b7a77b21c5414c4b2672e7e46bb82`
- `apps/web/src/styles.css`:
  `c0b416a65d95d3b02646fd728a23613f578bfbfdb7e8edc13bdfc57cffc0c756`
- `tests/browser/workbench.spec.ts`:
  `9f6110139a124bff85456f6097fbfa8d08e32b8a7ed6d664c8d66f827312447f`

## Cases and revisions

Clean-room evaluations covered ordinary live data, exactly 2, 10, and 50 roles,
five-card pagination, missing constraints/reasons/concerns, 12 gaps plus 12
risks with a cross-list duplicate, long natural-language content,
430-to-500-character unbroken reason/concern/source strings, a 300-character
unbroken match, 320 by 812 and 375 by 812 viewports, keyboard order, tab arrow
navigation, fixed-footer clearance, and sequential detail expansion.

The baseline failed because every gap and risk appeared on the card, source
evidence was filtered and replaced by a hard-coded provider claim, duplicate
controls had generic accessible names, and unbroken content could make the page
thousands of pixels wide. The smallest causal revisions were:

- replace the default concern list with one `Check first` signal and a count of
  the remaining checks;
- pair that concern with one `Why it surfaced` signal in a compact quick-read
  row;
- deduplicate reasons, gaps, and risks after trimming and case normalization;
- preserve source evidence or derive a neutral host-based fallback;
- identify every action and note field with its role and organization;
- hold the active detail ID at collection level so opening one card closes any
  other card;
- wrap long titles and evidence at arbitrary characters; and
- cap the optional evidence drawer at `min(65vh, 34rem)` with internal scrolling
  and zero-minimum grid tracks.

The first revised candidate passed ordinary density but failed the maximum
detail case: one drawer reached 4,643.6 pixels, and a 300-character match forced
3,064 pixels of page overflow at 320 pixels wide. The containment revision
reduced the final drawer to 526 pixels at 320 by 812, with equal client and
scroll widths of 302 pixels and zero page overflow.

## Final evidence

- 2 roles produced 2 cards and no pager; 10 produced 2 pages; 50 produced
  exactly 10 pages of 5 cards.
- The maximum 24 concern slots produced 23 unique items after one
  case-and-whitespace duplicate was removed.
- All reasons, concerns, matches, source evidence, and the optional note
  remained recoverable from one drawer.
- At 320 by 812, the detail drawer was 526 pixels high against a 527.8-pixel
  cap, and both the page and drawer had zero horizontal overflow.
- Sparse records used `Details not stated`, a neutral reason, a neutral concern,
  and a source host or `the original listing` fallback.
- Contextual View, Save, Pass, Details, Evaluate, Move, and note names were
  exposed to assistive technology. Card actions measured at least 40 pixels
  high.
- Keyboard traversal followed View, Save, Pass, Details; arrow keys switched New
  and Saved tabs; the last page action cleared the fixed mobile footer.
- Opening a second card left exactly one `aria-expanded="true"` control.

## Verification

- `pnpm test:e2e` — passed; 4 Chromium flows, including the long-content 320 and
  375 pixel discovery cases and key-route accessibility checks
- `pnpm check` — passed; formatting, lint, TypeScript, 336 tests, 45 public
  schemas, provenance, patches, hygiene, docs, production build, and 9 package
  manifests
- focused source-to-sealed browser flow — passed after the final adversarial
  assertions were added
- in-app browser inspection — compact default list and contained evidence drawer
- final clean-room density, information-architecture, and mobile evaluations —
  passed with no unmet requested checks

All retained fixtures and browser evidence use synthetic data. No credential,
cookie, personal record, unrestricted source content, or private absolute path
is retained in this evidence.
