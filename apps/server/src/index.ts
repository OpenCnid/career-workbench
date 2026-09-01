import { access, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";

export const SERVER_VERSION = "0.1.0-preview.0" as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const testMode = process.argv.includes("--test");
  let cleanupRoot: string | null = null;
  const configuredRoot = process.env["CAREER_WORKBENCH_ROOT"];
  let workspaceRoot: string;
  if (configuredRoot !== undefined) {
    workspaceRoot = configuredRoot;
  } else if (testMode) {
    cleanupRoot = await mkdtemp(join(tmpdir(), "career-workbench-e2e-"));
    workspaceRoot = join(cleanupRoot, "workspace");
  } else {
    workspaceRoot = join(homedir(), ".career-workbench", "default");
  }
  const port = testMode
    ? 4173
    : Number(process.env["CAREER_WORKBENCH_PORT"] ?? "4317");
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("Configured server port is invalid.");
  }
  const webRoot = resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../web/dist",
  );
  const dshToken =
    process.env["CAREER_WORKBENCH_DSH_TOKEN"] ??
    (testMode ? "synthetic-e2e-dsh-token-00000000000000000000" : undefined);
  const server = await createServer({
    workspaceRoot,
    ...(dshToken === undefined ? {} : { dshToken }),
    rlmEnabled: process.env["CAREER_WORKBENCH_RLM_ENABLED"] === "1",
    ...((await exists(webRoot)) ? { webRoot } : {}),
  });
  await server.listen({ host: "127.0.0.1", port });

  const shutdown = async (): Promise<void> => {
    await server.close();
    if (cleanupRoot?.startsWith(tmpdir()) === true) {
      await rm(cleanupRoot, { recursive: true, force: true });
    }
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

export { createServer } from "./server.js";
