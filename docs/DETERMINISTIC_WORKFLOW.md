# Deterministic workflow

`WorkbenchService` is the non-HTTP application façade. It accepts bounded typed
inputs and explicit command contexts. The real integration suite demonstrates:

```text
create safe workspace
  -> capture primary candidate source
  -> propose and confirm a profile fact
  -> capture external opportunity source and opportunity
  -> propose, accept, and reject evidence
  -> create and select immutable rubric version
  -> admit deterministic operation
  -> compute integer score and trusted terminal
  -> seal content-addressed report
  -> close and reopen SQLite
  -> inspect identical result and bytes
  -> correct verified fact
  -> mark dependent evaluation and artifact stale
  -> export credential-free state
```

Every mutation uses an idempotency key, an expected revision for updates, a
transaction, and one immutable audit event. Matching retries return the prior
result; changed content under the same key fails. Conflicting writes serialize
inside the local server and stale revisions fail rather than overwrite.

The implementation uses SQLite foreign keys, WAL, a busy timeout, strict tables,
ordered migration `001_initial`, a verified workspace-local backup, and bounded
ordered event queries. Timestamps never authorize a write.
