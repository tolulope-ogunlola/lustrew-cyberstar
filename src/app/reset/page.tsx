"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiSend } from "@/components/ui";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/auth/reset", "POST", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-brand-400">Choose a new password</div>
        </div>
        {!token ? (
          <div className="card text-sm text-red-400">Missing or invalid reset link.</div>
        ) : done ? (
          <div className="card text-sm text-emerald-300">Password updated. Redirecting to sign in…</div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="mt-1 text-[11px] text-slate-500">At least 10 characters, with a letter and a number.</p>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
