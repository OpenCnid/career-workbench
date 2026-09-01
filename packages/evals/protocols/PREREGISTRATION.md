# Qualitative comparison preregistration

Frozen before participant collection for preview `0.1.0-preview.0` on
2026-09-01. Changes after the first participant require a dated amendment; the
original remains in version control.

## Question and conditions

The study asks whether the Workbench interface plus authoritative backend is
easier to understand and control than pinned Career Ops, and whether native RLM
adds value beyond ordinary DSH. Conditions are:

1. Career Ops `3a067ee580b7982cf5dd6edf7895112e4e99600b` in its normal
   agent-skill workflow.
2. Career Workbench using DSH with RLM unavailable.
3. Career Workbench using the same DSH profile with RLM available.

Provider/model/reasoning are held constant where supported. The Workbench runs
use `openai-codex`, `gpt-5.6-sol`, and a recorded supported reasoning level.
Condition order is assigned by a balanced Latin square. The same public
synthetic case and human task wording are used in every condition. Evaluator
truth is not shown to the participant, agent, DSH, browser, or IPython.

## Sample and success thresholds

Run a product-team rehearsal first; it is excluded from independent thresholds.
Then collect at least three participants who are first-time users and did not
implement the product.

- At least 80% of eight tasks are completed without coaching or a terminal.
- Overall state-prediction accuracy is at least 80%.
- Accuracy for each of admitted, running, waiting, completed, failed, canceled,
  indeterminate, and stale is at least two thirds.
- There are zero critical candidate-fact failures and zero consequential
  external actions.

All failures count. A withdrawn session is retained only as a withdrawal count,
not as task data. Missing conditions, unavailable routes, timeouts, and adverse
outcomes are reported and never imputed.

## Analysis boundaries

Career Ops versus Workbench without RLM estimates interface/backend value.
Workbench without RLM versus Workbench with RLM estimates incremental RLM value;
DSH remains the orchestrator in both. RLM is not preferred for prose quality
alone. The report must name an improved registered dimension and show no
unacceptable safety, state-comprehension, reliability, latency, or repair-cost
regression. With this small sample, results are descriptive rather than
statistically generalizable.
