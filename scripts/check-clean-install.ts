import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

const repository = resolve(".");
const temporary = await mkdtemp(
  join(tmpdir(), "career-workbench-clean-install-"),
);
const checkout = join(temporary, "source");
const lockfileOnly = process.argv.includes("--lockfile-only");
const excluded = new Set([
  ".git",
  "node_modules",
  "playwright-report",
  "release",
  "test-results",
]);

try {
  await cp(repository, checkout, {
    recursive: true,
    filter(source) {
      const path = relative(repository, source);
      if (path.length === 0) return true;
      return !path.split(sep).some((segment) => excluded.has(segment));
    },
  });
  const pnpmEntrypoint = process.env["npm_execpath"];
  let installDiagnostic: string | undefined;
  try {
    execFileSync(
      pnpmEntrypoint === undefined ? "pnpm" : process.execPath,
      [
        ...(pnpmEntrypoint === undefined ? [] : [pnpmEntrypoint]),
        "install",
        "--frozen-lockfile",
        ...(lockfileOnly ? ["--ignore-scripts"] : []),
        "--reporter=append-only",
      ],
      {
        cwd: checkout,
        env: {
          ...process.env,
          ...(process.env["CW_NODE_GYP_PYTHON"] === undefined
            ? {}
            : {
                npm_config_python: process.env["CW_NODE_GYP_PYTHON"],
              }),
        },
        stdio: "pipe",
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (error) {
    const output = String(
      (error as { stdout?: Uint8Array }).stdout ?? "installation failed",
    );
    const diagnostic = output
      .split(/\r?\n/u)
      .filter((line) => /ERR_PNPM|ELIFECYCLE|Error:/u.test(line))
      .slice(-3)
      .join("; ");
    installDiagnostic = diagnostic || "no package-manager diagnostic";
  }
  if (installDiagnostic !== undefined) {
    throw new Error(`Clean frozen install failed: ${installDiagnostic}.`);
  }
  process.stdout.write(
    lockfileOnly
      ? "clean frozen lockfile install passed in an isolated workspace\n"
      : "clean frozen install passed in an isolated workspace\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
