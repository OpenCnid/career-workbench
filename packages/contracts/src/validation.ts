import { Value } from "@sinclair/typebox/value";
import { parse, visit, type Node, type ParseError } from "jsonc-parser";
import type { TSchema, Static } from "@sinclair/typebox";

export class ContractValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: readonly string[],
  ) {
    super(message);
    this.name = "ContractValidationError";
  }
}

export function parseJsonWithoutDuplicateKeys(input: string): unknown {
  const objectKeys: Set<string>[] = [];
  const duplicates: string[] = [];
  const parseErrors: ParseError[] = [];

  visit(input, {
    onObjectBegin: () => {
      objectKeys.push(new Set());
    },
    onObjectProperty: (property) => {
      const keys = objectKeys.at(-1);
      if (keys?.has(property) === true) duplicates.push(property);
      keys?.add(property);
    },
    onObjectEnd: () => {
      objectKeys.pop();
    },
    onError: (error, offset, length) => {
      parseErrors.push({ error, offset, length });
    },
  });
  if (duplicates.length > 0) {
    throw new ContractValidationError("JSON contains duplicate object keys.", [
      ...new Set(duplicates),
    ]);
  }
  if (parseErrors.length > 0) {
    throw new ContractValidationError(
      "JSON is malformed.",
      parseErrors.map((item) => JSON.stringify(item)),
    );
  }
  const value: unknown = parse(input, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
  });
  if (parseErrors.length > 0) {
    throw new ContractValidationError(
      "JSON is malformed.",
      parseErrors.map((item) => JSON.stringify(item)),
    );
  }
  return value;
}

export function decodeContract<T extends TSchema>(
  schema: T,
  input: unknown,
): Static<T> {
  if (!Value.Check(schema, input)) {
    const issues = [...Value.Errors(schema, input)].map(
      (issue) => `${issue.path || "/"}: ${issue.message}`,
    );
    throw new ContractValidationError(
      "Payload does not match the public contract.",
      issues,
    );
  }
  return Value.Decode(schema, input);
}

export function parseContract<T extends TSchema>(
  schema: T,
  input: string,
): Static<T> {
  return decodeContract(schema, parseJsonWithoutDuplicateKeys(input));
}

export type JsonNode = Node;
