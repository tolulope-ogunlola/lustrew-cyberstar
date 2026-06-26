import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Authenticated symmetric encryption (AES-256-GCM) for secrets at rest (e.g. integration
// credentials). The key comes from ENCRYPTION_KEY; if unset, it is derived from NEXTAUTH_SECRET so
// local dev works without extra config. Set a dedicated ENCRYPTION_KEY in production.
function key(): Buffer {
  const material = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "cyberstar-insecure-dev-key";
  return createHash("sha256").update(material).digest(); // 32 bytes
}

const PREFIX = "enc:v1:";

/** Encrypt a string; returns a self-describing token (prefix + base64 iv|tag|ciphertext). */
export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Decrypt a token from encryptString. Returns the input unchanged if it isn't an enc token. */
export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
