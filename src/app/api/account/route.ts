import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";

// Current user's profile + security status (drives the /account page and banners).
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mustChangePassword: true,
      },
    });
    return u;
  });
}
