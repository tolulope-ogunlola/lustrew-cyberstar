"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, apiSend, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";

type SystemRow = { id: string; name: string; fipsCategory: string };
type Tab = "chat" | "gaps" | "documents";

export default function CopilotPage() {
  const { data: systems } = useApi<SystemRow[]>("/api/systems");
  const [systemId, setSystemId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("chat");

  useEffect(() => {
    if (systems && systems.length && !systemId) setSystemId(systems[0].id);
  }, [systems, systemId]);

  return (
    <div>
      <PageHeader title="AI Compliance Copilot" subtitle="Ask, analyze gaps, and generate ATO documents — grounded in your system's data" />

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
          ["chat", "Chat"],
          ["gaps", "Gap Analysis"],
          ["documents", "Documents"],
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

      <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <Icon name="info" className="h-4 w-4 shrink-0" />
        Copilot output is a grounded draft for human review — never a final authorization decision.
      </p>

      {systemId && tab === "chat" && <ChatTab systemId={systemId} />}
      {systemId && tab === "gaps" && <GapsTab systemId={systemId} />}
      {systemId && tab === "documents" && <DocsTab systemId={systemId} />}
    </div>
  );
}

// --- Chat ------------------------------------------------------------------
type Msg = { role: "user" | "assistant"; content: string };

function ChatTab({ systemId }: { systemId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages([]), [systemId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    const history = messages;
    setMessages([...history, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiSend<{ text: string; source: string; notice?: string; citations: string[] }>("/api/ai/chat", "POST", {
        systemId,
        question,
        history,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.text }]);
      setCitations(res.citations ?? []);
      setNotice(res.notice);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "request failed"}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="max-h-[50vh] min-h-[200px] space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">
            Ask about control implementation, open POA&Ms, what's blocking your ATO, evidence gaps, and more.
            <div className="mt-2 flex flex-wrap gap-2">
              {["What is blocking my ATO?", "Which controls lack evidence?", "Summarize my open high risks"].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="rounded-md border border-ink-700 px-2 py-1 text-xs hover:bg-ink-800">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-brand-600/20 text-slate-100" : "bg-ink-800 text-slate-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">Thinking…</div>}
        <div ref={endRef} />
      </div>

      {citations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-ink-800 pt-3 text-xs text-slate-500">
          <span>Sources:</span>
          {citations.map((c) => (
            <span key={c} className="badge bg-ink-700 text-slate-300">
              {c}
            </span>
          ))}
        </div>
      )}
      {notice && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{notice}</p>}

      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask the Copilot…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

// --- Gap analysis ----------------------------------------------------------
type Gap = { id: string; category: string; severity: "HIGH" | "MEDIUM" | "LOW"; count: number; items: string[]; recommendation: string };
type GapResp = { score: { readinessScore: number }; gaps: Gap[]; narrative: { text: string; source: string; notice?: string } };

const SEV_CLASS: Record<string, string> = {
  HIGH: "bg-red-500/15 text-red-700 dark:text-red-300",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

function GapsTab({ systemId }: { systemId: string }) {
  const [data, setData] = useState<GapResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setData(null), [systemId]);

  async function run() {
    setLoading(true);
    setError("");
    try {
      setData(await apiSend<GapResp>("/api/ai/gap-analysis", "POST", { systemId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!data && (
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? "Analyzing…" : "Run gap analysis"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Assessment &amp; path to ATO</h2>
              <button className="btn-ghost text-xs" onClick={run} disabled={loading}>
                {loading ? "…" : "Re-run"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-300">{data.narrative.text}</p>
            {data.narrative.notice && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{data.narrative.notice}</p>}
          </div>

          {data.gaps.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">No gaps detected by the automated checks. 🎉</p>
          ) : (
            data.gaps.map((g) => (
              <div key={g.id} className="card">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-100">{g.category}</h3>
                  <span className={`badge ${SEV_CLASS[g.severity]}`}>
                    {g.severity} · {g.count}
                  </span>
                </div>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
                  {g.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                  {g.count > g.items.length && <li className="text-slate-500">…and {g.count - g.items.length} more</li>}
                </ul>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-200">Recommendation:</span> {g.recommendation}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Documents -------------------------------------------------------------
function DocsTab({ systemId }: { systemId: string }) {
  const [doc, setDoc] = useState<{ markdown: string; notice?: string; kind: string } | null>(null);
  const [loading, setLoading] = useState<string>("");

  useEffect(() => setDoc(null), [systemId]);

  async function gen(kind: "ssp" | "sar") {
    setLoading(kind);
    try {
      const res = await apiSend<{ markdown: string; notice?: string }>("/api/ai/document", "POST", { systemId, kind });
      setDoc({ ...res, kind });
    } catch (e) {
      setDoc({ markdown: `Error: ${e instanceof Error ? e.message : "failed"}`, kind });
    } finally {
      setLoading("");
    }
  }

  function download() {
    if (!doc) return;
    const blob = new Blob([doc.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.kind.toUpperCase()}-${systemId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => gen("ssp")} disabled={!!loading}>
          {loading === "ssp" ? "Generating…" : "Generate SSP"}
        </button>
        <button className="btn-primary" onClick={() => gen("sar")} disabled={!!loading}>
          {loading === "sar" ? "Generating…" : "Generate SAR"}
        </button>
        {doc && (
          <button className="btn-ghost" onClick={download}>
            <Icon name="doc" className="h-4 w-4" /> Download .md
          </button>
        )}
      </div>

      {doc && (
        <>
          {doc.notice && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{doc.notice}</p>}
          <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900 p-4 text-xs text-slate-300">
            {doc.markdown}
          </pre>
        </>
      )}
    </div>
  );
}
