import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, relative } from "node:path";
import { DomainError, type Digest } from "@career-workbench/domain";
import { resolveWorkspaceRelative } from "./path-safety.js";

export interface SealedBytes {
  readonly contentDigest: Digest;
  readonly byteLength: number;
  readonly relativePath: string;
}

export class ContentAddressedArtifactStore {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly maximumBytes = 5 * 1024 * 1024,
  ) {}

  public async initialize(): Promise<void> {
    await mkdir(
      resolveWorkspaceRelative(this.workspaceRoot, "artifacts/.staging"),
      {
        recursive: true,
      },
    );
  }

  public async seal(
    content: Uint8Array,
    mediaType: string,
  ): Promise<SealedBytes> {
    if (content.byteLength === 0 || content.byteLength > this.maximumBytes) {
      throw new DomainError(
        "artifact_limit_exceeded",
        "Artifact byte length is outside the configured limit.",
      );
    }
    if (
      !/^(?:text\/[a-z0-9.+-]+|application\/(?:json|pdf))$/iu.test(mediaType)
    ) {
      throw new DomainError(
        "invalid_request",
        "Artifact media type is not allowed.",
      );
    }
    await this.initialize();
    const digest = createHash("sha256").update(content).digest("hex") as Digest;
    const relativePath = `artifacts/sha256/${digest.slice(0, 2)}/${digest}`;
    const destination = resolveWorkspaceRelative(
      this.workspaceRoot,
      relativePath,
    );
    const staging = resolveWorkspaceRelative(
      this.workspaceRoot,
      `artifacts/.staging/${randomUUID()}.part`,
    );
    await mkdir(dirname(destination), { recursive: true });
    const handle = await open(staging, "wx", 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        await rm(staging, { force: true });
        throw error;
      }
      await rm(staging, { force: true });
      const existing = await readFile(destination);
      if (!existing.equals(Buffer.from(content))) {
        throw new DomainError(
          "artifact_unsealed",
          "Artifact digest collision or replacement detected.",
        );
      }
    }
    const written = await stat(destination);
    if (written.size !== content.byteLength) {
      throw new DomainError(
        "artifact_unsealed",
        "Sealed artifact size does not match metadata.",
      );
    }
    return {
      contentDigest: digest,
      byteLength: content.byteLength,
      relativePath,
    };
  }

  public async read(sealed: SealedBytes): Promise<Uint8Array> {
    const path = resolveWorkspaceRelative(
      this.workspaceRoot,
      sealed.relativePath,
    );
    const bytes = await readFile(path);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (
      digest !== sealed.contentDigest ||
      bytes.byteLength !== sealed.byteLength
    ) {
      throw new DomainError(
        "artifact_unsealed",
        "Artifact bytes failed digest inspection.",
      );
    }
    return bytes;
  }

  public async cleanupStaging(): Promise<number> {
    const directory = resolveWorkspaceRelative(
      this.workspaceRoot,
      "artifacts/.staging",
    );
    try {
      await access(directory, constants.F_OK);
    } catch {
      return 0;
    }
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(directory, { withFileTypes: true });
    let removed = 0;
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".part")) {
        await rm(
          resolveWorkspaceRelative(
            this.workspaceRoot,
            `artifacts/.staging/${entry.name}`,
          ),
        );
        removed += 1;
      }
    }
    return removed;
  }

  public relativeToWorkspace(path: string): string {
    return relative(this.workspaceRoot, path).replaceAll("\\", "/");
  }
}
