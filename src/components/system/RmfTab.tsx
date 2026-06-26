"use client";

import { StatusBadge, apiSend, useApi } from "@/components/ui";

type Step = {
  id: string;
  step: string;
  status: string;
  dueDate: string | null;
  owner: { name: string } | null;
};

const STEP_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"];

const STEP_DESC: Record<string, string> = {
  PREPARE: "Establish context and priorities for managing security and privacy risk.",
  CATEGORIZE: "Categorize the system and information based on impact analysis (FIPS 199).",
  SELECT: "Select the control baseline and tailor as needed.",
  IMPLEMENT: "Implement controls and document how they are deployed.",
  ASSESS: "Assess controls to determine whether they are implemented correctly.",
  AUTHORIZE: "Authorizing Official determines acceptable risk and issues the ATO.",
  MONITOR: "Continuously monitor controls, risk posture, and the environment.",
};

export function RmfTab({ systemId }: { systemId: string }) {
  const { data, loading, refetch } = useApi<Step[]>(`/api/rmf/${systemId}`);
  if (loading) return <p className="text-sm text-slate-400">Loading RMF steps…</p>;

  async function setStatus(step: string, status: string) {
    await apiSend(`/api/rmf/${systemId}`, "PATCH", { step, status });
    refetch();
  }

  return (
    <div className="space-y-3">
      {(data ?? []).map((s, i) => (
        <div key={s.id} className="card flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-sm font-bold text-slate-300">
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100">{s.step}</div>
              <StatusBadge value={s.status} />
            </div>
            <p className="mt-1 text-xs text-slate-400">{STEP_DESC[s.step]}</p>
            <div className="mt-2 flex items-center gap-3">
              <select
                className="input max-w-[200px] py-1 text-xs"
                value={s.status}
                onChange={(e) => setStatus(s.step, e.target.value)}
              >
                {STEP_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              {s.owner && <span className="text-xs text-slate-500">Owner: {s.owner.name}</span>}
              {s.dueDate && (
                <span className="text-xs text-slate-500">
                  Due {new Date(s.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
