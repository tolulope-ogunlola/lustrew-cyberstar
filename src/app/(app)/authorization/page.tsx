"use client";

import { useEffect, useState } from "react";
import { PageHeader, apiSend, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type SystemRow = { id: string; name: string; fipsCategory: string };
type Tab = "assessments" | "decisions" | "export";

export default function AuthorizationPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState("");
  const [tab, setTab] = useState<Tab>("assessments");

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader title="Assessment & Authorization" subtitle="Run security control assessments, record AO decisions, and export OSCAL" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">System</label>
        <select className="input max-w-xs" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
          {(systems ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.fipsCategory})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5 flex gap-1 border-b border-ink-800">
        {([
          ["assessments", "Assessments (SCA)"],
          ["decisions", "Authorization Decisions"],
          ["export", "OSCAL Export"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key ? "border-brand-500 text-brand-300" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {systemId && tab === "assessments" && <AssessmentsTab systemId={systemId} />}
      {systemId && tab === "decisions" && <DecisionsTab systemId={systemId} />}
      {systemId && tab === "export" && <ExportTab systemId={systemId} />}
    </div>
  );
}

// --- Assessments -----------------------------------------------------------
type AssessmentRow = { id: string; title: string; assessorName: string; status: string; completedAt: string | null; _count: { results: number } };

function AssessmentsTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<AssessmentRow[]>(`/api/assessments?systemId=${systemId}`);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const a = await apiSend<AssessmentRow>("/api/assessments", "POST", { systemId, title });
      setTitle("");
      await refetch();
      setOpenId(a.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-sm" placeholder="New assessment title (e.g. Annual SCA 2026)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary" onClick={create} disabled={creating || !title.trim()}>
          {creating ? "Starting…" : "Start assessment"}
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-2">
        {(data ?? []).map((a) => (
          <div key={a.id} className="card">
            <div className="flex cursor-pointer items-center justify-between" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
              <div>
                <div className="font-medium text-slate-100">{a.title}</div>
                <div className="text-xs text-slate-500">
                  {a.assessorName || "—"} · {a._count.results} controls · {a.status}
                  {a.completedAt ? ` · completed ${a.completedAt.slice(0, 10)}` : ""}
                </div>
              </div>
              <span className="text-xs text-brand-300">{openId === a.id ? "Close" : "Open"}</span>
            </div>
            {openId === a.id && <AssessmentDetail assessmentId={a.id} onChanged={refetch} />}
          </div>
        ))}
        {data && data.length === 0 && <p className="text-sm text-slate-500">No assessments yet. Start one to seed a result row per applicable control.</p>}
      </div>
    </div>
  );
}

type Result = { id: string; controlId: string; controlTitle: string; result: string; findings: string; recommendation: string };
type AssessmentDetailData = {
  id: string;
  status: string;
  summary: string;
  results: Result[];
  summary_counts: { satisfied: number; otherThanSatisfied: number; notApplicable: number; notAssessed: number; assessedPercent: number };
};

const RESULTS = ["SATISFIED", "OTHER_THAN_SATISFIED", "NOT_APPLICABLE", "NOT_ASSESSED"];

function AssessmentDetail({ assessmentId, onChanged }: { assessmentId: string; onChanged: () => void }) {
  const { data, loading, refetch } = useApi<AssessmentDetailData>(`/api/assessments/${assessmentId}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function saveResult(r: Result, patch: Partial<Pick<Result, "result" | "findings" | "recommendation">>) {
    await apiSend(`/api/assessments/${assessmentId}/results/${r.id}`, "PATCH", patch);
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/assessments/${assessmentId}`, "PATCH", { status: "COMPLETED" });
      await refetch();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) return <p className="mt-3 text-sm text-slate-400">Loading results…</p>;
  const c = data.summary_counts;

  return (
    <div className="mt-3 border-t border-ink-800 pt-3">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span className="text-emerald-700 dark:text-emerald-300">{c.satisfied} satisfied</span>
        <span className="text-red-600 dark:text-red-400">{c.otherThanSatisfied} other than satisfied</span>
        <span>{c.notApplicable} N/A</span>
        <span>{c.notAssessed} not assessed</span>
        <span className="ml-auto">{c.assessedPercent}% assessed</span>
        {data.status !== "COMPLETED" && (
          <button className="btn-primary" onClick={complete} disabled={busy || c.notAssessed > 0} title={c.notAssessed > 0 ? "Assess every control first" : ""}>
            {busy ? "…" : "Mark complete"}
          </button>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="max-h-[55vh] space-y-2 overflow-y-auto">
        {data.results.map((r) => (
          <ResultRow key={r.id} r={r} disabled={data.status === "COMPLETED"} onSave={saveResult} />
        ))}
      </div>
    </div>
  );
}

function ResultRow({
  r,
  disabled,
  onSave,
}: {
  r: Result;
  disabled: boolean;
  onSave: (r: Result, patch: Partial<Pick<Result, "result" | "findings" | "recommendation">>) => Promise<void>;
}) {
  const [result, setResult] = useState(r.result);
  const [findings, setFindings] = useState(r.findings);
  const [recommendation, setRecommendation] = useState(r.recommendation);
  const [open, setOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  async function commit(patch: Partial<Pick<Result, "result" | "findings" | "recommendation">>) {
    await onSave(r, patch);
    setSavedAt(Date.now());
  }

  return (
    <div className="rounded-lg border border-ink-800 p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-slate-200">{r.controlId}</span>
          <span className="ml-2 text-xs text-slate-500">{r.controlTitle}</span>
        </div>
        <select
          className="input max-w-[12rem] py-1 text-xs"
          value={result}
          disabled={disabled}
          onChange={(e) => {
            setResult(e.target.value);
            commit({ result: e.target.value });
          }}
        >
          {RESULTS.map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="text-xs text-brand-300" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Notes"}
        </button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <textarea
            className="input h-20 text-xs"
            placeholder="Findings"
            value={findings}
            disabled={disabled}
            onChange={(e) => setFindings(e.target.value)}
            onBlur={() => commit({ findings })}
          />
          <textarea
            className="input h-20 text-xs"
            placeholder="Recommendation"
            value={recommendation}
            disabled={disabled}
            onChange={(e) => setRecommendation(e.target.value)}
            onBlur={() => commit({ recommendation })}
          />
          {savedAt > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
        </div>
      )}
    </div>
  );
}

// --- Decisions -------------------------------------------------------------
type Decision = {
  id: string;
  decision: string;
  authorizingOfficial: string;
  decisionDate: string;
  expiresAt: string | null;
  rationale: string;
  conditions: string;
  signedBy: { name: string } | null;
};

const DECISIONS = ["ATO", "ATO_WITH_CONDITIONS", "IATT", "DENIED", "REVOKED"];
const DECISION_CLASS: Record<string, string> = {
  ATO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ATO_WITH_CONDITIONS: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  IATT: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  DENIED: "bg-red-500/15 text-red-700 dark:text-red-300",
  REVOKED: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function DecisionsTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Decision[]>(`/api/authorizations?systemId=${systemId}`);
  const [form, setForm] = useState({ decision: "ATO", authorizingOfficial: "", expiresAt: "", rationale: "", conditions: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function record() {
    if (!form.authorizingOfficial.trim()) {
      setError("Authorizing Official name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiSend("/api/authorizations", "POST", {
        systemId,
        decision: form.decision,
        authorizingOfficial: form.authorizingOfficial,
        expiresAt: form.expiresAt || undefined,
        rationale: form.rationale || undefined,
        conditions: form.conditions || undefined,
      });
      setForm({ decision: "ATO", authorizingOfficial: "", expiresAt: "", rationale: "", conditions: "" });
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Record authorization decision</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Decision</label>
            <select className="input" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {d.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Authorizing Official</label>
            <input className="input" value={form.authorizingOfficial} onChange={(e) => setForm({ ...form, authorizingOfficial: e.target.value })} />
          </div>
          <div>
            <label className="label">ATO expiration (optional)</label>
            <input type="date" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <div>
            <label className="label">Rationale</label>
            <textarea className="input h-20" value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} />
          </div>
          <div>
            <label className="label">Terms &amp; conditions</label>
            <textarea className="input h-20" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button className="btn-primary" onClick={record} disabled={saving}>
            {saving ? "Recording…" : "Record decision"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Decision history</h2>
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        <div className="space-y-2">
          {(data ?? []).map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-center justify-between">
                <span className={`badge ${DECISION_CLASS[d.decision] ?? "bg-ink-700 text-slate-300"}`}>{d.decision.replaceAll("_", " ")}</span>
                <span className="text-xs text-slate-500">{d.decisionDate.slice(0, 10)}</span>
              </div>
              <div className="mt-1 text-sm text-slate-200">AO: {d.authorizingOfficial}</div>
              {d.expiresAt && <div className="text-xs text-slate-500">Expires {d.expiresAt.slice(0, 10)}</div>}
              {d.rationale && <p className="mt-1 text-xs text-slate-400">{d.rationale}</p>}
              {d.conditions && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Conditions: {d.conditions}</p>}
              {d.signedBy && <div className="mt-1 text-xs text-slate-500">Recorded by {d.signedBy.name}</div>}
            </div>
          ))}
          {data && data.length === 0 && <p className="text-sm text-slate-500">No authorization decisions recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}

// --- OSCAL export ----------------------------------------------------------
function ExportTab({ systemId }: { systemId: string }) {
  return (
    <div className="card max-w-xl">
      <h2 className="mb-2 text-sm font-semibold text-slate-100">OSCAL export</h2>
      <p className="mb-4 text-sm text-slate-400">
        Download machine-readable OSCAL 1.1.2 JSON for ingestion by eMASS, RegScale, or other OSCAL-aware tools.
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary" href={`/api/systems/${systemId}/oscal?type=ssp`}>
          <Icon name="doc" className="h-4 w-4" /> OSCAL SSP
        </a>
        <a className="btn-ghost" href={`/api/systems/${systemId}/oscal?type=assessment`}>
          <Icon name="doc" className="h-4 w-4" /> OSCAL Assessment Results (latest completed)
        </a>
      </div>
    </div>
  );
}
