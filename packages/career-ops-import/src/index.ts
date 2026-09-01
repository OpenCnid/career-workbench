import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
} from "node:path";
import {
  type ApplyCareerOpsImportInput,
  type CareerOpsApplicationInput,
  type CareerOpsImportFileInput,
  type CareerOpsPassiveMappingInput,
  type CareerOpsProfileFactInput,
} from "@career-workbench/application";
import {
  canonicalJson,
  DomainError,
  type Digest,
} from "@career-workbench/domain";
import { parseDocument } from "yaml";

export const CAREER_OPS_REVISION =
  "3a067ee580b7982cf5dd6edf7895112e4e99600b" as const;
export const CAREER_OPS_OBSERVED_VERSION = "1.31.0" as const;

const MAX_FILES = 512;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const headerAliases: Readonly<Record<string, string>> = {
  "#": "num",
  num: "num",
  date: "date",
  fecha: "date",
  company: "company",
  empresa: "company",
  via: "via",
  role: "role",
  puesto: "role",
  location: "location",
  score: "score",
  status: "status",
  pdf: "pdf",
  materials: "pdf",
  report: "report",
  "apply link": "applylink",
  apply: "applylink",
  "follow-up": "followup",
  "follow up": "followup",
  followup: "followup",
  notes: "notes",
  url: "url",
};

const legacyColumns: Readonly<Record<string, number>> = {
  num: 1,
  date: 2,
  company: 3,
  role: 4,
  score: 5,
  status: 6,
  pdf: 7,
  report: 8,
  notes: 9,
};

export interface CareerOpsPreviewFile {
  readonly relativePath: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly contentDigest: string;
  readonly purpose: string;
}

export interface CareerOpsPreviewApplication {
  readonly sourceIdentity: string;
  readonly sourceRelativePath: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalStatus: string;
  readonly mappedState: string;
  readonly originalScore: string | null;
}

export interface CareerOpsImportPreview {
  readonly provider: "career-ops";
  readonly upstreamRevision: typeof CAREER_OPS_REVISION;
  readonly observedVersion: string | null;
  readonly sourceLabel: string;
  readonly sourceFingerprint: string;
  readonly files: readonly CareerOpsPreviewFile[];
  readonly profileFacts: readonly {
    readonly sourceIdentity: string;
    readonly sourceRelativePath: string;
    readonly predicate: string;
    readonly value: string | number | boolean | null;
    readonly confirmationRequired: true;
  }[];
  readonly applications: readonly CareerOpsPreviewApplication[];
  readonly passiveMappings: readonly CareerOpsPassiveMappingInput[];
  readonly warnings: readonly string[];
  readonly unsupported: readonly string[];
}

export interface CareerOpsDiscovery {
  readonly preview: CareerOpsImportPreview;
  /** Server-owned plan. Never accept this structure back from a browser. */
  readonly plan: ApplyCareerOpsImportInput;
}

interface LoadedFile {
  readonly relativePath: string;
  readonly mediaType: string;
  readonly purpose: string;
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly contentDigest: Digest;
}

interface TrackerRow {
  readonly num: number;
  readonly date: string;
  readonly company: string;
  readonly role: string;
  readonly score: string;
  readonly status: string;
  readonly report: string;
  readonly notes: string;
  readonly location: string;
  readonly url: string;
}

function digest(bytes: Uint8Array | string): Digest {
  return createHash("sha256").update(bytes).digest("hex") as Digest;
}

function normalizedRelative(root: string, path: string): string {
  const result = relative(root, path).replaceAll("\\", "/");
  if (
    result.length === 0 ||
    result === ".." ||
    result.startsWith("../") ||
    isAbsolute(result)
  ) {
    throw new DomainError(
      "external_content_rejected",
      "Career Ops source resolved outside the selected directory.",
    );
  }
  return result;
}

async function safeRoot(root: string): Promise<string> {
  if (!isAbsolute(root)) {
    throw new DomainError(
      "invalid_request",
      "Career Ops discovery requires an absolute directory path.",
    );
  }
  const resolved = await realpath(resolve(root));
  const info = await stat(resolved);
  if (!info.isDirectory() || resolved === parse(resolved).root) {
    throw new DomainError(
      "external_content_rejected",
      "Career Ops source must be a bounded directory, not a filesystem root.",
    );
  }
  return resolved;
}

async function collectMarkdownFiles(
  root: string,
  relativeDirectory: string,
  target: Set<string>,
): Promise<void> {
  const directory = join(root, relativeDirectory);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (target.size >= MAX_FILES) return;
      const relativePath = `${relativeDirectory}/${entry.name}`.replaceAll(
        "\\",
        "/",
      );
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await collectMarkdownFiles(root, relativePath, target);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        target.add(relativePath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function mediaTypeFor(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "text/yaml";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".tsv")) return "text/tab-separated-values";
  return "text/plain";
}

function purposeFor(relativePath: string): string {
  if (relativePath === "cv.md") return "candidate CV source";
  if (relativePath === "config/profile.yml") return "profile and preferences";
  if (relativePath.endsWith("applications.md")) return "application tracker";
  if (relativePath.startsWith("reports/")) return "evaluation report";
  if (
    relativePath.includes("job-description") ||
    relativePath.startsWith("jobs/")
  ) {
    return "captured job description";
  }
  if (relativePath === "interview-prep/story-bank.md") {
    return "interview story bank";
  }
  return "custom workflow preference";
}

async function loadSupportedFile(
  root: string,
  relativePath: string,
): Promise<LoadedFile> {
  const path = join(root, ...relativePath.split("/"));
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new DomainError(
      "external_content_rejected",
      "Career Ops import does not follow symbolic links or non-files.",
    );
  }
  const canonical = await realpath(path);
  normalizedRelative(root, canonical);
  if (info.size < 1 || info.size > MAX_FILE_BYTES) {
    throw new DomainError(
      "artifact_limit_exceeded",
      "Career Ops source file is empty or exceeds the supported limit.",
    );
  }
  const bytes = await readFile(canonical);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DomainError(
      "external_content_rejected",
      "Career Ops source file is not valid UTF-8 text.",
    );
  }
  return {
    relativePath,
    mediaType: mediaTypeFor(relativePath),
    purpose: purposeFor(relativePath),
    bytes,
    text,
    contentDigest: digest(bytes),
  };
}

function findColumns(
  lines: readonly string[],
): Readonly<Record<string, number>> {
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const result: Record<string, number> = {};
    line
      .split("|")
      .map((cell) => cell.trim().toLowerCase())
      .forEach((cell, index) => {
        const alias = headerAliases[cell];
        if (alias !== undefined) result[alias] = index;
      });
    if (
      ["num", "company", "role", "score", "status"].every(
        (key) => result[key] !== undefined,
      )
    ) {
      return result;
    }
  }
  return legacyColumns;
}

function parseTracker(text: string, warnings: string[]): TrackerRow[] {
  const lines = text.split(/\r?\n/u);
  const columns = findColumns(lines);
  const rows: TrackerRow[] = [];
  const identities = new Set<string>();
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const at = (name: string): string => {
      const index = columns[name];
      return index === undefined ? "" : (cells[index] ?? "");
    };
    const num = Number.parseInt(at("num"), 10);
    if (!Number.isInteger(num) || num < 1) continue;
    const company = at("company");
    const role = at("role");
    if (company.length === 0 || role.length === 0) {
      warnings.push(
        `Tracker row ${String(num)} was skipped because company or role is empty.`,
      );
      continue;
    }
    const identity = `${String(num)}:${normalizeKey(company)}:${normalizeKey(role)}`;
    if (identities.has(identity)) {
      warnings.push(
        `Duplicate tracker row ${String(num)} (${company} / ${role}) was skipped.`,
      );
      continue;
    }
    identities.add(identity);
    rows.push({
      num,
      date: at("date"),
      company,
      role,
      score: at("score"),
      status: at("status"),
      report: at("report"),
      notes: at("notes"),
      location: at("location"),
      url: at("url") || at("applylink"),
    });
  }
  return rows;
}

export function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u0307/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "")
    .trim();
}

export function mapCareerOpsStatus(
  raw: string,
): CareerOpsApplicationInput["state"] | null {
  const value = raw
    .replaceAll("**", "")
    .trim()
    .toLowerCase()
    .replace(/\s+202\d.*$/u, "");
  if (
    [
      "hired",
      "contratado",
      "contratada",
      "accepted",
      "accept",
      "kabul edildi",
      "kabul_edildi",
      "işe alındı",
      "ise alindi",
      "işe alindi",
    ].includes(value)
  )
    return "hired";
  if (
    value.includes("interview") ||
    value.includes("entrevista") ||
    value.includes("mülakat") ||
    value.includes("mulakat")
  )
    return "interview";
  if (value === "offer" || value.includes("oferta") || value.includes("teklif"))
    return "offer";
  if (
    value.includes("responded") ||
    value.includes("respondido") ||
    value.includes("yanıt verildi") ||
    value.includes("yanıt_verildi") ||
    value.includes("yanit verildi") ||
    value.includes("yanit_verildi")
  )
    return "responded";
  if (
    value.includes("applied") ||
    value.includes("aplicado") ||
    ["enviada", "aplicada", "sent"].includes(value) ||
    value.includes("başvuruldu") ||
    value.includes("basvuruldu")
  )
    return "applied";
  if (
    value.includes("rejected") ||
    value.includes("rechazad") ||
    value.includes("reddedildi")
  )
    return "rejected";
  if (value === "withdrawn") return "withdrawn";
  if (
    value.includes("discarded") ||
    value.includes("descartad") ||
    [
      "cerrada",
      "cancelada",
      "skip",
      "monitor",
      "no aplicar",
      "no_aplicar",
      "geo blocker",
      "geo_blocker",
    ].includes(value) ||
    value.startsWith("duplicado") ||
    value.startsWith("dup") ||
    value.includes("uygun değil") ||
    value.includes("uygun_değil") ||
    value.includes("uygun degil") ||
    value.includes("uygun_degil") ||
    value.includes("iptal edildi") ||
    value.includes("iptal_edildi") ||
    value.includes("ıptal edildi") ||
    value.includes("ıptal_edildi")
  )
    return "closed";
  if (
    value.includes("evaluated") ||
    value.includes("evaluada") ||
    ["condicional", "hold", "evaluar", "verificar"].includes(value) ||
    value.includes("değerlendirildi") ||
    value.includes("degerlendirildi")
  )
    return "considering";
  return null;
}

function reportPathFromCell(
  trackerRelativePath: string,
  value: string,
): string | null {
  const match = /\[[^\]]+\]\(([^)]+)\)/u.exec(value);
  if (match?.[1] === undefined) return null;
  const destination = match[1].trim().replace(/^<|>$/gu, "");
  const target = destination.split(/[?#]/u, 1)[0] ?? "";
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target)) return null;
  const resolved = resolve(dirname(trackerRelativePath), target).replaceAll(
    "\\",
    "/",
  );
  return resolved.startsWith("../") || isAbsolute(resolved) ? null : resolved;
}

function safeUrl(value: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

function effectiveDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function scalarFacts(
  profileText: string,
  warnings: string[],
): CareerOpsProfileFactInput[] {
  const document = parseDocument(profileText, {
    merge: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new DomainError(
      "external_content_rejected",
      "Career Ops profile.yml is not valid YAML.",
    );
  }
  const root = document.toJS({ maxAliasCount: 0 }) as unknown;
  const proposals: CareerOpsProfileFactInput[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown, path: string[]): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, String(index)]));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, entry] of Object.entries(
        value as Record<string, unknown>,
      )) {
        visit(entry, [...path, key]);
      }
      return;
    }
    if (
      !["string", "number", "boolean"].includes(typeof value) &&
      value !== null
    )
      return;
    const predicate = path.join(".");
    if (
      /password|secret|token|credential|cookie|api[_-]?key/iu.test(predicate)
    ) {
      warnings.push(
        `Sensitive profile field ${predicate} was preserved only as sealed source bytes and was not mapped.`,
      );
      return;
    }
    const primitive = value as string | number | boolean | null;
    const identity = `${predicate}:${canonicalJson(primitive)}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    const candidates = [
      typeof primitive === "string" ? primitive : String(primitive),
      typeof primitive === "string" ? JSON.stringify(primitive) : "",
    ].filter(Boolean);
    let start = -1;
    let quote = "";
    for (const candidate of candidates) {
      start = profileText.indexOf(candidate);
      if (start >= 0) {
        quote = candidate;
        break;
      }
    }
    if (start < 0) {
      warnings.push(
        `Profile field ${predicate} could not be located precisely and was not mapped.`,
      );
      return;
    }
    proposals.push({
      sourceRelativePath: "config/profile.yml",
      factType: path[0] ?? "profile",
      subject: "candidate",
      predicate,
      value: primitive,
      start,
      end: start + quote.length,
      quote,
    });
  };
  visit(root, []);
  return proposals.slice(0, 256);
}

function storyMappings(
  file: LoadedFile,
  warnings: string[],
): CareerOpsPassiveMappingInput[] {
  const blocks = file.text.split(/^###\s+/gmu).slice(1);
  if (blocks.length === 0) {
    warnings.push(
      "Story bank was preserved, but no structured `###` story blocks were found.",
    );
  }
  return blocks.slice(0, 100).map((block, index) => {
    const candidateTitle = block.split(/\r?\n/u)[0]?.trim();
    const title =
      candidateTitle === undefined || candidateTitle.length === 0
        ? `story-${String(index + 1)}`
        : candidateTitle;
    const provenance = /^\*\*Provenance:\*\*\s*(.+)$/imu
      .exec(block)?.[1]
      ?.trim();
    const titleKey = normalizeKey(title);
    const supported =
      provenance === "source: cv.md" ||
      /^user-stated \d{4}-\d{2}-\d{2}$/u.test(provenance ?? "");
    return {
      sourceType: "story",
      sourceIdentity: `story:${titleKey.length === 0 ? String(index + 1) : titleKey}`,
      sourceRelativePath: file.relativePath,
      disposition: "imported",
      originalStatus: provenance ?? "derived-unverified",
      originalScore: null,
      note: supported
        ? "Story prose was preserved with explicit source provenance; claims still require Workbench evidence acceptance."
        : "Story prose was preserved as candidate-derived context; quantified claims are not accepted evidence.",
    };
  });
}

export async function discoverCareerOps(
  rootPath: string,
): Promise<CareerOpsDiscovery> {
  const root = await safeRoot(rootPath);
  const warnings: string[] = [];
  const unsupported = [
    "agent skills and prompts",
    "provider credentials and environment files",
    "browser profiles and cookies",
    "scripts, package dependencies, and Career Ops workers",
    "legacy Recursus state",
  ];
  const selected = new Set<string>();
  for (const candidate of [
    "config/profile.yml",
    "cv.md",
    "data/applications.md",
    "applications.md",
    "interview-prep/story-bank.md",
    "modes/_custom.md",
    "modes/_profile.md",
  ]) {
    try {
      if ((await lstat(join(root, ...candidate.split("/")))).isFile()) {
        selected.add(candidate);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  await collectMarkdownFiles(root, "reports", selected);
  await collectMarkdownFiles(root, "job-descriptions", selected);
  await collectMarkdownFiles(root, "data/job-descriptions", selected);
  await collectMarkdownFiles(root, "jobs", selected);
  if (selected.has("data/applications.md")) selected.delete("applications.md");
  if (!selected.has("config/profile.yml")) {
    warnings.push(
      "config/profile.yml was not found; no profile fields can be proposed.",
    );
  }
  if (!selected.has("cv.md")) {
    warnings.push(
      "cv.md was not found; candidate evidence cannot be confirmed from a primary CV source.",
    );
  }
  const trackerPath = selected.has("data/applications.md")
    ? "data/applications.md"
    : selected.has("applications.md")
      ? "applications.md"
      : null;
  if (trackerPath === null) warnings.push("No application tracker was found.");
  if (selected.size === 0 || selected.size > MAX_FILES) {
    throw new DomainError(
      "artifact_limit_exceeded",
      "Career Ops discovery found no supported files or exceeded the file limit.",
    );
  }

  const files: LoadedFile[] = [];
  let totalBytes = 0;
  for (const relativePath of [...selected].sort()) {
    try {
      const loaded = await loadSupportedFile(root, relativePath);
      totalBytes += loaded.bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new DomainError(
          "artifact_limit_exceeded",
          "Career Ops source exceeds the aggregate byte limit.",
        );
      }
      files.push(loaded);
    } catch (error) {
      if (
        error instanceof DomainError &&
        relativePath !== trackerPath &&
        relativePath !== "config/profile.yml"
      ) {
        warnings.push(`${relativePath} was skipped: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  let observedVersion: string | null = null;
  try {
    const packageBody = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as { version?: unknown };
    observedVersion =
      typeof packageBody.version === "string" ? packageBody.version : null;
  } catch {
    warnings.push("Career Ops package version could not be observed.");
  }
  if (
    observedVersion !== null &&
    observedVersion !== CAREER_OPS_OBSERVED_VERSION
  ) {
    warnings.push(
      `Observed Career Ops ${observedVersion}; compatibility is pinned to ${CAREER_OPS_OBSERVED_VERSION}.`,
    );
  } else if (observedVersion === CAREER_OPS_OBSERVED_VERSION) {
    warnings.push(
      `Package version ${observedVersion} matches the compatibility profile, but a package version does not prove the pinned source revision ${CAREER_OPS_REVISION}. Parsed files are still validated against the supported import contract.`,
    );
  }

  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  let profileFacts: CareerOpsProfileFactInput[] = [];
  const profile = byPath.get("config/profile.yml");
  if (profile !== undefined) {
    profileFacts = scalarFacts(profile.text, warnings);
  }

  const applications: CareerOpsApplicationInput[] = [];
  if (trackerPath !== null) {
    const tracker = byPath.get(trackerPath);
    if (tracker !== undefined) {
      for (const row of parseTracker(tracker.text, warnings)) {
        const state = mapCareerOpsStatus(row.status);
        if (state === null) {
          warnings.push(
            `Tracker row ${String(row.num)} has unsupported status “${row.status}” and was not imported.`,
          );
          continue;
        }
        const parsedEffectiveDate = effectiveDate(row.date);
        if (parsedEffectiveDate === null) {
          warnings.push(
            `Tracker row ${String(row.num)} has an invalid or missing date “${row.date}” and was not imported.`,
          );
          continue;
        }
        const reportRelativePath = reportPathFromCell(trackerPath, row.report);
        if (reportRelativePath !== null && !byPath.has(reportRelativePath)) {
          warnings.push(
            `Tracker row ${String(row.num)} references a missing report; the application remains importable.`,
          );
        }
        applications.push({
          sourceRelativePath: trackerPath,
          sourceIdentity: `tracker:${String(row.num)}:${normalizeKey(row.company)}:${normalizeKey(row.role)}`,
          organization: row.company,
          roleTitle: row.role,
          originalUrl: safeUrl(row.url),
          location: row.location.length === 0 ? null : row.location,
          state,
          effectiveDate: parsedEffectiveDate,
          note: row.notes.length === 0 ? null : row.notes,
          reportRelativePath:
            reportRelativePath !== null && byPath.has(reportRelativePath)
              ? reportRelativePath
              : null,
          originalStatus: row.status,
          originalScore:
            row.score.length > 0 && !["-", "—", "N/A"].includes(row.score)
              ? row.score
              : null,
        });
      }
    }
  }

  const passiveMappings: CareerOpsPassiveMappingInput[] = [];
  for (const file of files) {
    if (file.relativePath === "cv.md") {
      passiveMappings.push({
        sourceType: "cv",
        sourceIdentity: "cv",
        sourceRelativePath: file.relativePath,
        disposition: "imported",
        originalStatus: null,
        originalScore: null,
        note: "Primary candidate source preserved byte-for-byte; facts require explicit confirmation.",
      });
    } else if (file.relativePath.startsWith("reports/")) {
      const score =
        /(?:global_score|score):\s*['"]?([^'"\n]+)/iu
          .exec(file.text)?.[1]
          ?.trim() ?? null;
      passiveMappings.push({
        sourceType: "evaluation_report",
        sourceIdentity: `report:${file.relativePath}`,
        sourceRelativePath: file.relativePath,
        disposition: "imported",
        originalStatus: null,
        originalScore: score,
        note: "Original report and scoring label preserved; not converted into a Workbench deterministic evaluation.",
      });
    } else if (
      file.relativePath.includes("job-description") ||
      file.relativePath.startsWith("jobs/")
    ) {
      passiveMappings.push({
        sourceType: "job_description",
        sourceIdentity: `jd:${file.relativePath}`,
        sourceRelativePath: file.relativePath,
        disposition: "imported",
        originalStatus: null,
        originalScore: null,
        note: "External posting preserved as untrusted source data.",
      });
    } else if (file.relativePath === "interview-prep/story-bank.md") {
      passiveMappings.push(...storyMappings(file, warnings));
    } else if (
      file.relativePath === "modes/_custom.md" ||
      file.relativePath === "modes/_profile.md"
    ) {
      passiveMappings.push({
        sourceType: "preference",
        sourceIdentity: `preference:${file.relativePath}`,
        sourceRelativePath: file.relativePath,
        disposition: "imported",
        originalStatus: null,
        originalScore: null,
        note: "Preserved as untrusted preference source; embedded instructions are never executed.",
      });
    }
  }

  const importFiles: CareerOpsImportFileInput[] = files.map((file) => ({
    relativePath: file.relativePath,
    mediaType: file.mediaType,
    kind:
      file.relativePath === "cv.md" ||
      file.relativePath === "config/profile.yml"
        ? "candidate"
        : file.relativePath.includes("job-description") ||
            file.relativePath.startsWith("jobs/")
          ? "opportunity"
          : "import",
    trustClass:
      file.relativePath === "cv.md" ||
      file.relativePath === "config/profile.yml"
        ? "candidate_primary"
        : file.relativePath === "interview-prep/story-bank.md"
          ? "candidate_derived"
          : "external",
    bytes: file.bytes,
    contentDigest: file.contentDigest,
  }));
  const sourceFingerprint = digest(
    canonicalJson(
      importFiles.map((file) => ({
        relativePath: file.relativePath,
        mediaType: file.mediaType,
        contentDigest: file.contentDigest,
        byteLength: file.bytes.byteLength,
      })),
    ),
  );
  const plan: ApplyCareerOpsImportInput = {
    upstreamRevision: CAREER_OPS_REVISION,
    observedVersion,
    sourceIdentityDigest: digest(root.normalize("NFKC").toLowerCase()),
    sourceFingerprint,
    sourceLabel: basename(root),
    files: importFiles,
    profileFacts,
    applications,
    passiveMappings,
    warnings: [...new Set(warnings)],
    unsupported,
  };
  return {
    plan,
    preview: {
      provider: "career-ops",
      upstreamRevision: CAREER_OPS_REVISION,
      observedVersion,
      sourceLabel: plan.sourceLabel,
      sourceFingerprint,
      files: files.map((file) => ({
        relativePath: file.relativePath,
        mediaType: file.mediaType,
        byteLength: file.bytes.byteLength,
        contentDigest: file.contentDigest,
        purpose: file.purpose,
      })),
      profileFacts: profileFacts.map((fact) => ({
        sourceIdentity: `${fact.sourceRelativePath}:${fact.predicate}`,
        sourceRelativePath: fact.sourceRelativePath,
        predicate: fact.predicate,
        value: fact.value,
        confirmationRequired: true,
      })),
      applications: applications.map((application) => ({
        sourceIdentity: application.sourceIdentity,
        sourceRelativePath: application.sourceRelativePath,
        organization: application.organization,
        roleTitle: application.roleTitle,
        originalStatus: application.originalStatus,
        mappedState: application.state,
        originalScore: application.originalScore,
      })),
      passiveMappings,
      warnings: plan.warnings,
      unsupported,
    },
  };
}
