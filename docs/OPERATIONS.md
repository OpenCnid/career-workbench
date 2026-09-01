# Operations, upgrade, backup, restore, import, export, and troubleshooting

## Health and shutdown

Diagnostics must report SQLite `wal`, foreign keys enabled, integrity `ok`,
schema `4`, the exact compatibility pins, and only configured capabilities. Stop
with Ctrl+C and wait for the loopback port to close. Do not kill the process
during a database migration or artifact seal.

With the server stopped, inspect the database without exposing its absolute
path:

```sh
pnpm workspace:admin health <absolute-workspace-root>
```

## Backup and restore

Stop the server before administration. Backups use SQLite's online backup API
and pass `PRAGMA integrity_check` before success:

```sh
pnpm workspace:admin backup <absolute-workspace-root> before-upgrade
```

This creates `backups/before-upgrade.sqlite`. Copy the whole workspace to
separate storage as well because sealed artifact bytes live outside SQLite.

Restore only with the server stopped:

```sh
pnpm workspace:admin restore <absolute-workspace-root> before-upgrade
```

Restore verifies the selected backup, preserves the displaced current database
as `backups/pre-restore-<random>.sqlite`, atomically swaps the database, removes
obsolete WAL/SHM sidecars, applies forward migrations, reopens it, and reports
integrity. If the swap fails, the current database is put back. To roll back the
restore, use the reported `pre-restore-*` label with the same command.

## Upgrade

1. Stop server and DSH processes and confirm port/process-tree cleanup.
2. Back up SQLite and copy the entire workspace.
3. Install with the new frozen lockfile and run `pnpm check`.
4. Start once; migrations run in ordered SQLite transactions.
5. Verify diagnostics, source/artifact inspection, event ordering, and export.

Migration 4 adds independent opportunity legitimacy status as `unknown` to old
rows without changing entity revision. A failed migration does not commit its
schema row. Destructive/reinterpreting future migrations must first create and
verify a workspace-local backup or refuse to proceed.

## Import and export

Career Ops import is discovery → preview → explicit confirmation. Preview
expires after 15 minutes; changed bytes require a new preview. Identical bytes
return the same manifest. The source is never modified. Default JSON export is
downloaded from Overview and scrubs source text and original locators. It still
contains sensitive career state and must be protected. Artifact bytes are not
included unless explicitly selected by a future supported export path.

## Troubleshooting

- `workspace_unsafe`: choose a new absolute ordinary directory outside protected
  roots and links.
- `revision_conflict`: refresh; another accepted mutation won the
  optimistic-concurrency race.
- `capability_unavailable`: inspect Diagnostics and exact pins; never substitute
  a model, reasoning level, DSH revision, or RLM runtime.
- `artifact_unsealed`: stop, preserve the workspace, verify backup/artifact
  digest, and do not trust the affected output.
- SQLite integrity not `ok`: stop immediately and restore a verified backup; do
  not copy WAL files into another live database.
- Import fingerprint changed/expired: preview the source again and review the
  new mappings.
- SSE disconnected: the UI reconnects from its last event ID; use Activity and
  Diagnostics to distinguish recovery from terminal completion.
- RLM restore rejected: retain the digest error, start new work, and never
  replay historical cells.
- Port remains open: stop the owning server/DSH/Jupyter process tree before
  restart; do not start a second backend on the workspace.
