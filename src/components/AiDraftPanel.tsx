"use client";

import { useRef, useState } from "react";
import { apiSend } from "./ui";
import { useFocusTrap } from "@/lib/useFocusTrap";

type DraftKind = "control_narrative" | "poam_description" | "executive_summary";
type DraftResult = { text: string; source: "claude" | "stub"; notice?: string };

/**
 * Generates an AI draft and lets the user accept it. Draft output is always clearly labeled
 * and never auto-applied — onAccept hands the (possibly edited) text back to the caller.
 */
export function AiDraftPanel({
  kind,
  systemId,
  implementationId,
  poamId,
  onAccept,
  onClose,
  acceptLabel = "Use this draft",
}: {
  kind: DraftKind;
  systemId: string;
  implementationId?: string;
  poamId?: string;
  onAccept?: (text: string) => void;
  onClose: () => void;
  acceptLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await apiSend<DraftResult>("/api/ai/draft", "POST", {
        kind,
        systemId,
        implementationId,
        poamId,
      });
      setResult(res);
      setText(res.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="AI draft" className="w-full max-w-2xl rounded-xl border border-ink-700 bg-ink-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">AI assistant — draft</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          AI-generated draft — requires human review. Not a final authorization decision.
        </div>

        {!result && (
          <button onClick={generate} className="btn-primary" disabled={loading}>
            {loading ? "Generating…" : "Generate draft"}
          </button>
        )}

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {result && (
          <>
            {result.notice && (
              <p className="mb-2 text-xs text-slate-400">{result.notice}</p>
            )}
            <p className="mb-1 text-xs text-slate-500">
              Source: {result.source === "claude" ? "Claude" : "templated stub"}
            </p>
            <textarea
              className="input h-56 font-mono text-xs leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={generate} className="btn-ghost" disabled={loading}>
                Regenerate
              </button>
              {onAccept && (
                <button
                  onClick={() => {
                    onAccept(text);
                    onClose();
                  }}
                  className="btn-primary"
                >
                  {acceptLabel}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
