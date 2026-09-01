import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { defineConfig } from "vitest/config";

// macOS exposes its temporary directory through /var, a system symlink to
// /private/var. Keep the production guard strict and give every test worker the
// canonical spelling before it creates a workspace beneath that directory.
if (process.platform === "darwin") {
  process.env["TMPDIR"] = realpathSync(tmpdir());
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
