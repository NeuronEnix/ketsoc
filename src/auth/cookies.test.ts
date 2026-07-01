import { describe, it, expect } from "vitest";

import { serializeCookie, parseCookies } from "./cookies";

describe("serializeCookie()", () => {
  it("builds a secure httpOnly cookie", () => {
    const c = serializeCookie("ks_at", "tok", {
      maxAgeSec: 900,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
    });
    expect(c).toContain("ks_at=tok");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=900");
    expect(c).toContain("Path=/");
  });

  it("url-encodes the value", () => {
    const c = serializeCookie("k", "a b;c");
    expect(c.startsWith("k=")).toBe(true);
    expect(c).not.toContain("a b;c");
  });
});

describe("parseCookies()", () => {
  it("parses a cookie header", () => {
    const m = parseCookies("ks_at=abc; ks_rt=def; other=1");
    expect(m["ks_at"]).toBe("abc");
    expect(m["ks_rt"]).toBe("def");
    expect(m["other"]).toBe("1");
  });

  it("returns empty for null or empty input", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });

  it("round-trips an encoded value", () => {
    const c = serializeCookie("k", "a b;c=d");
    const encodedValue = c.split(";")[0]?.slice("k=".length) ?? "";
    expect(parseCookies(`k=${encodedValue}`)["k"]).toBe("a b;c=d");
  });
});
