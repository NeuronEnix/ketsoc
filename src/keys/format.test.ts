import { describe, it, expect } from "vitest";

import { randomBase62, formatKey, parseKey, envRefFromId } from "./format";

describe("randomBase62()", () => {
  it("returns unique base62 strings of the requested length", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const s = randomBase62(20);
      expect(s).toHaveLength(20);
      expect(s).toMatch(/^[0-9A-Za-z]+$/);
      seen.add(s);
    }
    expect(seen.size).toBe(500);
  });
});

describe("formatKey / parseKey", () => {
  it("round-trips", () => {
    const key = formatKey("ksk", "prod7f", "abc123", "SECRETvalue");
    expect(key).toBe("ksk.prod7f.abc123.SECRETvalue");
    expect(parseKey(key)).toEqual({
      kind: "ksk",
      envRef: "prod7f",
      kid: "abc123",
      secret: "SECRETvalue",
    });
  });

  it("rejects malformed keys", () => {
    expect(parseKey("")).toBeNull();
    expect(parseKey("ksk.a.b")).toBeNull();
    expect(parseKey("xxx.a.b.c")).toBeNull();
    expect(parseKey("ksk..b.c")).toBeNull();
    expect(parseKey("ksk.a.b.c.d")).toBeNull();
  });
});

describe("envRefFromId()", () => {
  it("derives a 6-char ref from an env id", () => {
    const ref = envRefFromId("env_01kwftwp1jf7r9p3pjzww1f2p4");
    expect(ref).toHaveLength(6);
    expect(ref).toMatch(/^[0-9a-z]+$/);
  });
});
