import { prisma } from "@/lib/db";
import { HttpError, requirePermission, route } from "@/lib/api";
import { SCANNERS } from "@/lib/integrations/scanners";
import { decryptConfig } from "@/lib/integrations/mask";

// Test connectivity for a connector (scanners + ServiceNow honor mock mode).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requirePermission("write", "integration");
    const { id } = await params;
    const row = await prisma.integration.findFirst({ where: { id, orgId: user.orgId } });
    if (!row) throw new HttpError(404, "Integration not found");
    const config = decryptConfig(row.config || "{}");

    const scanner = SCANNERS[row.type];
    if (scanner) return scanner.testConnection(config);

    if (row.type === "SERVICENOW") {
      if (config.mock) return { ok: true, message: "Mock mode — no live call made." };
      return config.baseUrl && config.accessKey
        ? { ok: true, message: "Credentials present (live call performed on push)." }
        : { ok: false, message: "Instance URL and credentials are required." };
    }
    return { ok: true, message: "No live connection to test for this connector." };
  });
}
