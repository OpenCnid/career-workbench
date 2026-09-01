import { describe, expect, it } from "vitest";
import {
  APPROVAL_TRANSITIONS,
  requireApprovalTransition,
  type ApprovalState,
} from "../src/index.js";

describe("approval state machine", () => {
  for (const [from, allowed] of Object.entries(APPROVAL_TRANSITIONS)) {
    for (const to of Object.keys(APPROVAL_TRANSITIONS)) {
      const transition = (): void =>
        requireApprovalTransition(from as ApprovalState, to as ApprovalState);
      if (allowed.includes(to as ApprovalState)) {
        it(`accepts ${from} -> ${to}`, () => expect(transition).not.toThrow());
      } else {
        it(`rejects ${from} -> ${to}`, () =>
          expect(transition).toThrow(/cannot transition/u));
      }
    }
  }
});
