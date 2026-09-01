import { randomBytes } from "node:crypto";
import type {
  EntityId,
  UtcTimestamp,
  WorkspaceId,
} from "@career-workbench/domain";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface Clock {
  now(): UtcTimestamp;
}

export interface IdFactory {
  entity(prefix: string): EntityId;
  workspace(): WorkspaceId;
}

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function deterministicToken(value: number, length: number): string {
  let remaining = value;
  let result = "";
  do {
    result = `${ALPHABET.charAt(remaining % ALPHABET.length)}${result}`;
    remaining = Math.floor(remaining / ALPHABET.length);
  } while (remaining > 0);
  return result.padStart(length, "0");
}

export class SystemClock implements Clock {
  public now(): UtcTimestamp {
    return new Date().toISOString() as UtcTimestamp;
  }
}

export class RandomIdFactory implements IdFactory {
  public entity(prefix: string): EntityId {
    return `${prefix}_${randomToken(26)}` as EntityId;
  }

  public workspace(): WorkspaceId {
    return `workspace_${randomToken(26)}` as WorkspaceId;
  }
}

export class DeterministicIdFactory implements IdFactory {
  private nextValue = 0;

  public constructor(private readonly seed = "0000000000") {
    if (!/^[0-9A-HJKMNP-TV-Z]{10}$/u.test(seed)) {
      throw new Error(
        "Deterministic ID seed must contain ten Crockford base-32 characters.",
      );
    }
  }

  private next(prefix: string): string {
    this.nextValue += 1;
    return `${prefix}_${this.seed}${deterministicToken(this.nextValue, 6)}`;
  }

  public entity(prefix: string): EntityId {
    return this.next(prefix) as EntityId;
  }

  public workspace(): WorkspaceId {
    return this.next("workspace") as WorkspaceId;
  }
}

export class FixedClock implements Clock {
  public constructor(private readonly timestamp: UtcTimestamp) {}

  public now(): UtcTimestamp {
    return this.timestamp;
  }
}
