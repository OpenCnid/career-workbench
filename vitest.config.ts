import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { defineConfig } from "vitest/config";

// macOS exposes /var through /private/var, while hosted Windows can expose the
// temp directory through an 8.3 alias. Keep the production guard strict and
// give every test worker a canonical temp root before it creates a workspace.
const canonicalTempDirectory = realpathSync(tmpdir());
if (process.platform === "win32") {
  process.env["TEMP"] = canonicalTempDirectory;
  process.env["TMP"] = canonicalTempDirectory;
} else if (process.platform === "darwin") {
  process.env["TMPDIR"] = canonicalTempDirectory;
}

const include = (kind: string) => [
  `**/*.${kind}.test.ts`,
  `**/*.${kind}.test.tsx`,
];

export default defineConfig({
  test: {
    coverage: { provider: "v8", reporter: ["text", "json-summary"] },
    projects: [
      { test: { name: "unit", include: include("unit") } },
      { test: { name: "property", include: include("property") } },
      { test: { name: "contract", include: include("contract") } },
      {
        test: {
          name: "integration",
          include: include("integration"),
          testTimeout: 30_000,
        },
      },
      { test: { name: "security", include: include("security") } },
    ],
  },
});
