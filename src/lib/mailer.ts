// Pluggable mailer. The console driver logs messages and keeps a small in-memory outbox so flows
// like invites and password resets are verifiable in local/dev without an SMTP server. For
// production, implement an SMTP/SES driver behind the same `send` signature and select it via
// MAILER_DRIVER — nothing else changes.

export type Email = {
  to: string;
  subject: string;
  text: string;
  sentAt: string;
};

const OUTBOX_LIMIT = 50;

// Keep the outbox on globalThis so it's shared across route bundles (Next isolates per-route
// module instances in dev — same reason the Prisma client is a global singleton).
const globalForMail = globalThis as unknown as { __cyberstarOutbox?: Email[] };
const outbox: Email[] = (globalForMail.__cyberstarOutbox ??= []);

export interface Mailer {
  send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(msg: { to: string; subject: string; text: string }): Promise<void> {
    const email: Email = { ...msg, sentAt: new Date().toISOString() };
    outbox.unshift(email);
    if (outbox.length > OUTBOX_LIMIT) outbox.pop();
    console.log(`\n=== EMAIL → ${msg.to} ===\n${msg.subject}\n${msg.text}\n========================\n`);
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  // Only the console driver ships today; MAILER_DRIVER selects SMTP/SES once implemented.
  mailer = new ConsoleMailer();
  return mailer;
}

/** Recent sent messages (admin-only view; supports local verification of invite/reset flows). */
export function recentEmails(limit = 20): Email[] {
  return outbox.slice(0, limit);
}
