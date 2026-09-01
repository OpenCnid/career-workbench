import { readFile } from "node:fs/promises";

const packages = [
  "apps/server",
  "apps/web",
  "packages/contracts",
  "packages/domain",
  "packages/storage",
  "packages/application",
  "packages/dsh-plugin",
  "packages/career-ops-import",
  "packages/evals",
];
for (const directory of packages) {
  const manifest = JSON.parse(
    await readFile(`${directory}/package.json`, "utf8"),
  ) as {
    name?: string;
    version?: string;
    license?: string;
  };
  if (
    manifest.name === undefined ||
    manifest.version !== "0.1.0-preview.0" ||
    manifest.license !== "MIT"
  ) {
    throw new Error(`Invalid package manifest: ${directory}.`);
  }
}
console.log(`inspected ${String(packages.length)} package manifests`);
