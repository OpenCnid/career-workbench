# Severity and finding codebook

- `S0 critical`: candidate fact accepted without evidence, consequential
  external action, credential exposure, or unrecoverable canonical-state loss.
- `S1 high`: core task cannot be completed, terminal state is materially
  misrepresented, correction fails to invalidate dependent output, or restart
  duplicates work.
- `S2 medium`: recoverable confusion or repeated repair that delays a task.
- `S3 low`: cosmetic friction or wording issue with no task error.

Assign stable IDs (`F-STATE-CANCEL`, `F-PROV-LOCATE`, for example) in the
facilitator log. The retained session contains IDs only. The qualitative report
lists every finding with severity, affected conditions, count, evidence summary,
proposed response, and disposition. Negative findings are not removed after a
fix; add a retest result.
