# Career Workbench design system

The proposed dark visual refresh and its implementation acceptance criteria are
specified in `docs/design/DARK_MODE_REFRESH_SPEC.md`.

Career Workbench is an evidence studio, not a chatbot or an applicant tracking
spreadsheet. Its interface should help a first-time user answer two questions
without documentation:

1. What is it for? Turning verified career evidence into explainable decisions
   and reviewed application materials.
2. How do I use it? Build evidence, set a search direction, discover and triage
   real roles, assess the fit, then prepare and track the move.

## Product experience principles

- Lead with a human outcome, then disclose the underlying records and trust
  model as the user works.
- Trust direct user input in the interface. Names and search preferences should
  look and edit like settings, without re-presenting provenance or verification
  labels. Preserve revision/source history internally, and expose exact sources
  when a model or importer has interpreted career evidence for review.
- Keep the primary workflow visible on Overview. Show completion from canonical
  state and link every stage to the real working surface.
- Prefer bounded views. Event history defaults to 10 items, supports 10, 25, or
  50 items per page, and provides explicit newer/older navigation.
- Keep consequential limits visible: local storage, accepted evidence, explicit
  review, and no external submission.
- Do not imply a switchable project system. The v0.1 server owns one local
  workbench root; show its name persistently and describe first run as setting
  up this installation.
- Use technical vocabulary where it protects the user (for example, stale,
  sealed, and accepted evidence), and pair it with plain-language context.

## Visual language

- Use an ink-and-white core with one purposeful pastel story surface per major
  viewport. Lilac means guidance, lime means verified progress, sky means
  ordered activity, and coral remains available for attention states.
- Use system sans-serif typography with a compact monospace accent for taxonomy
  and receipts. Do not require proprietary fonts or remote font loading.
- Use black pill-shaped primary actions, hairline borders, generous white space,
  and rounded content blocks. Shadows are sparse and gradients are not used.
- Keep controls at least 44 pixels tall. At narrow widths, content becomes a
  single column and primary navigation becomes one horizontally scrollable row.
- Color is supportive, never the sole carrier of status or meaning.

## First-use journey

1. Create the single private local workbench with only the candidate name. The
   balanced-fit rubric is selected deterministically and target preferences are
   explicitly deferred so first use does not become a questionnaire.
2. Add career history by uploading a PDF or text résumé, pasting résumé/CV text,
   describing past work in rough prose, or entering one role at a time. Upload
   and paste are explicit separate choices; the default résumé view never hides
   the file picker. A bounded in-page DSH run can organize a saved source into
   exact, source-linked proposals. Review those proposals in one compact
   editorial queue: decisions stay visible and exact source excerpts expand only
   on request. Confirmed evidence and superseded history are separate collapsed
   records. Only confirmed claims become career evidence that can support
   evaluation and candidate-facing work.
3. Choose one target role or explicitly ask to explore roles aligned with the
   confirmed experience. Optionally refine the complete search criteria:
   seniority, locations, work arrangements, compensation floor, AI direction,
   priorities, and exclusions. Verified identity and reusable target, priority,
   and work-style records belong in Settings rather than the Career evidence
   workflow.
4. Start bounded discovery through the configured DSH Agent. Each returned
   listing preserves exact untrusted source text, explains why it appeared, and
   remains a lead until the user shortlists or dismisses it. Manual opportunity
   capture remains available.
5. Evaluate a shortlisted role through DSH against a visible rubric and accepted
   evidence; the browser-only local demonstration is labeled as such and never
   presented as an AI recommendation.
6. Compare fit and tradeoffs when useful.
7. Prepare reviewed materials and record pipeline state without taking an
   external action.

Home presents only the next incomplete action by default. The six-stage guide,
information-use map, workspace statistics, search, and export remain available
inside **See the full journey and workspace details**. The interface derives
completion from canonical backend state rather than browser storage and
refreshes it whenever the ordered activity stream reconnects.

## Reference provenance

This system adapts general design-system lessons from the Figma study in
VoltAgent's `awesome-design-md` corpus: a monochrome functional core, purposeful
color-block storytelling, restrained elevation, and responsive touch targets. It
does not copy Figma branding, fonts, trademarks, or product UI. Source inspected
at revision `8147538b4226ae41e2487a9179e3bcc1f68e8554`; the source repository is
MIT licensed, Copyright 2026 VoltAgent.

Archify was inspected at revision `199360cc6687a7857b54dd188d4922b09e466a4b`.
Its workflow schema informed the seven-step journey above. A candidate diagram
was not retained because it still failed Archify's desktop readability validator
after the permitted repair rounds; the product UI is the authoritative delivery
for this change.
