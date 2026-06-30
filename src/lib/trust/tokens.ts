import { createHash, randomBytes } from "node:crypto";

// Tokenized document access for the Trust Center. Only the SHA-256 hash of a token is stored
// (mirrors User.passwordResetTokenHash); the raw token is emailed once and never persisted.

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function issueGrantToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

// Salted hash of a client IP for abuse forensics without storing raw IPs.
export function hashIp(ip: string): string {
  const salt = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "cyberstar-dev";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
