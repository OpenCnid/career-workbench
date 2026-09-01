import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(".");
const release = resolve(root, "release");
const inventory = JSON.parse(
  await readFile(resolve(release, "package-inventory.json"), "utf8"),
) as { packages: { filename: string }[] };
const releaseFiles = [
  resolve(release, "package-inventory.json"),
  ...inventory.packages.map((item) =>
    resolve(release, "packages", item.filename),
  ),
];
const files = [resolve(root, "sbom.cdx.json"), ...releaseFiles].sort();
const lines: string[] = [];
for (const file of files) {
  const path = relative(root, file).replaceAll("\\", "/");
  lines.push(
    `${createHash("sha256")
      .update(await readFile(file))
      .digest("hex")}  ${path}`,
  );
}
await writeFile(resolve(release, "SHA256SUMS"), `${lines.join("\n")}\n`);
console.log(`wrote ${String(files.length)} SHA-256 checksums`);
