import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "clock", title: "ATO & RMF lifecycle", body: "Run systems through Prepare → Monitor with owners, due dates, and a live readiness score." },
  { icon: "shield", title: "NIST 800-53 controls", body: "Track implementation status, scoping, SSP narratives, and evidence coverage per control." },
  { icon: "alert", title: "Vulnerabilities & STIG", body: "Import Nessus/ACAS scans and DISA .ckl checklists, prioritize, and convert to POA&Ms." },
  { icon: "flag", title: "POA&M management", body: "Track weaknesses to remediation with milestones and an append-only status history." },
  { icon: "scale", title: "Risk register", body: "Score inherent and residual risk on a 5×5 matrix with formal acceptance workflows." },
  { icon: "gauge", title: "Continuous monitoring", body: "A live posture dashboard plus a rules engine that flags overdue and high-risk items." },
  { icon: "doc", title: "Reports & eMASS", body: "Export audit-ready PDF/XLSX/CSV reports and eMASS-style POA&M files for stakeholders." },
  { icon: "bolt", title: "AI assistant", body: "Draft SSP narratives, POA&M descriptions, and executive summaries — always human-reviewed." },
];

const PERSONAS: { icon: IconName; title: string; body: string }[] = [
  { icon: "server", title: "Federal contractors", body: "Stand up and maintain ATO packages without a heavyweight GRC suite." },
  { icon: "users", title: "ISSOs & analysts", body: "Centralize controls, evidence, and continuous monitoring in one place." },
  { icon: "alert", title: "Vulnerability analysts", body: "Turn scan output into prioritized, tracked remediation work." },
  { icon: "trend", title: "Executives & PMs", body: "See authorization readiness and top risks at a glance." },
];

const RMF_STEPS = ["Prepare", "Categorize", "Select", "Implement", "Assess", "Authorize", "Monitor"];

export default async function Home() {
  const user = await currentUser();
  const primaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "Open dashboard" : "Sign in";
  const signupEnabled = !user && process.env.SIGNUP_ENABLED === "true";

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="bolt" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-100">CyberStar</div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Lustrew Dynamics</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signupEnabled && (
              <Link href="/signup" className="btn-ghost">
                Create account
              </Link>
            )}
            <Link href={primaryHref} className="btn-primary">
              {primaryLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <span className="pill border-brand-500/30 bg-brand-500/10 text-brand-400">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          ATO/A&amp;A · RMF · Continuous Monitoring
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl">
          The operating system for regulated cybersecurity compliance
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          CyberStar automates the work of an ATO/A&amp;A, RMF, and continuous-monitoring analyst —
          control tracking, evidence, vulnerabilities, POA&amp;Ms, risk, and audit-ready reporting —
          in one platform.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href={primaryHref} className="btn-primary px-5 py-2.5">
            {primaryLabel} <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
          {signupEnabled ? (
            <Link href="/signup" className="btn-ghost px-5 py-2.5">Create an organization</Link>
          ) : (
            <a href="#features" className="btn-ghost px-5 py-2.5">Explore features</a>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Accelerates preparation and visibility — it supports, never replaces, ISSM/AO decisions.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
          One platform, the whole lifecycle
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="icon-tile bg-brand-500/15 text-brand-400">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold text-slate-100">{f.title}</div>
              <p className="mt-1 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RMF strip */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="card">
          <div className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
            Built around the RMF lifecycle
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {RMF_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-slate-200">
                  <span className="mr-1.5 text-xs font-bold text-brand-400">{i + 1}</span>
                  {s}
                </span>
                {i < RMF_STEPS.length - 1 && <Icon name="arrowRight" className="h-4 w-4 text-slate-600" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">Who it's for</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <div key={p.title} className="card">
              <div className="icon-tile bg-accent-500/15 text-accent-400">
                <Icon name={p.icon} className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold text-slate-100">{p.title}</div>
              <p className="mt-1 text-sm text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security strip */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="icon-tile bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Icon name="shield" className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-slate-100">Secure by design</div>
            <p className="mt-1 text-sm text-slate-400">
              Role-based access, tenant isolation, MFA, append-only audit logging, encrypted-at-rest
              evidence with malware scanning, and strict security headers.
            </p>
          </div>
          <Link href={primaryHref} className="btn-primary">{primaryLabel}</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Lustrew Dynamics · CyberStar</span>
          <span>Accelerates ATO/A&amp;A preparation · human-approved, never automated authorization</span>
        </div>
      </footer>
    </div>
  );
}
