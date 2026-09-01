import { describe, expect, it } from "vitest";
import { DeterministicIdFactory } from "../src/ids.js";

describe("DeterministicIdFactory", () => {
  it("emits only public-contract IDs after the counter crosses forbidden base-32 letters", () => {
    const ids = new DeterministicIdFactory("5YN7HE71C0");
    const generated = Array.from({ length: 128 }, () =>
      ids.entity("operation"),
    );
    expect(new Set(generated)).toHaveLength(128);
    for (const id of generated) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$/u);
    }
  });

  it("rejects seeds that could generate contract-invalid IDs", () => {
    expect(() => new DeterministicIdFactory("SYNTHETIC0")).toThrow(
      /Crockford base-32/u,
    );
  });
});
