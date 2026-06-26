"use client";

import { useState } from "react";
import { PageHeader, apiSend, useApi } from "@/components/ui";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
};

export default function AccountPage() {
  const { data, refetch } = useApi<Account>("/api/account");

  return (
    <div>
      <PageHeader title="Account settings" subtitle="Manage your password and multi-factor authentication" />

      {data?.mustChangePassword && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          You're using a temporary password. Please set a new password below.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <PasswordCard />
        {data && <MfaCard enabled={data.mfaEnabled} onChange={refetch} />}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await apiSend("/api/account/password", "POST", { currentPassword, newPassword });
      setMsg("Password updated.");
      setCurrent("");
      setNew("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Change password</h2>
      <div>
        <label className="label">Current password</label>
        <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} required />
        <p className="mt-1 text-[11px] text-slate-500">At least 10 characters, with a letter and a number.</p>
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function MfaCard({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function init() {
    setBusy(true);
    setError("");
    try {
      const r = await apiSend<{ secret: string; otpauthUrl: string }>("/api/account/mfa", "POST", { action: "init" });
      setSecret(r.secret);
      setOtpauth(r.otpauthUrl);
      setEnrolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/account/mfa", "POST", { action: "enable", token: code });
      setEnrolling(false);
      setCode("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/account/mfa", "POST", { action: "disable", password });
      setPassword("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Multi-factor authentication
      </h2>

      {enabled ? (
        <>
          <p className="text-sm text-emerald-300">MFA is enabled on your account.</p>
          <div>
            <label className="label">Confirm password to disable</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-ghost" onClick={disable} disabled={busy || !password}>
            Disable MFA
          </button>
        </>
      ) : enrolling ? (
        <>
          <p className="text-sm text-slate-300">
            Add this account to your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="rounded-lg border border-ink-700 bg-ink-950 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Secret key (manual entry)</div>
            <div className="break-all font-mono text-sm text-brand-300">{secret}</div>
            <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">otpauth URI</div>
            <div className="break-all font-mono text-[11px] text-slate-400">{otpauth}</div>
          </div>
          <div>
            <label className="label">6-digit code</label>
            <input className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={enable} disabled={busy || code.length < 6}>
              Confirm &amp; enable
            </button>
            <button className="btn-ghost" onClick={() => setEnrolling(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            Protect your account with a time-based one-time code from an authenticator app.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary" onClick={init} disabled={busy}>
            Enable MFA
          </button>
        </>
      )}
    </div>
  );
}
