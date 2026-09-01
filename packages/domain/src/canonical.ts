import { assertDomain } from "./errors.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  assertDomain(
    value === null || ["string", "number", "boolean"].includes(typeof value),
    "invalid_request",
    "Canonical JSON contains an unsupported value.",
  );
  if (typeof value === "number") {
    assertDomain(
      Number.isFinite(value),
      "invalid_request",
      "Canonical JSON numbers must be finite.",
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}
