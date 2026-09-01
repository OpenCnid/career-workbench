import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split(/\r?\n/u)
  .filter(
    (file) =>
      file.length > 0 && !/\.(png|jpg|jpeg|gif|pdf|sqlite|tgz)$/iu.test(file),
  );
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/u,
  /Authorization\s*:\s*Bearer\s+\S+/iu,
  /[A-Za-z]:\\Users\\(?!Synthetic\\)/u,
];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content))
      throw new Error(`Sensitive-looking retained content in ${file}.`);
  }
}
console.log(`scanned ${String(files.length)} retained text files`);
