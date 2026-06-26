"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ orgName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Signup failed");
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-sm text-slate-400 hover:text-slate-200">← Back to home</Link>
        <div className="card">
          <h1 className="text-xl font-semibold text-slate-100">Create your organization</h1>
          <p className="mt-1 text-sm text-slate-400">
            Spin up a new CyberStar workspace. You&apos;ll be the administrator and can invite your team afterward.
          </p>

          {done ? (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              Organization created — redirecting you to sign in…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <div>
                <label className="label">Organization name</label>
                <input className="input" value={form.orgName} onChange={(e) => set("orgName", e.target.value)} required placeholder="Acme Defense LLC" />
              </div>
              <div>
                <label className="label">Your name</label>
                <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div>
                <label className="label">Work email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} required placeholder="10+ chars, letters & numbers" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Creating…" : "Create organization"}
              </button>
            </form>
          )}

          <p className="mt-4 text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-300 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
