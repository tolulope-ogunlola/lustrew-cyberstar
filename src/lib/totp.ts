import { authenticator } from "otplib";

// TOTP (RFC 6238) for app-based MFA. Compatible with Google Authenticator, Authy, 1Password, etc.
// Allow a ±1 step (30s) window to tolerate clock skew.
authenticator.options = { window: 1 };

const ISSUER = "Lustrew CyberStar";

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI the user scans/imports into an authenticator app. */
export function otpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}
