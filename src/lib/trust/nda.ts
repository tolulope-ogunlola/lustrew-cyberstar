import { createHash } from "node:crypto";
import { NDA_TEXT, CURRENT_NDA_VERSION } from "./nda-text";

// Clickwrap NDA hashing (server-only). The exact text + version are recorded with each acceptance
// (NdaAcceptance) so the agreement is evidentiary.

export { NDA_TEXT, CURRENT_NDA_VERSION };

export function hashNda(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const CURRENT_NDA_HASH = hashNda(NDA_TEXT);
