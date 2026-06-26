import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

// Pluggable evidence storage. LocalDiskStorage writes to a non-public directory so files are
// only ever served through the authenticated download route. An S3/Azure-Blob driver implements
// the same interface for production without touching call sites.

export type StoredFile = {
  ref: string; // opaque key persisted on the Evidence row
  size: number;
  contentType: string;
  sha256: string;
};

export interface StorageProvider {
  put(input: {
    orgId: string;
    fileName: string;
    contentType: string;
    bytes: Buffer;
  }): Promise<StoredFile>;
  get(ref: string): Promise<Buffer>;
  delete(ref: string): Promise<void>;
}

const PREFIX = "local:";

class LocalDiskStorage implements StorageProvider {
  private root: string;

  constructor(dir: string) {
    // Resolve once; all reads/writes are constrained to this root.
    this.root = resolve(process.cwd(), dir);
  }

  private pathFor(relative: string): string {
    const full = resolve(this.root, relative);
    // Guard against path traversal — the resolved path must stay under the root.
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Invalid storage path");
    }
    return full;
  }

  async put(input: {
    orgId: string;
    fileName: string;
    contentType: string;
    bytes: Buffer;
  }): Promise<StoredFile> {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
    const relative = join(input.orgId, `${randomUUID()}-${safeName}`);
    const full = this.pathFor(relative);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, input.bytes);
    return {
      ref: PREFIX + relative.split(sep).join("/"),
      size: input.bytes.length,
      contentType: input.contentType,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    };
  }

  async get(ref: string): Promise<Buffer> {
    if (!ref.startsWith(PREFIX)) throw new Error("Unsupported storage ref");
    const relative = ref.slice(PREFIX.length);
    return readFile(this.pathFor(relative));
  }

  async delete(ref: string): Promise<void> {
    if (!ref.startsWith(PREFIX)) return;
    const relative = ref.slice(PREFIX.length);
    await unlink(this.pathFor(relative)).catch(() => {});
  }
}

let provider: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (provider) return provider;
  // Only the local driver ships today; STORAGE_DRIVER selects others when implemented.
  const dir = process.env.STORAGE_DIR || ".data/uploads";
  provider = new LocalDiskStorage(dir);
  return provider;
}

// Upload constraints enforced by the upload route.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/zip",
  "application/octet-stream",
]);
