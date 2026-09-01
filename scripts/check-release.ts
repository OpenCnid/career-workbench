import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

interface Inventory {
  schemaVersion: number;
  packages: {
    name: string;
    version: string;
    filename: string;
    bytes: number;
    files: string[];
  }[];
}

const expected = [
  "@career-workbench/domain",
  "@career-workbench/storage",
  "@career-workbench/application",
  "@career-workbench/career-ops-import",
  "@career-workbench/contracts",
  "@career-workbench/dsh-plugin",
  "@career-workbench/web",
  "@career-workbench/server",
  "@deepseek-rlm/dsh-rlm",
  "@deepseek-rlm/dsh-rlm-prime-runtime",
  "@deepseek-rlm/dsh-rlm-jupyter",
  "@deepseek-rlm/dsh-tool-ipython",
  "@deepseek-rlm/dsh-rlm-bundle",
].sort();
const packageDirectories: Readonly<Record<string, string>> = {
  "@career-workbench/domain": "packages/domain",
  "@career-workbench/storage": "packages/storage",
  "@career-workbench/application": "packages/application",
  "@career-workbench/career-ops-import": "packages/career-ops-import",
  "@career-workbench/contracts": "packages/contracts",
  "@career-workbench/dsh-plugin": "packages/dsh-plugin",
  "@career-workbench/web": "apps/web",
  "@career-workbench/server": "apps/server",
  "@deepseek-rlm/dsh-rlm": "vendor/deepseek-rlm/packages/rlm",
  "@deepseek-rlm/dsh-rlm-prime-runtime":
    "vendor/deepseek-rlm/packages/prime-runtime",
  "@deepseek-rlm/dsh-rlm-jupyter": "vendor/deepseek-rlm/packages/rlm-jupyter",
  "@deepseek-rlm/dsh-tool-ipython": "vendor/deepseek-rlm/packages/tool-ipython",
  "@deepseek-rlm/dsh-rlm-bundle": "vendor/deepseek-rlm/packages/bundle",
};
const inventory = JSON.parse(
  await readFile("release/package-inventory.json", "utf8"),
) as Inventory;
if (
  inventory.schemaVersion !== 1 ||
  JSON.stringify(inventory.packages.map((item) => item.name).sort()) !==
    JSON.stringify(expected)
) {
  throw new Error("Release package inventory is incomplete.");
}
for (const item of inventory.packages) {
  if (
    item.version !== "0.1.0-preview.0" ||
    item.bytes < 100 ||
    item.files.length === 0 ||
    item.files.some(
      (file) =>
        /(?:^|\/)(?:tests?|node_modules|\.env)(?:\/|$)|\.sqlite|\.pyc$/iu.test(
          file,
        ) || file.startsWith("src/"),
    )
  ) {
    throw new Error(`Unsafe or incomplete package inventory: ${item.name}.`);
  }
  const archivePath = resolve("release/packages", item.filename);
  if ((await stat(archivePath)).size !== item.bytes) {
    throw new Error(
      `Archive byte count does not match inventory: ${item.name}.`,
    );
  }
  const packageDirectory = packageDirectories[item.name];
  if (packageDirectory === undefined) {
    throw new Error(`Package source mapping is absent: ${item.name}.`);
  }
  const sourceManifest = JSON.parse(
    await readFile(resolve(packageDirectory, "package.json"), "utf8"),
  ) as { exports?: unknown; bin?: unknown; files?: unknown };
  const packedManifest = JSON.parse(
    execFileSync("tar", ["-xOf", archivePath, "package/package.json"], {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    }),
  ) as { exports?: unknown; bin?: unknown; files?: unknown };
  for (const field of ["exports", "bin", "files"] as const) {
    if (
      JSON.stringify(packedManifest[field]) !==
      JSON.stringify(sourceManifest[field])
    ) {
      throw new Error(`Packed ${item.name} has stale ${field} metadata.`);
    }
  }
  for (const file of item.files.filter(
    (path) => path.startsWith("lib/") || path.startsWith("dist/"),
  )) {
    const sourceBytes = await readFile(resolve(packageDirectory, file));
    const packedBytes = execFileSync(
      "tar",
      ["-xOf", archivePath, `package/${file}`],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    if (!sourceBytes.equals(packedBytes)) {
      throw new Error(
        `Packed ${item.name} contains a stale build file: ${file}.`,
      );
    }
  }
}
const sbom = JSON.parse(await readFile("sbom.cdx.json", "utf8")) as {
  bomFormat?: string;
  specVersion?: string;
  components?: unknown[];
};
if (
  sbom.bomFormat !== "CycloneDX" ||
  sbom.specVersion !== "1.6" ||
  !Array.isArray(sbom.components) ||
  sbom.components.length < 500
) {
  throw new Error("SBOM is malformed or unexpectedly incomplete.");
}
const checksumLines = (await readFile("release/SHA256SUMS", "utf8"))
  .trim()
  .split("\n");
const expectedChecksumPaths = [
  ...inventory.packages.map((item) =>
    `release/packages/${item.filename}`.replaceAll("\\", "/"),
  ),
  "release/package-inventory.json",
  "sbom.cdx.json",
].sort();
const observedChecksumPaths: string[] = [];
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64}) {2}([^\r\n]+)$/u.exec(line);
  if (match === null) throw new Error("Malformed checksum inventory.");
  const [, expectedDigest, path] = match;
  if (expectedDigest === undefined || path === undefined) {
    throw new Error("Malformed checksum fields.");
  }
  observedChecksumPaths.push(path.replaceAll("\\", "/"));
  const actual = createHash("sha256")
    .update(await readFile(resolve(path)))
    .digest("hex");
  if (actual !== expectedDigest) throw new Error(`Checksum mismatch: ${path}.`);
}
if (
  JSON.stringify(observedChecksumPaths.sort()) !==
  JSON.stringify(expectedChecksumPaths)
) {
  throw new Error(
    "Checksum inventory does not cover exactly the release artifacts.",
  );
}
console.log(
  `verified ${String(inventory.packages.length)} packages, ${String(sbom.components.length)} SBOM components, and ${String(checksumLines.length)} checksums`,
);
