import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generate a readable temporary password that satisfies the policy. */
export function generateTempPassword(): string {
  // base64url of 12 random bytes, plus a guaranteed digit + letter.
  return "Cs" + randomBytes(9).toString("base64url") + "7";
}
