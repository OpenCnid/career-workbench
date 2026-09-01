# Threat model

## Assets and authorities

Canonical assets are SQLite career state, immutable artifact bytes, audit
events, revisions, import manifests, accepted evidence, and user approvals.
Credentials, DSH sessions, Jupyter connection data, browser sessions, and OS
files are sensitive but are not product state. The local backend and IPython
have the OS user's authority; neither is a sandbox.

Only browser user commands and the exact originating live DSH Agent may request
mutations. SQLite transactions, domain validation, accepted evidence, revision
checks, and explicit review decide whether those requests commit. Browser state,
external prose, model output, child reports, and Python variables have no
mutation authority.

## Main threats and controls

| Threat                                    | Control                                                                                    | Residual limitation                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Malicious job/import text instructs tools | External text is labeled untrusted; closed tools and authoritative backend validation      | A model may still produce confusing prose; prose never authorizes mutation       |
| Unsupported candidate claim               | Verified facts plus accepted, exact candidate-source locators are mandatory                | Human acceptance can be mistaken and remains auditable/correctable               |
| CSRF or hostile origin                    | Loopback bind, exact Origin/Host, Fetch-Site, CSRF cookie/header, JSON-only commands       | A compromised local browser/OS user is outside this boundary                     |
| Forged DSH operation                      | Process-owned token, session/operation correlation, exact live Agent object registry       | Local process compromise can access OS-authorized resources                      |
| Stale/replayed mutation                   | Idempotency digests and optimistic revisions                                               | User must resolve genuine concurrent edits                                       |
| Child/kernel late output                  | Terminal monotonicity, cancellation fencing, generation retirement, bounded cleanup        | Cancellation receipt alone is not terminal settlement                            |
| Snapshot substitution/replay              | Authorized digest, size/path checks, no historical-cell replay                             | Python contents retain OS authority after restore                                |
| Path escape/artifact replacement          | Protected-root/link/ADS checks, workspace-relative resolution, content digest verification | Host filesystem/administrator compromise is not prevented                        |
| Credential or personal-data retention     | Synthetic-only policy, closed errors/records, scrubbed export, text hygiene scan           | Generated binary/raw external recordings require separate human review           |
| Consequential external action             | No v0.1 route or tool submits, sends, purchases, accepts, rejects, withdraws, or posts     | IPython can perform arbitrary OS/network actions and must be trusted accordingly |

## Review requirements

Every release run includes adversarial contract/API/storage/DSH/RLM tests,
repository hygiene scanning, package inventory inspection, SBOM/checksum
verification, browser accessibility checks, process/port cleanup, and manual
review of retained images. Any skipped live, human, or platform gate remains an
unmet release criterion.
