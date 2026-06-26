import { describe, expect, it } from "vitest";
import { decryptString, encryptString, isEncrypted } from "./crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const token = encryptString("super-secret-api-key");
    expect(isEncrypted(token)).toBe(true);
    expect(token).not.toContain("super-secret-api-key");
    expect(decryptString(token)).toBe("super-secret-api-key");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptString("x")).not.toBe(encryptString("x"));
  });

  it("passes through non-encrypted values unchanged", () => {
    expect(decryptString("plaintext")).toBe("plaintext");
    expect(isEncrypted("plaintext")).toBe(false);
  });

  it("fails authentication on tampered ciphertext", () => {
    const token = encryptString("data");
    const tampered = token.slice(0, -4) + "AAAA";
    expect(() => decryptString(tampered)).toThrow();
  });
});
