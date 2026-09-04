# Career record density self-play evidence

Date: 2026-09-03

## Property

A career record with ten to twenty-plus years of experience remains quick to
scan without hiding or changing approved evidence. The default view is bounded,
long claims cannot dominate the page or overflow it, every fact remains
recoverable, source and correction details stay optional, and all controls keep
their meaning for keyboard and assistive-technology users.

## Final candidate

- `apps/web/src/App.tsx`:
  `535fb8443c2ff33c9f477bcb6177fde36d313edbb77a37e71d7aa2e2c5bd8ca1`
- `apps/web/src/styles.css`:
  `75b13020035b145afe5fae7fa6904dec3c18c3a0d0ef5424359f5930e08803bc`
- `tests/browser/workbench.spec.ts`:
  `17ce777d4e8295f33b0757db729703c00c5feb101c7e2326ee16407142019ace`

## Cases and revisions

The clean-room matrix covered the ordinary seven-fact record, twenty-plus facts
concentrated in one category and distributed across categories, a roughly
2,000-character fact with a 700-character unbroken token, a custom
`certification` type, multiple saved sources, 320 by 900 and 375 by 812 mobile
viewports, keyboard traversal, and cross-row disclosure switching.

The first candidate established grouped three-row previews and icon-only row
actions but failed three adversarial cases: a long fact could create an
arbitrarily tall row, custom fact types disappeared, and edit/source exclusion
worked only within one row. It also labeled every candidate source generically.
The smallest causal revisions were:

- clamp overflowing claims to two lines and reveal their complete text through a
  measured, row-local `Show full detail` control;
- apply `overflow-wrap: anywhere` to claims and source identifiers;
- route noncanonical fact types into a counted `Other` group;
- lift the active edit/source disclosure to the collection so only one drawer
  can be open anywhere in the record;
- identify each source with its captured date, complete stable source ID, and a
  supplemental digest prefix; and
- replace the zero-impact correction phrase with “Nothing else will be marked
  out of date.”

The final exact candidate passed independent density, mobile/accessibility, and
information-architecture evaluations. At 375 pixels wide, collapsed rows stayed
at or below 86 pixels, icon targets were 40 by 40 pixels, and no horizontal
overflow occurred. On desktop, the first viewport showed three Experience rows,
the remaining-count disclosure, and the start of Achievements instead of one
large fact card.

## Verification

- `pnpm check` — passed; 26 test files and 336 tests
- `pnpm exec playwright test` — passed; 4 serial browser flows
- long-claim browser boundary — collapsed at or below 90 pixels, expanded to
  full text, re-collapsed, and retained zero horizontal overflow
- cross-row negative control — Source A to Edit B and Source A to Source B left
  exactly one expanded control and one visible drawer
- in-app browser inspection — default record, source drawer, correction drawer,
  and whole-record collapse
- retained synthetic screenshots under `docs/qa/generated/`
