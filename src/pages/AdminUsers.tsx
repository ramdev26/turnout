import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, FlowInput, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'organizer' | 'attendee' | 'super_admin';
  status: 'active' | 'suspended' | 'banned';
};

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | AdminUser['role']>('all');
  const [status, setStatus] = useState<'all' | AdminUser['status']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim() !== '') params.set('q', q.trim());
      if (role !== 'all') params.set('role', role);
      if (status !== 'all') params.set('status', status);
      const res = await api.get<{ users: AdminUser[] }>(`/api/admin/users?${params.toString()}`);
      setUsers(res.users);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="User Management" subtitle="Search, suspend, role changes and password reset controls.">
      <FlowCard>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FlowInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="rounded-xl border px-3 py-2 text-sm outline-none" style={selectStyle}>
            <option value="all">All roles</option>
            <option value="organizer">Organizer</option>
            <option value="attendee">Attendee</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-xl border px-3 py-2 text-sm outline-none" style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <FlowButton onClick={() => void load()}>Search</FlowButton>
        </div>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading users...</div>}
        <div className="mt-3 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5" style={cardMutedStyleFor(ui)}>
              <div>
                <div className="text-sm font-semibold" style={{ color: ui.text }}>
                  {u.displayName}{' '}
                  <span className="text-xs font-normal" style={{ color: ui.textMuted }}>({u.role})</span>
                </div>
                <div className="text-xs" style={{ color: ui.textMuted }}>{u.email} · {u.status}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/users/${u.id}/status`, { status: u.status === 'active' ? 'suspended' : 'active' }); await load(); }}>
                  {u.status === 'active' ? 'Suspend' : 'Activate'}
                </FlowButton>
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/users/${u.id}/force-password-reset`, {}); }}>
                  Force Reset
                </FlowButton>
                {u.role !== 'super_admin' ? (
                  <FlowButton onClick={async () => { await api.post(`/api/admin/users/${u.id}/role`, { role: u.role === 'attendee' ? 'organizer' : 'attendee' }); await load(); }}>
                    Toggle Role
                  </FlowButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
