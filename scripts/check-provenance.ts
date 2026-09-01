import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const expected = new Map([
  ["career-ops", "3a067ee580b7982cf5dd6edf7895112e4e99600b"],
  ["deepseek-harness", "dd6322d604e00eec1ba5e0c8541159906a21094a"],
  ["deepseek-rlm", "0e9f030300f9e5b37b76cdcd3d39bc490a251e79"],
]);
const manifest = JSON.parse(
  await readFile("provenance/upstreams.json", "utf8"),
) as {
  upstreams: {
    name: string;
    revision: string;
    license: string;
    adaptedFiles: {
      source: string;
      destination: string;
      modifications: string;
      license: string;
      sha256: string;
    }[];
  }[];
};
for (const [name, revision] of expected) {
  const item = manifest.upstreams.find((candidate) => candidate.name === name);
  if (
    item?.revision !== revision ||
    item.license !== "MIT" ||
    !Array.isArray(item.adaptedFiles)
  ) {
    throw new Error(`Incomplete provenance for ${name}.`);
  }
  for (const adapted of item.adaptedFiles) {
    if (
      adapted.source.length === 0 ||
      adapted.modifications.length === 0 ||
      adapted.license !== "MIT" ||
      !/^[a-f0-9]{64}$/u.test(adapted.sha256) ||
      adapted.destination.startsWith("/") ||
      /^[A-Za-z]:/u.test(adapted.destination) ||
      adapted.destination.split(/[\\/]/u).includes("..")
    ) {
      throw new Error(`Incomplete adapted-file provenance for ${name}.`);
    }
    const bytes = await readFile(adapted.destination);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== adapted.sha256) {
      throw new Error(
        `Provenance digest mismatch for ${adapted.destination}: ${actual}.`,
      );
    }
  }
}

const rlmFiles = JSON.parse(
  await readFile("provenance/deepseek-rlm-files.json", "utf8"),
) as {
  schemaVersion: number;
  upstream: string;
  revision: string;
  files: { path: string; sha256: string }[];
};
if (
  rlmFiles.schemaVersion !== 1 ||
  rlmFiles.upstream !== "deepseek-rlm" ||
  rlmFiles.revision !== expected.get("deepseek-rlm") ||
  rlmFiles.files.length !== 51
) {
  throw new Error("The retained native RLM source manifest is incomplete.");
}
const retainedPaths = new Set<string>();
for (const retained of rlmFiles.files) {
  if (
    retainedPaths.has(retained.path) ||
    retained.path.startsWith("/") ||
    /^[A-Za-z]:/u.test(retained.path) ||
    retained.path.split(/[\\/]/u).includes("..") ||
    !/^[a-f0-9]{64}$/u.test(retained.sha256)
  ) {
    throw new Error(`Invalid retained RLM path: ${retained.path}.`);
  }
  retainedPaths.add(retained.path);
  const bytes = await readFile(join("vendor", "deepseek-rlm", retained.path));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== retained.sha256) {
    throw new Error(`Retained RLM digest mismatch for ${retained.path}.`);
  }
}
const careerOpsFixtures = JSON.parse(
  await readFile("provenance/career-ops-fixture-files.json", "utf8"),
) as {
  schemaVersion: number;
  upstream: string;
  revision: string;
  license: string;
  files: { source: string; destination: string; sha256: string }[];
};
if (
  careerOpsFixtures.schemaVersion !== 1 ||
  careerOpsFixtures.upstream !== "career-ops" ||
  careerOpsFixtures.revision !== expected.get("career-ops") ||
  careerOpsFixtures.license !== "MIT" ||
  careerOpsFixtures.files.length !== 5
) {
  throw new Error("The retained Career Ops fixture manifest is incomplete.");
}
for (const fixture of careerOpsFixtures.files) {
  if (
    fixture.source.length === 0 ||
    fixture.destination.startsWith("/") ||
    /^[A-Za-z]:/u.test(fixture.destination) ||
    fixture.destination.split(/[\\/]/u).includes("..") ||
    !/^[a-f0-9]{64}$/u.test(fixture.sha256)
  ) {
    throw new Error(
      `Invalid retained Career Ops fixture: ${fixture.destination}.`,
    );
  }
  const bytes = await readFile(fixture.destination);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== fixture.sha256) {
    throw new Error(
      `Career Ops fixture digest mismatch for ${fixture.destination}.`,
    );
  }
}
console.log(
  `validated ${String(expected.size)} upstream records, adapted files, ${String(rlmFiles.files.length)} retained native RLM files, and Career Ops fixtures`,
);
