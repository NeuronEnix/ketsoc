import { describe, it, expect } from "vitest";

import {
  typeid,
  parseTypeId,
  isValidId,
  timestampMs,
  uuidBytesOf,
  ID_PREFIXES,
  newId,
} from "./ids";

const SUFFIX_RE = /^[0-9a-hjkmnp-tv-z]{26}$/;

describe("typeid()", () => {
  it("prefixes the id and produces a 26-char base32 suffix", () => {
    const id = typeid("org");
    expect(id.startsWith("org_")).toBe(true);
    const suffix = id.slice("org_".length);
    expect(suffix).toMatch(SUFFIX_RE);
    expect(suffix.length).toBe(26);
  });

  it("left-pads so the suffix's first char only spans 2 bits (0-7)", () => {
    for (let i = 0; i < 50; i++) {
      const suffix = typeid("env").slice(4);
      expect("01234567").toContain(suffix.charAt(0));
    }
  });

  it("generates unique ids", () => {
    const set = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      set.add(typeid("usr"));
    }
    expect(set.size).toBe(2000);
  });

  it("is lexicographically time-sortable", () => {
    const a = typeid("evt", 1_000);
    const b = typeid("evt", 2_000);
    const c = typeid("evt", 1_700_000_000_000);
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it("rejects an invalid prefix", () => {
    expect(() => typeid("Org")).toThrow();
    expect(() => typeid("")).toThrow();
    expect(() => typeid("a_")).toThrow();
  });
});

describe("parseTypeId()", () => {
  it("splits prefix and suffix", () => {
    const parsed = parseTypeId(typeid("conn"));
    expect(parsed.prefix).toBe("conn");
    expect(parsed.suffix).toMatch(SUFFIX_RE);
  });

  it("throws on a missing or malformed suffix", () => {
    expect(() => parseTypeId("org_short")).toThrow();
    expect(() => parseTypeId("nosuffix")).toThrow();
    expect(() => parseTypeId("org_IIIIIIIIIIIIIIIIIIIIIIIIII")).toThrow();
  });

  it("throws on a missing or invalid prefix", () => {
    const suffix = typeid("org").slice(4);
    expect(() => parseTypeId(`_${suffix}`)).toThrow();
    expect(() => parseTypeId(`Org_${suffix}`)).toThrow();
  });
});

describe("isValidId()", () => {
  it("validates format and (optionally) the expected prefix", () => {
    const id = typeid("key");
    expect(isValidId(id)).toBe(true);
    expect(isValidId(id, "key")).toBe(true);
    expect(isValidId(id, "org")).toBe(false);
    expect(isValidId("not-an-id")).toBe(false);
  });
});

describe("timestampMs()", () => {
  it("recovers the embedded creation time in ms", () => {
    const t = 1_700_000_000_123;
    expect(timestampMs(typeid("org", t))).toBe(t);
  });
});

describe("uuidBytesOf()", () => {
  it("decodes to 16 bytes with the v7 version + variant bits", () => {
    const bytes = uuidBytesOf(typeid("usr", 1_699_999_999_000));
    expect(bytes.length).toBe(16);
    expect((bytes[6] ?? 0) >> 4).toBe(0x7);
    expect((bytes[8] ?? 0) >> 6).toBe(0b10);
  });
});

describe("ID_PREFIXES / newId()", () => {
  it("exposes typed prefixes and a generator", () => {
    expect(ID_PREFIXES.org).toBe("org");
    expect(newId(ID_PREFIXES.org).startsWith("org_")).toBe(true);
  });
});
