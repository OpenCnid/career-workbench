import { homedir, platform } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { DomainError } from "@career-workbench/domain";

function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const resolved = resolve(value).replace(/[\\/]+$/u, "");
    return platform() === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(resolve(root), resolve(candidate));
  return (
    path.length > 0 &&
    path !== ".." &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
}

async function rejectLinkedExistingAncestors(candidate: string): Promise<void> {
  const root = parse(candidate).root;
  const parts = relative(root, candidate).split(/[\\/]/u).filter(Boolean);
  let cursor = root;
  for (const part of parts) {
    cursor = resolve(cursor, part);
    try {
      const stats = await lstat(cursor);
      if (stats.isSymbolicLink()) {
        throw new DomainError(
          "workspace_unsafe",
          "Workspace paths cannot contain links or junctions.",
        );
      }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

async function canonicalizeExistingPrefix(candidate: string): Promise<string> {
  let cursor = candidate;
  const missingParts: string[] = [];
  for (;;) {
    try {
      const canonical = await realpath(cursor);
      return resolve(canonical, ...missingParts.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(cursor);
      if (samePath(parent, cursor)) throw error;
      missingParts.push(basename(cursor));
      cursor = parent;
    }
  }
}

function containsCredentialMarker(candidate: string): boolean {
  const normalized = candidate.replace(/\\/gu, "/").toLowerCase();
  return [".ssh", ".aws", ".config/gcloud", "user data", "browser"].some(
    (marker) => normalized.includes(marker),
  );
}

export async function assertSafeWorkspaceRoot(
  candidate: string,
): Promise<string> {
  if (!isAbsolute(candidate)) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace root must be absolute.",
    );
  }
  const parsed = parse(candidate);
  const resolved = resolve(candidate);
  if (samePath(parsed.root, resolved)) {
    throw new DomainError(
      "workspace_unsafe",
      "A drive or filesystem root cannot be a workspace.",
    );
  }
  if (candidate.split(/[\\/]/u).includes("..")) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace root cannot contain parent traversal.",
    );
  }
  const withoutDrive = candidate.slice(parsed.root.length);
  if (platform() === "win32" && withoutDrive.includes(":")) {
    throw new DomainError(
      "workspace_unsafe",
      "Alternate data stream paths are not allowed.",
    );
  }
  const forbidden = [
    homedir(),
    process.cwd(),
    process.env["CODEX_HOME"],
    process.env["DSH_HOME"],
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (forbidden.some((root) => samePath(root, resolved))) {
    throw new DomainError(
      "workspace_unsafe",
      "The selected location is a protected root.",
    );
  }
  if (containsCredentialMarker(resolved)) {
    throw new DomainError(
      "workspace_unsafe",
      "Credential and browser-profile locations are not allowed.",
    );
  }
  await rejectLinkedExistingAncestors(resolved);
  const canonical = await canonicalizeExistingPrefix(resolved);
  await rejectLinkedExistingAncestors(canonical);
  const canonicalForbidden = await Promise.all(
    forbidden.map((root) => canonicalizeExistingPrefix(resolve(root))),
  );
  if (canonicalForbidden.some((root) => samePath(root, canonical))) {
    throw new DomainError(
      "workspace_unsafe",
      "The selected location is a protected root.",
    );
  }
  if (containsCredentialMarker(canonical)) {
    throw new DomainError(
      "workspace_unsafe",
      "Credential and browser-profile locations are not allowed.",
    );
  }
  if (
    forbidden.some((root) => isWithin(resolved, root)) ||
    canonicalForbidden.some((root) => isWithin(canonical, root))
  ) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace root cannot contain a protected root.",
    );
  }
  return canonical;
}

export function resolveWorkspaceRelative(
  root: string,
  relativePath: string,
): string {
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/u).includes("..")) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace-relative path is unsafe.",
    );
  }
  if (platform() === "win32" && relativePath.includes(":")) {
    throw new DomainError(
      "workspace_unsafe",
      "Alternate data stream paths are not allowed.",
    );
  }
  const candidate = resolve(root, relativePath);
  if (!isWithin(root, candidate)) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace-relative path escaped the root.",
    );
  }
  return candidate;
}
