import type { DiagnosticsResponse } from "@career-workbench/contracts";

type VersionCompatibility = DiagnosticsResponse["runtimeVersions"]["node"];
type UpstreamCompatibility =
  DiagnosticsResponse["compatibility"]["deepSeekHarness"];
type UpstreamIdentity = UpstreamCompatibility["expected"];
type PatchCompatibility =
  DiagnosticsResponse["compatibility"]["patches"][number];

const VERSION = "0.1.0-preview.0";
const NODE_VERSION = "24.19.0";
const PNPM_VERSION = "11.24.0";
const TYPESCRIPT_VERSION = "6.0.3";
const CORDIS_VERSION = "4.0.2";

const DEEPSEEK_HARNESS: UpstreamIdentity = {
  revision: "dd6322d604e00eec1ba5e0c8541159906a21094a",
  tag: "dsh-v0.1.2-alpha.3",
  version: "0.1.2-alpha.3",
};
const NATIVE_RLM: UpstreamIdentity = {
  revision: "0e9f030300f9e5b37b76cdcd3d39bc490a251e79",
  tag: null,
  version: VERSION,
};
const CAREER_OPS: UpstreamIdentity = {
  revision: "3a067ee580b7982cf5dd6edf7895112e4e99600b",
  tag: null,
  version: "1.31.0",
};

const PATCHES: readonly Omit<PatchCompatibility, "resolvedSha256" | "state">[] =
  [
    {
      identity: "0002-continuable-child-deletion.patch",
      sha256:
        "fd1e5d51155e0c0490fe2f3ca94de5b77843f931e32014fc803fdebfe0f74811",
      application: "runtime_package",
    },
    {
      identity: "0003-public-ignorable-session-events.patch",
      sha256:
        "a9635b96a31800631812e26c4e358e734f5cbf4282c69dff380f4d704d68705e",
      application: "runtime_package",
    },
    {
      identity: "0004-pi-ai-agent-session-cleanup.patch",
      sha256:
        "e4bc34169b5fa63c069c4a07c33f05d1c8703ea05ff09a47fecf47264d387efa",
      application: "runtime_package",
    },
    {
      identity: "0005-bounded-process-shutdown.patch",
      sha256:
        "affef51d328b06c8e723054676d73741ea6b93910f9d5dfcad56c2b521babfb0",
      application: "bundle_host",
    },
  ];

export interface CompatibilityResolutionOverrides {
  readonly node?: string;
  readonly pnpm?: string;
  readonly typescript?: string;
  readonly careerWorkbench?: string;
  readonly cordis?: string;
  readonly deepSeekHarness?: Partial<UpstreamIdentity>;
  readonly nativeRlm?: Partial<UpstreamIdentity>;
  readonly careerOps?: Partial<UpstreamIdentity>;
  readonly patchSha256?: Readonly<Record<string, string>>;
}

function versionCompatibility(
  expected: string,
  resolved: string,
): VersionCompatibility {
  return {
    expected,
    resolved,
    state: expected === resolved ? "ready" : "mismatch",
  };
}

function upstreamCompatibility(
  expected: UpstreamIdentity,
  resolved: UpstreamIdentity,
): UpstreamCompatibility {
  return {
    expected,
    resolved,
    state:
      expected.revision === resolved.revision &&
      expected.tag === resolved.tag &&
      expected.version === resolved.version
        ? "ready"
        : "mismatch",
  };
}

export function buildCompatibilityDiagnostics(
  overrides: CompatibilityResolutionOverrides = {},
): Pick<DiagnosticsResponse, "runtimeVersions" | "compatibility"> {
  const runtimeVersions = {
    node: versionCompatibility(
      NODE_VERSION,
      overrides.node ?? process.versions.node,
    ),
    pnpm: versionCompatibility(PNPM_VERSION, overrides.pnpm ?? PNPM_VERSION),
    typescript: versionCompatibility(
      TYPESCRIPT_VERSION,
      overrides.typescript ?? TYPESCRIPT_VERSION,
    ),
    careerWorkbench: versionCompatibility(
      VERSION,
      overrides.careerWorkbench ?? VERSION,
    ),
  } satisfies DiagnosticsResponse["runtimeVersions"];
  const deepSeekHarness = upstreamCompatibility(DEEPSEEK_HARNESS, {
    ...DEEPSEEK_HARNESS,
    ...overrides.deepSeekHarness,
  });
  const nativeRlm = upstreamCompatibility(NATIVE_RLM, {
    ...NATIVE_RLM,
    ...overrides.nativeRlm,
  });
  const careerOps = upstreamCompatibility(CAREER_OPS, {
    ...CAREER_OPS,
    ...overrides.careerOps,
  });
  const cordis = versionCompatibility(
    CORDIS_VERSION,
    overrides.cordis ?? CORDIS_VERSION,
  );
  const patches: PatchCompatibility[] = PATCHES.map((patch) => {
    const resolvedSha256 =
      overrides.patchSha256?.[patch.identity] ?? patch.sha256;
    return {
      ...patch,
      resolvedSha256,
      state: patch.sha256 === resolvedSha256 ? "ready" : "mismatch",
    };
  });
  const mismatches = [
    ...Object.entries(runtimeVersions)
      .filter(([, item]) => item.state === "mismatch")
      .map(([name]) => `runtime.${name}`),
    ...(deepSeekHarness.state === "mismatch"
      ? ["upstream.deepSeekHarness"]
      : []),
    ...(nativeRlm.state === "mismatch" ? ["upstream.nativeRlm"] : []),
    ...(careerOps.state === "mismatch" ? ["upstream.careerOps"] : []),
    ...(cordis.state === "mismatch" ? ["runtime.cordis"] : []),
    ...patches
      .filter((patch) => patch.state === "mismatch")
      .map((patch) => `patch.${patch.identity}`),
  ];
  return {
    runtimeVersions,
    compatibility: {
      state: mismatches.length === 0 ? "ready" : "mismatch",
      mismatches,
      deepSeekHarness,
      nativeRlm,
      careerOps,
      cordis,
      patches,
    },
  };
}

export const CAREER_WORKBENCH_VERSION = VERSION;
