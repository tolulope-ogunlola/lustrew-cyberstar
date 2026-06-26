"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, apiSend, useApi } from "@/components/ui";
import { ROLES } from "@/lib/validation";
import { ROLE_LABEL } from "@/lib/rbac";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
};

export default function AdminUsersPage() {
  const { data, loading, refetch } = useApi<UserRow[]>("/api/admin/users");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  async function patch(id: string, body: Record<string, unknown>) {
    const r = await apiSend<{ tempPassword?: string }>(`/api/admin/users/${id}`, "PATCH", body);
    if (r.tempPassword) setNotice(`New temporary password: ${r.tempPassword}`);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage accounts, roles, and access"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>Invite user</button>}
      />

      {notice && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-mono text-sm text-amber-200">
          {notice}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="overflow-hidden rounded-xl border border-ink-700">
        <table className="w-full">
          <thead className="bg-ink-900">
            <tr>
              <th className="th">User</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">MFA</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {(data ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-ink-900/40">
                <td className="td">
                  <div className="font-medium text-slate-100">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="td">
                  <select
                    className="input py-1 text-xs"
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r as keyof typeof ROLE_LABEL]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <StatusBadge value={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  {u.mustChangePassword && (
                    <div className="mt-1 text-[10px] text-amber-300">temp password</div>
                  )}
                </td>
                <td className="td text-xs">
                  {u.mfaEnabled ? <span className="text-emerald-300">on</span> : <span className="text-slate-500">off</span>}
                </td>
                <td className="td">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button className="text-brand-300 hover:underline" onClick={() => patch(u.id, { isActive: !u.isActive })}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button className="text-brand-300 hover:underline" onClick={() => patch(u.id, { resetPassword: true })}>
                      Reset password
                    </button>
                    {u.mfaEnabled && (
                      <button className="text-brand-300 hover:underline" onClick={() => patch(u.id, { resetMfa: true })}>
                        Reset MFA
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <InviteModal onClose={() => setOpen(false)} onCreated={(msg) => { setNotice(msg); refetch(); }} />}
    </div>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ISSO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiSend<{ email: string; tempPassword: string }>("/api/admin/users", "POST", { name, email, role });
      onCreated(`Invited ${r.email}. Temporary password: ${r.tempPassword}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Invite user</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r as keyof typeof ROLE_LABEL]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Inviting…" : "Invite"}</button>
        </div>
      </form>
    </div>
  );
}
