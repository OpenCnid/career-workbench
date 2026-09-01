import { execFileSync, spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { once } from "node:events";

interface Inventory {
  packages: { name: string; filename: string }[];
}

const productPackages = new Set([
  "@career-workbench/contracts",
  "@career-workbench/domain",
  "@career-workbench/storage",
  "@career-workbench/application",
  "@career-workbench/career-ops-import",
  "@career-workbench/web",
  "@career-workbench/server",
]);

async function availablePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not allocate a loopback smoke-test port.");
  }
  await new Promise<void>((resolveClose, reject) =>
    probe.close((error) =>
      error === undefined ? resolveClose() : reject(error),
    ),
  );
  return address.port;
}

function processIsRunning(process: ReturnType<typeof spawn>): boolean {
  return process.exitCode === null;
}

const inventory = JSON.parse(
  await readFile("release/package-inventory.json", "utf8"),
) as Inventory;
const selected = inventory.packages.filter((item) =>
  productPackages.has(item.name),
);
if (selected.length !== productPackages.size) {
  throw new Error("Packaged-product smoke inventory is incomplete.");
}

const temporary = await mkdtemp(join(tmpdir(), "career-workbench-product-"));
let child: ReturnType<typeof spawn> | undefined;
try {
  const local = join(temporary, "local");
  await mkdir(local);
  for (const [index, item] of selected.entries()) {
    const destination = join(local, `package-${String(index)}`);
    await mkdir(destination);
    execFileSync(
      "tar",
      [
        "-xzf",
        resolve("release/packages", basename(item.filename)),
        "-C",
        destination,
      ],
      { stdio: "pipe" },
    );
  }
  await writeFile(
    join(temporary, "package.json"),
    `${JSON.stringify(
      {
        name: "career-workbench-packaged-product-smoke",
        version: "0.0.0",
        private: true,
        type: "module",
        packageManager: "pnpm@11.24.0",
        dependencies: Object.fromEntries(
          selected.map((item) => [item.name, "0.1.0-preview.0"]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(temporary, "pnpm-workspace.yaml"),
    [
      "packages:",
      '  - "local/*/package"',
      "linkWorkspacePackages: true",
      "allowBuilds:",
      "  better-sqlite3: true",
      "onlyBuiltDependencies:",
      "  - better-sqlite3",
      "",
    ].join("\n"),
  );
  const pnpmEntrypoint = process.env["npm_execpath"];
  execFileSync(
    pnpmEntrypoint === undefined ? "pnpm" : process.execPath,
    [
      ...(pnpmEntrypoint === undefined ? [] : [pnpmEntrypoint]),
      "install",
      "--config.auto-install-peers=false",
      "--reporter=append-only",
    ],
    {
      cwd: temporary,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(process.env["CW_NODE_GYP_PYTHON"] === undefined
          ? {}
          : { npm_config_python: process.env["CW_NODE_GYP_PYTHON"] }),
      },
    },
  );

  const port = await availablePort();
  const workspaceRoot = join(temporary, "workspace");
  const entrypoint = join(
    temporary,
    "node_modules",
    "@career-workbench",
    "server",
    "lib",
    "index.js",
  );
  await access(entrypoint);
  child = spawn(process.execPath, [entrypoint], {
    cwd: temporary,
    env: {
      ...process.env,
      CAREER_WORKBENCH_ROOT: workspaceRoot,
      CAREER_WORKBENCH_PORT: String(port),
    },
    stdio: "pipe",
    windowsHide: true,
  });
  let response: Response | undefined;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Packaged server exited before readiness: ${String(child.exitCode)}.`,
      );
    }
    try {
      response = await fetch(`http://127.0.0.1:${String(port)}/`);
      if (response.ok) break;
    } catch {
      // The loopback process is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  if (response?.ok !== true) {
    throw new Error("Packaged server did not become ready on loopback.");
  }
  const html = await response.text();
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(
      "Packaged server did not serve the packaged browser build.",
    );
  }
  const apiOrigin = `http://127.0.0.1:${String(port)}`;
  const sessionResponse = await fetch(`${apiOrigin}/api/v1/session`);
  if (!sessionResponse.ok) {
    throw new Error("Packaged server did not create a browser API session.");
  }
  const session = (await sessionResponse.json()) as { csrfToken?: unknown };
  if (typeof session.csrfToken !== "string" || session.csrfToken.length < 16) {
    throw new Error("Packaged server returned an invalid CSRF session.");
  }
  const createResponse = await fetch(`${apiOrigin}/api/v1/workspaces`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `cw_csrf=${session.csrfToken}`,
      origin: apiOrigin,
      "sec-fetch-site": "same-origin",
      "x-cw-csrf": session.csrfToken,
      "x-idempotency-key": "synthetic-packaged-product-workspace",
    },
    body: JSON.stringify({
      displayName: "Synthetic Packaged Product Workspace",
      locale: "en-US",
      timezone: "UTC",
    }),
  });
  if (createResponse.status !== 201) {
    throw new Error(
      `Packaged workspace creation failed with ${String(createResponse.status)}.`,
    );
  }
  const snapshotResponse = await fetch(`${apiOrigin}/api/v1/snapshot`);
  if (!snapshotResponse.ok) {
    throw new Error("Packaged server snapshot query failed.");
  }
  const snapshot = (await snapshotResponse.json()) as {
    workspace?: { displayName?: unknown } | null;
  };
  if (
    snapshot.workspace?.displayName !== "Synthetic Packaged Product Workspace"
  ) {
    throw new Error("Packaged workspace did not survive its snapshot query.");
  }
  await access(join(workspaceRoot, "career-workbench.sqlite"));
  console.log(
    `packaged product smoke passed for ${String(selected.length)} archives with workspace creation, snapshot, native SQLite, and browser assets`,
  );
} finally {
  if (child?.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (processIsRunning(child)) child.kill("SIGKILL");
  }
  await rm(temporary, { recursive: true, force: true });
}
