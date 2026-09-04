# Product narrative self-play evidence

Date: 2026-09-03

## Property

An unfamiliar job seeker can identify Career Workbench as a local-first,
evidence-backed, user-controlled career workflow rather than a generic job
board, résumé generator, applicant tracker, or autonomous application bot. Home
names the complete journey. Every canonical page keeps that journey recoverable,
explains how the page helps, shows its approved input and useful output, and
retains a clear next action without exposing technical detail by default.

## Final candidate

- `apps/web/src/App.tsx`:
  `87289489648d3a726b9678507a6fae2e812f0dbe09b54f91831316f2afa55a59`
- `apps/web/src/styles.css`:
  `0759214d107c717d7ec0f2451499075f0d181253e888f9717f0026c25b7e1d59`
- `tests/browser/workbench.spec.ts`:
  `90d5807bf211f798fc7f3fc45ac66367b6d386a95628c1c619de28e59db747a2`

## Cases and revisions

The clean-room evaluation covered ordinary desktop use on Home, Career record,
and Find roles; dense More destinations; sparse and populated states; a 375 by
812 mobile boundary; adversarial product misinterpretations; and the negative
control of opening technical disclosures.

The first candidate failed because provider-backed AI actions made the broad
phrase "all local" ambiguous, onboarding exposed DSH vocabulary, non-Home pages
did not restate the five-stage model, and the tablet Find roles summary collided
with its action. The smallest causal revisions were:

- scope the promise to locally stored records, private workspace defaults,
  user-started AI, and no automatic external submission;
- disclose the configured AI-provider transfer beside each relevant action;
- rename the onboarding completion to "Career record ready" and remove DSH
  implementation vocabulary from the task path;
- add a compact five-stage rail and one explicit Career record handoff;
- frame discovery as role research, mute unavailable AI actions, and rename
  secondary navigation using job-seeker concepts; and
- move execution-route vocabulary behind Activity's technical disclosure.

Three independent final evaluators passed the product narrative, desktop dense
and disclosure cases, and the 375-pixel mobile layout for the final App and CSS
candidate. The full serial browser suite then passed all four flows, including
axe checks on every canonical route, mobile focus containment, no horizontal
overflow, the populated source-to-artifact journey, and retained synthetic
screenshots.

## Verification

- `pnpm test:e2e` — passed, 4 tests
- `pnpm test:a11y` — passed in the isolated empty-state run
- in-app browser inspection — Home, Career record, Find roles, and Drafts
- retained synthetic screenshots under `docs/qa/generated/`
