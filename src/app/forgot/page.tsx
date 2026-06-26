"use client";

import { useState } from "react";
import { apiSend } from "@/components/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiSend("/api/auth/forgot", "POST", { email });
    } catch {
      // ignore — response is intentionally uniform
    }
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-brand-400">Reset password</div>
        </div>
        {sent ? (
          <div className="card text-sm text-slate-300">
            If an account exists for that email, a reset link has been sent. The link expires in 1 hour.
            <div className="mt-4">
              <a href="/login" className="text-brand-300 hover:underline">
                Back to sign in
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <div className="text-center">
              <a href="/login" className="text-xs text-slate-400 hover:text-brand-300">
                Back to sign in
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
