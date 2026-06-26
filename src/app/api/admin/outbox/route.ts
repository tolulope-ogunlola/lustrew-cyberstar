import { HttpError, requireUser, route } from "@/lib/api";
import { recentEmails } from "@/lib/mailer";

// Admin-only view of recently "sent" emails (console mailer outbox). Useful for verifying invite
// and password-reset flows in local/dev. With a real SMTP driver this reflects nothing sensitive
// beyond what the admin already controls.
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
    return recentEmails(20);
  });
}
