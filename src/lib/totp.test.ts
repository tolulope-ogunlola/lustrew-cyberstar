import { describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { generateMfaSecret, otpauthUrl, verifyTotp } from "./totp";

describe("totp", () => {
  it("verifies a freshly generated code for its secret", () => {
    const secret = generateMfaSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotp(code, secret)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateMfaSecret();
    expect(verifyTotp("000000", secret)).toBe(false);
  });

  it("rejects empty inputs without throwing", () => {
    expect(verifyTotp("", "")).toBe(false);
    expect(verifyTotp("123456", "")).toBe(false);
  });

  it("builds an otpauth URI with the issuer and account", () => {
    const url = otpauthUrl("user@example.com", generateMfaSecret());
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain("Lustrew%20CyberStar");
    expect(url).toContain("example.com"); // local part's @ is URL-encoded in the label
    expect(url).toContain("secret=");
  });
});
