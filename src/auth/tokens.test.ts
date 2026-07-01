import { describe, it, expect } from "vitest";

import { generateSecret, sha256Hex } from "./tokens";

describe("generateSecret()", () => {
  it("returns url-safe, unique secrets", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const secret = generateSecret();
      expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
      seen.add(secret);
    }
    expect(seen.size).toBe(500);
  });
});

describe("sha256Hex()", () => {
  it("matches known vectors", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});
