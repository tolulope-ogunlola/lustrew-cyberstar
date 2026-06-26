import { prisma } from "@/lib/db";
import { envStatus } from "@/lib/env";

// Liveness/readiness probe for load balancers and uptime checks. No auth (no sensitive data).
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const status = db ? "ok" : "degraded";
  return Response.json(
    { status, db, ...envStatus(), time: new Date().toISOString() },
    { status: db ? 200 : 503 }
  );
}
