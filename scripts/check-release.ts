import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
  "@career-workbench/contracts",
  "@career-workbench/dsh-plugin",
  "@deepseek-rlm/dsh-rlm",
  "@deepseek-rlm/dsh-rlm-prime-runtime",
  "@deepseek-rlm/dsh-rlm-jupyter",
  "@deepseek-rlm/dsh-tool-ipython",
  "@deepseek-rlm/dsh-rlm-bundle",
].sort();
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
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64}) {2}([^\r\n]+)$/u.exec(line);
  if (match === null) throw new Error("Malformed checksum inventory.");
  const [, expectedDigest, path] = match;
  if (expectedDigest === undefined || path === undefined) {
    throw new Error("Malformed checksum fields.");
  }
  const actual = createHash("sha256")
    .update(await readFile(resolve(path)))
    .digest("hex");
  if (actual !== expectedDigest) throw new Error(`Checksum mismatch: ${path}.`);
}
console.log(
  `verified ${String(inventory.packages.length)} packages, ${String(sbom.components.length)} SBOM components, and ${String(checksumLines.length)} checksums`,
);
