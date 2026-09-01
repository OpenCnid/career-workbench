import { homedir, platform } from "node:os";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
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
  const credentialMarkers = [
    ".ssh",
    ".aws",
    ".config/gcloud",
    "User Data",
    "Browser",
  ];
  if (
    credentialMarkers.some((marker) =>
      resolved.toLowerCase().includes(marker.toLowerCase()),
    )
  ) {
    throw new DomainError(
      "workspace_unsafe",
      "Credential and browser-profile locations are not allowed.",
    );
  }
  await rejectLinkedExistingAncestors(resolved);
  try {
    const canonical = await realpath(resolved);
    if (!samePath(canonical, resolved)) {
      throw new DomainError(
        "workspace_unsafe",
        "Workspace root changed during validation.",
      );
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (forbidden.some((root) => isWithin(resolved, root))) {
    throw new DomainError(
      "workspace_unsafe",
      "Workspace root cannot contain a protected root.",
    );
  }
  return resolved;
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
