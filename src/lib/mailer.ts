// Pluggable mailer. The console driver logs messages and keeps a small in-memory outbox so flows
// like invites and password resets are verifiable in local/dev without an SMTP server. Set
// MAILER_DRIVER=smtp (+ SMTP_* env vars) to deliver via real SMTP/SES in production.

import nodemailer, { type Transporter } from "nodemailer";

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

// Real SMTP delivery via nodemailer. Also records to the outbox for the admin view/audit.
class SmtpMailer implements Mailer {
  private transport: Transporter;
  private from: string;
  constructor() {
    this.from = process.env.MAIL_FROM || "CyberStar <no-reply@cyberstar.local>";
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  async send(msg: { to: string; subject: string; text: string }): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text });
    const email: Email = { ...msg, sentAt: new Date().toISOString() };
    outbox.unshift(email);
    if (outbox.length > OUTBOX_LIMIT) outbox.pop();
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  mailer = process.env.MAILER_DRIVER === "smtp" ? new SmtpMailer() : new ConsoleMailer();
  return mailer;
}

/** Recent sent messages (admin-only view; supports local verification of invite/reset flows). */
export function recentEmails(limit = 20): Email[] {
  return outbox.slice(0, limit);
}
