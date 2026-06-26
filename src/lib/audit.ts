import { prisma } from "./db";

/**
 * Append-only audit logging. Every mutating API route calls this. Failures here must never
 * break the underlying operation, so writes are best-effort and swallowed on error.
 */
export async function writeAuditEvent(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      },
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
