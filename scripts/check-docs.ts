import { access, readFile } from "node:fs/promises";

const required = [
  "SPEC.md",
  "ARCHITECTURE.md",
  "MILESTONES.md",
  "VISION.md",
  "LICENSE.md",
  "AGENTS.md",
  "docs/COMPATIBILITY.md",
  "docs/PROVENANCE.md",
  "docs/SYNTHETIC_DATA.md",
  "docs/MILESTONE_PLAN.md",
  "docs/SECURITY.md",
  "docs/INSTALLATION.md",
  "docs/OPERATIONS.md",
  "docs/THREAT_MODEL.md",
  "docs/PERFORMANCE.md",
  "docs/RELEASE_NOTES.md",
  "docs/qa/MILESTONE_5.md",
  "docs/qa/MILESTONE_6.md",
  "docs/qa/MILESTONE_7.md",
  "docs/qa/MILESTONE_8.md",
  "docs/qa/MILESTONE_9.md",
  "docs/qa/ACCEPTANCE_MATRIX.md",
  "packages/evals/protocols/PREREGISTRATION.md",
  "packages/evals/protocols/SESSION_SCRIPT.md",
  "packages/evals/protocols/CONSENT_AND_RECORDING.md",
  "packages/evals/protocols/FINDING_CODEBOOK.md",
  "packages/evals/protocols/REPORT_TEMPLATE.md",
];
await Promise.all(required.map((file) => access(file)));
const compatibility = await readFile("docs/COMPATIBILITY.md", "utf8");
for (const pin of ["3a067ee580", "dd6322d604", "0e9f030300"]) {
  if (!compatibility.includes(pin))
    throw new Error(`Compatibility documentation omits ${pin}.`);
}
console.log(`validated ${String(required.length)} required documents`);
