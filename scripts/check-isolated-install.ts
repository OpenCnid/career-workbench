import { execFileSync } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

interface Inventory {
  packages: { name: string; filename: string }[];
}

const inventory = JSON.parse(
  await readFile("release/package-inventory.json", "utf8"),
) as Inventory;
const temporary = await mkdtemp(join(tmpdir(), "career-workbench-isolated-"));
try {
  const packagesDirectory = join(temporary, "packages");
  await cp(resolve("release/packages"), packagesDirectory, {
    recursive: true,
    errorOnExist: true,
  });
  const localDependencies = Object.fromEntries(
    inventory.packages.map((item) => [item.name, "0.1.0-preview.0"]),
  );
  const localWorkspace = join(temporary, "local");
  await mkdir(localWorkspace);
  for (const [index, item] of inventory.packages.entries()) {
    const destination = join(localWorkspace, `package-${String(index)}`);
    await mkdir(destination);
    execFileSync(
      "tar",
      [
        "-xzf",
        join(packagesDirectory, basename(item.filename)),
        "-C",
        destination,
      ],
      { stdio: "pipe" },
    );
  }
  const packageJson = {
    name: "career-workbench-isolated-check",
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager: "pnpm@11.24.0",
    dependencies: {
      ...localDependencies,
      "@deepseek-ai/cordis": "4.0.2",
      "@deepseek-ai/dsh-agent": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-agent-loop": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-code-runtime": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-attachment": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-invariants": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-llm": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-jobs": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-sandbox": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-scope": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session-persistence": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session-persistence-jsonl": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session-projection": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session-query": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-session-title": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-settings": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-subagent": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-subagent-in-process-driver": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-subagent-spawn-in-process": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-system-prompt": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-timeout": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-tool-todo": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-tools": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-typert-protocol": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-user-approval": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-util-crypto": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-util-time": "0.1.2-alpha.3",
      "@deepseek-ai/dsh-util-values": "0.1.2-alpha.3",
    },
    pnpm: {
      patchedDependencies: {
        "@deepseek-ai/dsh-llm-pi-ai@0.1.2-alpha.3":
          "patches/dsh-llm-pi-ai.patch",
        "@deepseek-ai/dsh-session@0.1.2-alpha.3": "patches/dsh-session.patch",
        "@deepseek-ai/dsh-subagent@0.1.2-alpha.3": "patches/dsh-subagent.patch",
      },
    },
  };
  await writeFile(
    join(temporary, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await mkdir(join(temporary, "patches"));
  await copyFile(
    resolve(
      "provenance/patches/npm/@deepseek-ai__dsh-session@0.1.2-alpha.3.patch",
    ),
    join(temporary, "patches/dsh-session.patch"),
  );
  await copyFile(
    resolve(
      "provenance/patches/npm/@deepseek-ai__dsh-llm-pi-ai@0.1.2-alpha.3.patch",
    ),
    join(temporary, "patches/dsh-llm-pi-ai.patch"),
  );
  await copyFile(
    resolve(
      "provenance/patches/npm/@deepseek-ai__dsh-subagent@0.1.2-alpha.3.patch",
    ),
    join(temporary, "patches/dsh-subagent.patch"),
  );
  await writeFile(
    join(temporary, "pnpm-workspace.yaml"),
    [
      "packages:",
      '  - "local/*/package"',
      "linkWorkspacePackages: true",
      "allowBuilds:",
      "  zeromq: false",
      "onlyBuiltDependencies: []",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(temporary, "verify.mjs"),
    [
      'const plugin = await import("@career-workbench/dsh-plugin");',
      'const bundle = await import("@deepseek-rlm/dsh-rlm-bundle");',
      'const contracts = await import("@career-workbench/contracts");',
      'const runtime = await import("@deepseek-rlm/dsh-rlm-prime-runtime");',
      'if (plugin.manifest.revision !== "dd6322d604e00eec1ba5e0c8541159906a21094a") throw new Error("plugin revision mismatch");',
      'if (plugin.manifest.tools.length < 15) throw new Error("plugin tools missing");',
      'if (bundle.bundleVersion !== "0.1.0-preview.0") throw new Error("bundle version mismatch");',
      'if (typeof contracts.parseContract !== "function") throw new Error("contracts runtime missing");',
      "const assets = await runtime.resolvePythonRuntimeAssets();",
      'if (!assets.requirementsLock.endsWith("managed-requirements.lock")) throw new Error("Python runtime assets missing");',
    ].join("\n"),
  );
  const pnpmEntrypoint = process.env["npm_execpath"];
  try {
    execFileSync(
      pnpmEntrypoint === undefined ? "pnpm" : process.execPath,
      [
        ...(pnpmEntrypoint === undefined ? [] : [pnpmEntrypoint]),
        "install",
        "--ignore-scripts",
        "--config.auto-install-peers=false",
        "--reporter=append-only",
      ],
      { cwd: temporary, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    const output = String(
      (error as { stdout?: Uint8Array }).stdout ?? "installation failed",
    );
    const diagnostic = output
      .split(/\r?\n/u)
      .find((line) => line.includes("ERR_PNPM"));
    throw new Error(diagnostic ?? "Isolated pnpm installation failed.", {
      cause: error,
    });
  }
  execFileSync(process.execPath, ["verify.mjs"], {
    cwd: temporary,
    stdio: "pipe",
  });
  console.log(
    `isolated install/import passed for ${String(inventory.packages.length)} local packages with exact DSH peers`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
