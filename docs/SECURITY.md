# Security and trust boundaries

Career Workbench is local software with operating-system authority. SQLite is
canonical structured storage, not a security boundary. The backend can access
files permitted to the local OS user. When enabled, IPython has the same class
of OS authority and is explicitly not a sandbox or a substitute for DSH tool
policy.

The workspace root validator rejects relative paths, filesystem and drive roots,
the user profile root, the repository root, configured DSH/Codex roots,
browser/credential markers, parent traversal, Windows alternate streams, and
linked existing ancestors where the host exposes them. Content artifacts use
workspace-generated relative paths, staged exclusive writes, SHA-256 identity,
atomic placement, bounded byte/media types, and read-time digest inspection.

Candidate-facing assertions require verified facts and accepted evidence that
supports the complete claim. External content is untrusted data and cannot
select tools, models, reasoning, files, approval scope, or mutations. Rejected
evidence remains auditable and is never eligible for scoring.

Credentials belong to their owning runtime. Logs, public errors, events,
exports, snapshots, fixtures, screenshots, and QA evidence must not contain
tokens, cookies, Jupyter keys, browser sessions, complete environment values,
raw provider payloads, unrestricted source content, personal data, or absolute
private paths. The repository hygiene gate scans retained text, but it does not
replace review or OS access control.

No v0.1 capability submits forms or applications, sends email or messages,
purchases, accepts, rejects, withdraws, or posts publicly.

Read-only job discovery runs only through the authenticated owning DSH Agent.
The backend binds each run and each resulting lead to the exact active search
profile revision and SHA-256 digest; a profile edit, pause, or cancellation
request fences later writes. External posting text is preserved as untrusted
source data and DSH match reasons are labeled as unverified analysis. URL user
information and credential-like query parameters are rejected, normalized URLs
are unique per workspace, and all source locators and listing URLs are removed
from exports. One run is bounded to 64 leads, 20 per host, and 8 MiB; the
workspace discovery inbox is bounded to 512 leads and 32 MiB. Only a direct
same-origin user action can shortlist or dismiss a lead, and neither action
performs an external consequence.

The native DSH adapter uses a separate local service token supplied to both the
server and owning DSH runtime. The token is never accepted in a URL or browser
request and must not be written into a patch file. Each request also carries the
authenticated DSH session and, after admission, operation correlation. The
backend checks those values against canonical operation state; an in-process
tool registry additionally retains the exact originating live Agent object.
Browser CSRF state, another DSH session, and an object that merely repeats an
Agent identity cannot authorize that operation's evidence or terminal.

Continuable children remain owned by the exact live DSH parent Agent. A browser
follow-up control records bounded user intent as `operation.followup_requested`;
it never calls DSH, resumes a child, or grants model authority. Only the exact
parent can deliver that request through the public continuation service, at
which point the accepted message ID and request correlation are committed. Child
reports are untrusted inputs and cannot authorize evidence or career-state
mutations. Cancellation receipt means interrupt requested, not terminal. Child
deletion is retention-preserving and requires the pinned public DSH deletion
patch; an unpatched host fails before a deletion event is written.

The native RLM provider starts kernels with an empty-by-default environment and
adds only validated allowlisted values and RLM-owned paths. Jupyter transport is
HMAC-authenticated and loopback-only. Snapshot authorization is a durable digest
event; restore rejects missing, corrupt, mismatched, oversized, or externally
redirected payloads and never replays historical cells. Interruption retires an
unresponsive generation, fences stale host requests, and performs bounded
process-tree cleanup.

IPython remains arbitrary OS-authority code execution. Python, subprocesses,
files, network calls, and shell magics can bypass DSH tool policy. Only calls
made back through the bounded native bridge regain the originating Agent's DSH
model, tool, approval, cancellation, session, and lineage authority. Notebook
variables and Python output cannot mutate canonical career state: the backend
accepts a closed proposal, recomputes comparison arithmetic, and the browser
requires an explicit revision-checked acceptance. Public API, tool, operation,
diagnostic, and UI responses omit Python, snapshot, manifest, and connection
paths.

Career Ops discovery is read-only and accepts only an absolute bounded
directory. It never follows selected-file symlinks, rejects filesystem roots,
enforces per-file/file-count/aggregate limits, requires valid UTF-8 for the
supported text formats, and selects only documented data files. The raw source
directory is retained only in a short-lived server preview and never returned to
the browser, written to canonical state, events, errors, screenshots, or
exports. Browser confirmation names only the server-issued preview identity and
SHA-256 fingerprint; apply re-discovers the bytes before committing. Imported
custom preferences and all external prose remain untrusted data.

Credential-like profile keys are preserved only within the user's sealed local
source artifact and are not mapped into facts. Imported code, prompts, workers,
package dependencies, provider credentials, and browser state are excluded.

Candidate draft generation is deterministic and accepts only current verified
facts that each have accepted candidate evidence. Every evidence-backed line
contains its canonical fact and evidence identities. User style direction is
bounded and labeled non-factual. Draft creation is not review: staged bytes
become reviewed/sealed only through a separate revision-checked browser command.
No artifact route has an external destination.

The default workspace export clears every source `inlineText`, source locator,
and opportunity/discovery URL and excludes artifact bytes. Event payloads are
recursively scrubbed for locator and credential-bearing field names. The
Overview export includes sealed artifact bytes only when the user explicitly
selects the exact artifacts before downloading. Both paths recompute normalized
and outer manifest digests after scrubbing. The result remains career data
intended for the local user and must still be protected as sensitive personal
information.
