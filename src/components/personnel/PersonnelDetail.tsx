"use client";

import { useState } from "react";
import { StatusBadge, apiSend, useApi } from "@/components/ui";
import { TRAINING_STATUS, ACCESS_REVIEW_STATUS, BG_CHECK_STATUS } from "@/lib/validation";

type Detail = {
  id: string;
  fullName: string;
  bgCheckStatus: string;
  user: { email: string; mfaEnabled: boolean } | null;
  trainingAssignments: { id: string; status: string; dueDate: string | null; course: { name: string } }[];
  accessReviews: { id: string; scope: string; status: string; dueDate: string | null }[];
  onboardingTasks: { id: string; phase: string; title: string; done: boolean; dueDate: string | null }[];
};

type Course = { id: string; name: string };

export function PersonnelDetail({ personId, onClose, onChanged }: { personId: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, refetch } = useApi<Detail>(`/api/personnel/${personId}`);
  const { data: courses } = useApi<Course[]>("/api/training-courses");
  const [courseId, setCourseId] = useState("");
  const [reviewScope, setReviewScope] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  async function refresh() {
    await refetch();
    onChanged();
  }
  async function assignTraining() {
    if (!courseId) return;
    await apiSend(`/api/personnel/${personId}/training`, "POST", { courseId });
    setCourseId("");
    refresh();
  }
  async function addReview() {
    await apiSend(`/api/personnel/${personId}/access-reviews`, "POST", { scope: reviewScope });
    setReviewScope("");
    refresh();
  }
  async function addTask() {
    if (!taskTitle) return;
    await apiSend(`/api/personnel/${personId}/tasks`, "POST", { title: taskTitle });
    setTaskTitle("");
    refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{data?.fullName ?? "Personnel"}</h3>
          <button className="btn-ghost py-1 text-xs" onClick={onClose}>Close</button>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {data && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>{data.user ? `App user · MFA ${data.user.mfaEnabled ? "on" : "off"}` : "No linked app user"}</span>
              <label className="flex items-center gap-2">
                Background check:
                <select
                  className="input max-w-[160px] py-1 text-xs"
                  value={data.bgCheckStatus}
                  onChange={async (e) => { await apiSend(`/api/personnel/${personId}`, "PATCH", { bgCheckStatus: e.target.value }); refresh(); }}
                >
                  {BG_CHECK_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                </select>
              </label>
            </div>

            {/* Training */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-200">Training</h4>
              <div className="space-y-1">
                {data.trainingAssignments.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-1.5 text-xs">
                    <span className="text-slate-300">{t.course.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={t.status} />
                      <select
                        className="input max-w-[140px] py-0.5 text-xs"
                        value={t.status}
                        onChange={async (e) => { await apiSend(`/api/training-assignments/${t.id}`, "PATCH", { status: e.target.value }); refresh(); }}
                      >
                        {TRAINING_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {data.trainingAssignments.length === 0 && <p className="text-xs text-slate-500">No training assigned.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <select className="input py-1 text-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">Select course…</option>
                  {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn-ghost py-1 text-xs" onClick={assignTraining}>Assign</button>
              </div>
            </section>

            {/* Access reviews */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-200">Access reviews</h4>
              <div className="space-y-1">
                {data.accessReviews.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-1.5 text-xs">
                    <span className="text-slate-300">{r.scope || "Access review"}</span>
                    <select
                      className="input max-w-[140px] py-0.5 text-xs"
                      value={r.status}
                      onChange={async (e) => { await apiSend(`/api/access-reviews/${r.id}`, "PATCH", { status: e.target.value }); refresh(); }}
                    >
                      {ACCESS_REVIEW_STATUS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                    </select>
                  </div>
                ))}
                {data.accessReviews.length === 0 && <p className="text-xs text-slate-500">No access reviews.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="input py-1 text-xs" placeholder="Scope (system/app)" value={reviewScope} onChange={(e) => setReviewScope(e.target.value)} />
                <button className="btn-ghost py-1 text-xs" onClick={addReview}>Add review</button>
              </div>
            </section>

            {/* Onboarding / offboarding */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-200">Onboarding / offboarding</h4>
              <div className="space-y-1">
                {data.onboardingTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={async (e) => { await apiSend(`/api/onboarding-tasks/${t.id}`, "PATCH", { done: e.target.checked }); refresh(); }}
                    />
                    <span className={t.done ? "line-through text-slate-500" : ""}>{t.title}</span>
                    <span className="ml-auto text-slate-500">{t.phase}</span>
                  </label>
                ))}
                {data.onboardingTasks.length === 0 && <p className="text-xs text-slate-500">No tasks.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="input py-1 text-xs" placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                <button className="btn-ghost py-1 text-xs" onClick={addTask}>Add task</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
