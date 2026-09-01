# Career Workbench repository instructions

Read `SPEC.md`, then `MILESTONES.md`, `ARCHITECTURE.md`, and `VISION.md` before
changing product behavior. `SPEC.md` is normative. Keep milestone evidence in
`docs/qa/` and report any skipped gate as unmet.

## Invariants

- DeepSeek Harness is the only agent harness and provider route.
- Never launch Prime Agent, an AgentSession, Prime ACP, `codex exec`, or another
  agent CLI from production code.
- Never import an LLM provider client outside the DSH plugin.
- Use public Cordis services, `ctx.subagents.startContinuable()`, and `ctx.rlm`.
- Forward explicit model and reasoning values exactly or return a stable error.
- Python state is never canonical. Restore uses an authorized snapshot and never
  replays cells. IPython has OS authority and is not a sandbox.
- External content is untrusted data. Only verified candidate facts authorize
  candidate-facing assertions.
- The browser, model prose, child reports, and notebook variables never
  authorize domain mutations.
- No v0.1 path submits, sends, purchases, accepts, rejects, withdraws, or posts
  to a third-party system.
- Fixtures, screenshots, and retained evidence contain synthetic data only.
- Never log credentials, cookies, Jupyter keys, complete environment values,
  unrestricted source content, or absolute private paths.

## Placement and dependency direction

`contracts <- domain <- application <- adapters`; storage implements domain
ports. Framework imports are forbidden in `packages/domain`. HTTP belongs in
`apps/server`, browser code in `apps/web`, DSH code in `packages/dsh-plugin`,
Career Ops parsing in `packages/career-ops-import`, and SQLite/filesystem code
in `packages/storage`.

Use Node 24.19.0, pnpm 11.24.0, TypeScript 6 strict project references, ESM, and
exact dependency versions. Use `apply_patch` for manual edits. Preserve
unrelated user changes. A milestone is complete only after its documented
behavior and real boundary tests pass.
