import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const expected = new Map([
  [
    "0002-continuable-child-deletion.patch",
    "fd1e5d51155e0c0490fe2f3ca94de5b77843f931e32014fc803fdebfe0f74811",
  ],
  [
    "0003-public-ignorable-session-events.patch",
    "a9635b96a31800631812e26c4e358e734f5cbf4282c69dff380f4d704d68705e",
  ],
  [
    "0004-pi-ai-agent-session-cleanup.patch",
    "e4bc34169b5fa63c069c4a07c33f05d1c8703ea05ff09a47fecf47264d387efa",
  ],
  [
    "0005-bounded-process-shutdown.patch",
    "affef51d328b06c8e723054676d73741ea6b93910f9d5dfcad56c2b521babfb0",
  ],
]);

for (const [name, digest] of expected) {
  const bytes = await readFile(
    join("provenance", "patches", "deepseek-harness", name),
  );
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== digest) {
    throw new Error(`${name} differs from the pinned native RLM bundle.`);
  }
}

const adaptedSessionPatch = await readFile(
  join(
    "provenance",
    "patches",
    "npm",
    "@deepseek-ai__dsh-session@0.1.2-alpha.3.patch",
  ),
  "utf8",
);
if (
  !adaptedSessionPatch.includes("appendIgnorable") ||
  !adaptedSessionPatch.includes('+\t"subagent/deleted"') ||
  !adaptedSessionPatch.includes("+    'subagent/deleted'")
) {
  throw new Error(
    "Published session adaptation is missing the public ignorable seam or regenerated deletion-event catalog.",
  );
}

console.log(
  `validated ${String(expected.size)} byte-identical native RLM DSH patches`,
);
