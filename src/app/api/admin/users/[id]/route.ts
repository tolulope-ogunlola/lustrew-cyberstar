import { prisma } from "@/lib/db";
import { HttpError, requireUser, route } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { userUpdateSchema } from "@/lib/validation";

// PATCH: change role, activate/deactivate, reset MFA, or issue a new temp password.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const admin = await requireUser();
    if (admin.role !== "ADMIN") throw new HttpError(403, "Admin only");
    const { id } = await params;
    const body = userUpdateSchema.parse(await req.json());

    const target = await prisma.user.findFirst({
      where: { id, orgId: admin.orgId },
    });
    if (!target) throw new HttpError(404, "User not found");

    // Guard against an admin locking themselves out / removing the last admin path.
    if (target.id === admin.id && (body.isActive === false || (body.role && body.role !== "ADMIN"))) {
      throw new HttpError(400, "You cannot demote or deactivate your own admin account");
    }

    let tempPassword: string | undefined;
    const data: Record<string, unknown> = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.resetMfa) {
      data.mfaEnabled = false;
      data.mfaSecret = null;
    }
    if (body.resetPassword) {
      tempPassword = generateTempPassword();
      data.passwordHash = await hashPassword(tempPassword);
      data.mustChangePassword = true;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, mfaEnabled: true },
    });

    await writeAuditEvent({
      actorId: admin.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      metadata: { ...body },
    });

    return { ...updated, ...(tempPassword ? { tempPassword } : {}) };
  });
}
