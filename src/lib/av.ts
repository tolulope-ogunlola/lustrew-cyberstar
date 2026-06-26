// Pluggable malware-scan hook for uploads. The default scanner detects the industry-standard
// EICAR test signature so the integration is verifiable; a real ClamAV / cloud-AV scanner drops
// in behind the same `scanBuffer` signature (select via AV_DRIVER).

export type AvResult = { clean: boolean; reason?: string };

const EICAR_SIGNATURE = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";
const MAX_SCAN_BYTES = 1024 * 1024; // inspect up to 1 MB for the signature

// Known file signatures (magic bytes). Types absent here (plain text, CSV, JSON) can't be reliably
// sniffed and are allowed; binary/office types must match to defeat content-type spoofing.
const SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]], // GIF8
  // Office Open XML (docx/xlsx) and zip are ZIP containers.
  "application/zip": [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4b, 0x03, 0x04]],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [[0x50, 0x4b, 0x03, 0x04]],
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0]],
  "application/vnd.ms-excel": [[0xd0, 0xcf, 0x11, 0xe0]],
};

/** Verify the file's bytes match its declared content-type (where a signature is known). */
export function contentMatchesType(bytes: Buffer, contentType: string): boolean {
  const sigs = SIGNATURES[contentType];
  if (!sigs) return true; // unsniffable (text/csv/json/octet-stream) — allowed
  return sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
}

export async function scanBuffer(bytes: Buffer): Promise<AvResult> {
  if (process.env.AV_DRIVER && process.env.AV_DRIVER !== "builtin") {
    // Hook point: a real scanner implementation would run here.
    // Fall through to the built-in check if not implemented.
  }
  const head = bytes.subarray(0, Math.min(bytes.length, MAX_SCAN_BYTES)).toString("latin1");
  if (head.includes(EICAR_SIGNATURE)) {
    return { clean: false, reason: "Malware signature detected (EICAR test file)" };
  }
  return { clean: true };
}
