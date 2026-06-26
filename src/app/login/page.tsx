"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const DEMO = [
  { role: "Administrator", email: "admin@cyberstar.gov" },
  { role: "ATO/A&A SME", email: "sme@cyberstar.gov" },
  { role: "ISSO / Analyst", email: "isso@cyberstar.gov" },
  { role: "Vuln Analyst", email: "vuln@cyberstar.gov" },
  { role: "System Owner", email: "owner@cyberstar.gov" },
  { role: "Executive", email: "exec@cyberstar.gov" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("sme@cyberstar.gov");
  const [password, setPassword] = useState("Password123!");
  const [totp, setTotp] = useState("");
  const [mfaHint, setMfaHint] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, totp, redirect: false });
    setLoading(false);
    if (res?.error) {
      if (res.error.includes("MFA")) {
        setMfaHint(true);
        setError("Enter your authenticator code to continue.");
      } else if (res.error.includes("Too many")) {
        setError("Too many failed attempts. Try again in a few minutes.");
      } else {
        setError("Invalid email or password.");
      }
      return;
    }
    // Only follow same-origin relative callbacks (block open-redirect via ?callbackUrl=).
    const cb = params.get("callbackUrl") || "";
    const safe = /^\/(?!\/)/.test(cb) ? cb : "/dashboard";
    router.push(safe);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-xs text-slate-400 hover:text-brand-300">← Back to home</Link>
          <ThemeToggle />
        </div>
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-brand-400">Lustrew CyberStar</div>
          <p className="mt-1 text-sm text-slate-400">
            ATO/A&amp;A · RMF · Continuous Monitoring
          </p>
        </div>

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
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className={mfaHint ? "" : "opacity-70"}>
            <label className="label">Authenticator code {mfaHint ? "" : "(only if MFA is enabled)"}</label>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="text-center">
            <a href="/forgot" className="text-xs text-slate-400 hover:text-brand-300">
              Forgot password?
            </a>
          </div>
        </form>

        <div className="card mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Demo accounts (password: Password123!)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => setEmail(d.email)}
                className="rounded-lg border border-ink-600 px-2 py-1.5 text-left text-xs hover:bg-ink-800"
              >
                <div className="font-medium text-slate-200">{d.role}</div>
                <div className="text-slate-500">{d.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
