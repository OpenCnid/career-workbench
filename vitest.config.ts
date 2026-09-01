import { defineConfig } from "vitest/config";

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
