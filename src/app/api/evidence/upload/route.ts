import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  storage,
} from "@/lib/storage";
import { contentMatchesType, scanBuffer } from "@/lib/av";

// POST multipart/form-data: systemId, title, type?, note?, implementationIds? (JSON array), file
export async function POST(req: Request) {
  return route(async () => {
    const user = await requirePermission("write", "evidence");

    const form = await req.formData();
    const systemId = String(form.get("systemId") || "");
    const title = String(form.get("title") || "").trim();
    const type = String(form.get("type") || "Document");
    const note = String(form.get("note") || "");
    const file = form.get("file");

    if (!systemId) throw new HttpError(400, "systemId is required");
    if (!title || title.length < 2) throw new HttpError(400, "title is required");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, `File exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`);
    }
    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new HttpError(415, `Unsupported file type: ${contentType}`);
    }

    const system = await prisma.system.findFirst({
      where: { id: systemId, orgId: user.orgId },
      select: { id: true },
    });
    if (!system) throw new HttpError(404, "System not found");

    let implementationIds: string[] = [];
    const rawIds = form.get("implementationIds");
    if (typeof rawIds === "string" && rawIds) {
      try {
        const parsed = JSON.parse(rawIds);
        if (Array.isArray(parsed)) implementationIds = parsed.map(String);
      } catch {
        throw new HttpError(400, "implementationIds must be a JSON array");
      }
    }
    // Only allow linking implementations that belong to this system/org.
    if (implementationIds.length) {
      const valid = await prisma.controlImplementation.findMany({
        where: { id: { in: implementationIds }, systemId },
        select: { id: true },
      });
      implementationIds = valid.map((v) => v.id);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Malware scan before the file is ever persisted.
    const scan = await scanBuffer(bytes);
    if (!scan.clean) throw new HttpError(422, scan.reason ?? "File failed malware scan");

    // Verify the bytes match the declared content-type (defeats content-type spoofing).
    if (!contentMatchesType(bytes, contentType)) {
      throw new HttpError(415, "File content does not match its declared type");
    }

    const stored = await storage().put({
      orgId: user.orgId,
      fileName: file.name,
      contentType,
      bytes,
    });

    const evidence = await prisma.evidence.create({
      data: {
        systemId,
        title,
        type,
        note,
        fileRef: stored.ref,
        fileName: file.name,
        fileSize: stored.size,
        contentType,
        uploadedById: user.id,
        links: { create: implementationIds.map((implementationId) => ({ implementationId })) },
      },
    });

    await writeAuditEvent({
      actorId: user.id,
      action: "evidence.upload",
      entityType: "evidence",
      entityId: evidence.id,
      metadata: { title, fileName: file.name, size: stored.size, sha256: stored.sha256, links: implementationIds.length },
    });

    return { id: evidence.id };
  });
}
