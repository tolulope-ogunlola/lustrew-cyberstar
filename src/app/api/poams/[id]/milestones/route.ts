import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { z } from "zod";

const createSchema = z.object({
  description: z.string().min(2).max(300),
  dueDate: z.string().datetime().nullable().optional(),
});
const toggleSchema = z.object({ milestoneId: z.string(), done: z.boolean() });

async function assertPoam(orgId: string, id: string) {
  const poam = await prisma.poam.findFirst({
    where: { id, system: { orgId } },
    select: { id: true },
  });
  if (!poam) throw new HttpError(404, "POA&M not found");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const { id } = await params;
    await assertPoam(user.orgId, id);
    const body = createSchema.parse(await req.json());
    return prisma.poamMilestone.create({
      data: {
        poamId: id,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requirePermission("write", "poam");
    const { id } = await params;
    await assertPoam(user.orgId, id);
    const body = toggleSchema.parse(await req.json());
    return prisma.poamMilestone.update({
      where: { id: body.milestoneId },
      data: { done: body.done },
    });
  });
}
