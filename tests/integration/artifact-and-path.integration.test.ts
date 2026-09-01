import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { UtcTimestamp } from "../../packages/domain/src/index.js";
import {
  ContentAddressedArtifactStore,
  SqliteWorkspaceStore,
  assertSafeWorkspaceRoot,
  resolveWorkspaceRelative,
} from "../../packages/storage/src/index.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (root.startsWith(tmpdir()))
      await rm(root, { recursive: true, force: true });
  }
});

describe("workspace and artifact safety", () => {
  it("rejects protected, relative, escaping, and alternate-stream paths", async () => {
    await expect(
      assertSafeWorkspaceRoot("relative/workspace"),
    ).rejects.toMatchObject({
      code: "workspace_unsafe",
    });
    await expect(assertSafeWorkspaceRoot(homedir())).rejects.toMatchObject({
      code: "workspace_unsafe",
    });
    expect(() => resolveWorkspaceRelative(tmpdir(), "../escape")).toThrow(
      /unsafe|escaped/u,
    );
    if (process.platform === "win32") {
      expect(() =>
        resolveWorkspaceRelative(tmpdir(), "artifact.txt:secret"),
      ).toThrow(/Alternate/u);
    }
    await expect(
      assertSafeWorkspaceRoot(join(tmpdir(), ".config", "gcloud", "workspace")),
    ).rejects.toMatchObject({ code: "workspace_unsafe" });
  });

  it("canonicalizes Windows alias-like spellings without accepting links", async () => {
    if (process.platform !== "win32") return;
    const parent = await mkdtemp(join(tmpdir(), "career-workbench-alias-"));
    roots.push(parent);
    const canonicalParent = await realpath(parent);
    await expect(
      assertSafeWorkspaceRoot(join(parent.toUpperCase(), "workspace")),
    ).resolves.toBe(join(canonicalParent, "workspace"));
  });

  it("rejects a linked workspace ancestor where the OS exposes it", async () => {
    const parent = await mkdtemp(join(tmpdir(), "career-workbench-link-"));
    roots.push(parent);
    const actual = join(parent, "actual");
    const linked = join(parent, "linked");
    await mkdir(actual);
    try {
      await symlink(
        actual,
        linked,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }
    await expect(
      assertSafeWorkspaceRoot(join(linked, "workspace")),
    ).rejects.toMatchObject({
      code: "workspace_unsafe",
    });
  });

  it("seals by digest, enforces limits, detects replacement, and cleans interruption residue", async () => {
    const root = await mkdtemp(join(tmpdir(), "career-workbench-artifact-"));
    roots.push(root);
    await mkdir(join(root, "artifacts"));
    const store = new ContentAddressedArtifactStore(root, 64);
    const sealed = await store.seal(
      new TextEncoder().encode("synthetic report"),
      "text/plain",
    );
    expect(new TextDecoder().decode(await store.read(sealed))).toBe(
      "synthetic report",
    );
    await expect(
      store.seal(new Uint8Array(65), "text/plain"),
    ).rejects.toMatchObject({
      code: "artifact_limit_exceeded",
    });
    await writeFile(join(root, sealed.relativePath), "tampered", { flag: "w" });
    await expect(store.read(sealed)).rejects.toMatchObject({
      code: "artifact_unsealed",
    });
    await store.initialize();
    await writeFile(
      join(root, "artifacts/.staging/interrupted.part"),
      "partial",
    );
    expect(await store.cleanupStaging()).toBe(1);
    await expect(
      readFile(join(root, "artifacts/.staging/interrupted.part")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails closed when the canonical SQLite file is corrupt", async () => {
    const root = await mkdtemp(join(tmpdir(), "career-workbench-corrupt-"));
    roots.push(root);
    await writeFile(
      join(root, "career-workbench.sqlite"),
      "not a sqlite database",
    );
    await expect(
      SqliteWorkspaceStore.open(
        root,
        "2026-01-15T12:00:00.000Z" as UtcTimestamp,
      ),
    ).rejects.toThrow();
  });
});
