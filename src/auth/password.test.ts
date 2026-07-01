import { describe, it, expect } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("hashPassword()", () => {
  it("produces a self-describing pbkdf2 string", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const parts = hash.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it("uses a random salt (same password → different hashes)", async () => {
    const a = await hashPassword("hunter2");
    const b = await hashPassword("hunter2");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword()", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("s3cr3t!");
    expect(await verifyPassword("s3cr3t!", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cr3t!");
    expect(await verifyPassword("s3cr3t?", hash)).toBe(false);
  });

  it("round-trips an empty password (no complexity rules)", async () => {
    const hash = await hashPassword("");
    expect(await verifyPassword("", hash)).toBe(true);
    expect(await verifyPassword("x", hash)).toBe(false);
  });

  it("round-trips unicode passwords", async () => {
    const pw = "pÀsswörd–🔐";
    const hash = await hashPassword(pw);
    expect(await verifyPassword(pw, hash)).toBe(true);
  });

  it("returns false for malformed stored values", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$aa$bb")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$0$aa$bb")).toBe(false);
  });
});
