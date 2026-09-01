import { resolve } from "node:path";
import {
  SqliteWorkspaceStore,
  restoreWorkspaceBackup,
} from "../packages/storage/src/index.js";
import type { UtcTimestamp } from "../packages/domain/src/index.js";

const [operation, rootArgument, label] = process.argv.slice(2);
if (
  !["health", "backup", "restore"].includes(operation ?? "") ||
  rootArgument === undefined ||
  ((operation === "backup" || operation === "restore") && label === undefined)
) {
  throw new Error(
    "Usage: pnpm workspace:admin <health|backup|restore> <absolute-workspace-root> [backup-label]",
  );
}
const root = resolve(rootArgument);
const now = new Date().toISOString() as UtcTimestamp;

if (operation === "restore") {
  const restored = await restoreWorkspaceBackup(root, label ?? "", now);
  try {
    const health = await restored.store.health();
    console.log(
      JSON.stringify({
        operation: "restore",
        restoredLabel: label,
        rollback: restored.rollbackRelativePath,
        schemaVersion: health.schemaVersion,
        integrity: health.integrity,
      }),
    );
  } finally {
    await restored.store.close();
  }
} else {
  const store = await SqliteWorkspaceStore.open(root, now);
  try {
    if (operation === "backup") {
      const path = await store.backup(label ?? "");
      console.log(JSON.stringify({ operation: "backup", path }));
    } else {
      const health = await store.health();
      console.log(JSON.stringify({ operation: "health", ...health }));
    }
  } finally {
    await store.close();
  }
}
