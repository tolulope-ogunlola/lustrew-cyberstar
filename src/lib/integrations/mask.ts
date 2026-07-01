import { decryptString, encryptString, isEncrypted } from "@/lib/crypto";
import type { IntegrationConfig } from "./types";

// Connector config secret fields — encrypted at rest, masked on read, decrypted only for use.
const SECRET_KEYS = new Set(["accessKey", "secretKey", "password", "token", "clientSecret", "serviceAccountJson"]);

function asObject(json: string): Record<string, unknown> {
  try {
    const o = JSON.parse(json);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Never echo secrets back to the client (handles both encrypted and plaintext values). */
export function maskConfig(json: string): Record<string, unknown> {
  const cfg = asObject(json);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = SECRET_KEYS.has(k) && v ? "••••••" : v;
  }
  return out;
}

/** Encrypt secret fields for storage. Already-encrypted values are left as-is (idempotent). */
export function encryptConfig(config: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEYS.has(k) && typeof v === "string" && v && !isEncrypted(v)) {
      out[k] = encryptString(v);
    } else {
      out[k] = v;
    }
  }
  return JSON.stringify(out);
}

/** Decrypt secret fields for connector use. */
export function decryptConfig(json: string): IntegrationConfig {
  const cfg = asObject(json);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = typeof v === "string" && isEncrypted(v) ? decryptString(v) : v;
  }
  return out as IntegrationConfig;
}
