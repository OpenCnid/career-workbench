import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";
import { ALL_PUBLIC_SCHEMAS } from "../packages/contracts/src/index.js";

const output = resolve("packages/contracts/schemas/v1");
await mkdir(output, { recursive: true });
for (const schema of ALL_PUBLIC_SCHEMAS) {
  const id = schema.$id;
  if (typeof id !== "string")
    throw new Error("Every public schema needs an $id.");
  await writeFile(
    resolve(output, `${id}.schema.json`),
    await format(JSON.stringify(schema), { parser: "json" }),
  );
}
console.log(`validated ${String(ALL_PUBLIC_SCHEMAS.length)} public schemas`);
