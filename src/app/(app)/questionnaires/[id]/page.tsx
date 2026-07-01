"use client";

import { use, useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";

type Item = {
  id: string;
  rowIndex: number;
  section: string;
  question: string;
  draftAnswer: string;
  approvedAnswer: string;
  status: string;
  confidence: number;
  source: string;
};
type Detail = { id: string; name: string; customer: string; status: string; items: Item[] };

export default function QuestionnaireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, refetch } = useApi<Detail>(`/api/questionnaires/${id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function draftAll() {
    setBusy(true);
    setMsg("");
    try {
      const r = await apiSend<{ drafted: number; usedAi: boolean }>(`/api/questionnaires/${id}/draft`, "POST");
      setMsg(`Drafted ${r.drafted} item(s)${r.usedAi ? " (AI used for low-confidence matches)" : ""}. Review and approve before export.`);
      await refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const approved = items.filter((i) => i.status === "APPROVED").length;
  const allApproved = items.length > 0 && approved === items.length;

  return (
    <div>
      <PageHeader
        title={data?.name ?? "Questionnaire"}
        subtitle={data ? `${data.customer || "—"} · ${approved}/${items.length} approved` : ""}
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={busy} onClick={draftAll}>{busy ? "Drafting…" : "Draft all with AI"}</button>
            <a
              className={`btn-primary ${allApproved ? "" : "pointer-events-none opacity-50"}`}
              href={`/api/questionnaires/${id}/export?format=xlsx`}
            >
              Export XLSX
            </a>
          </div>
        }
      />
      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}
      {!allApproved && items.length > 0 && <p className="mb-4 text-xs text-amber-400">Approve every answer to enable export.</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="space-y-3">
        {items.map((item) => <ItemRow key={item.id} qid={id} item={item} onChanged={refetch} />)}
      </div>
    </div>
  );
}

function ItemRow({ qid, item, onChanged }: { qid: string; item: Item; onChanged: () => void }) {
  const [answer, setAnswer] = useState(item.approvedAnswer || item.draftAnswer);

  async function save(status?: string) {
    await apiSend(`/api/questionnaires/${qid}/items/${item.id}`, "PATCH", {
      draftAnswer: answer,
      approvedAnswer: answer,
      status: status ?? item.status,
    });
    onChanged();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {item.section && <div className="text-xs uppercase text-slate-500">{item.section}</div>}
          <div className="font-medium text-slate-100">{item.question}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.source && <span className="badge bg-ink-700 text-slate-400">{item.source}{item.confidence ? ` ${Math.round(item.confidence * 100)}%` : ""}</span>}
          <StatusBadge value={item.status} />
        </div>
      </div>
      <textarea
        className="input mt-2 h-20 w-full"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Answer (draft from library/AI, edit as needed)"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn-ghost py-1 text-xs" onClick={() => save("DRAFTED")}>Save draft</button>
        <button className="btn-primary py-1 text-xs" onClick={() => save("APPROVED")} disabled={!answer.trim()}>Approve</button>
      </div>
    </div>
  );
}
