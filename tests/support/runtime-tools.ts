import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

async function executableExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves uv without retaining a developer-specific absolute path in source or
 * test evidence. CI normally supplies uv on PATH; the WinGet search supports a
 * standard local developer installation.
 */
export async function resolveUvDirectory(): Promise<string | undefined> {
  const explicit = process.env["CW_UV_PATH"];
  if (explicit !== undefined && (await executableExists(explicit))) {
    return explicit.replace(/[\\/][^\\/]+$/u, "");
  }

  const localAppData = process.env["LOCALAPPDATA"];
  if (localAppData === undefined) {
    return undefined;
  }

  const link = join(localAppData, "Microsoft", "WinGet", "Links", "uv.exe");
  if (await executableExists(link)) {
    return link.replace(/[\\/][^\\/]+$/u, "");
  }

  const packages = join(localAppData, "Microsoft", "WinGet", "Packages");
  try {
    for (const entry of await readdir(packages, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("astral-sh.uv_")) {
        continue;
      }
      const candidate = join(packages, entry.name, "uv.exe");
      if (await executableExists(candidate)) {
        return join(packages, entry.name);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
