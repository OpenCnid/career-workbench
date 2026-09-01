import { execFileSync } from "node:child_process";
import { cp, copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

interface PackResult {
  name: string;
  version: string;
  filename: string;
  files: { path: string }[];
}

const packageDirectories = [
  "packages/contracts",
  "packages/dsh-plugin",
  "vendor/deepseek-rlm/packages/rlm",
  "vendor/deepseek-rlm/packages/prime-runtime",
  "vendor/deepseek-rlm/packages/rlm-jupyter",
  "vendor/deepseek-rlm/packages/tool-ipython",
  "vendor/deepseek-rlm/packages/bundle",
] as const;
const root = resolve(".");
const release = resolve(root, "release");
if (!release.startsWith(`${root}${sep}`)) {
  throw new Error("Release output escaped the repository.");
}
await rm(release, { recursive: true, force: true });
await mkdir(resolve(release, "packages"), { recursive: true });

const inventory = [];
const pnpmEntrypoint = process.env["npm_execpath"];
const runtimeAssets = resolve(
  root,
  "vendor/deepseek-rlm/packages/prime-runtime/python",
);
await mkdir(runtimeAssets, { recursive: true });
await Promise.all([
  cp(
    resolve(root, "vendor/deepseek-rlm/vendor/prime-agent-runtime"),
    resolve(runtimeAssets, "prime-agent-runtime"),
    { recursive: true },
  ),
  cp(
    resolve(root, "vendor/deepseek-rlm/python/dsh-rlm-runtime"),
    resolve(runtimeAssets, "dsh-rlm-runtime"),
    { recursive: true },
  ),
  copyFile(
    resolve(root, "vendor/deepseek-rlm/python/managed-requirements.lock"),
    resolve(runtimeAssets, "managed-requirements.lock"),
  ),
]);
try {
  for (const directory of packageDirectories) {
    const result = JSON.parse(
      execFileSync(
        pnpmEntrypoint === undefined ? "pnpm" : process.execPath,
        [
          ...(pnpmEntrypoint === undefined ? [] : [pnpmEntrypoint]),
          "pack",
          "--json",
          "--pack-destination",
          resolve(release, "packages"),
        ],
        {
          cwd: resolve(root, directory),
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        },
      ),
    ) as PackResult;
    const filename = basename(result.filename);
    const archive = resolve(release, "packages", filename);
    inventory.push({
      name: result.name,
      version: result.version,
      filename,
      bytes: (await stat(archive)).size,
      files: result.files.map((file) => file.path).sort(),
    });
  }
} finally {
  await rm(runtimeAssets, { recursive: true, force: true });
}
await writeFile(
  resolve(release, "package-inventory.json"),
  `${JSON.stringify({ schemaVersion: 1, packages: inventory }, null, 2)}\n`,
);
console.log(`packed ${String(inventory.length)} installable packages`);
