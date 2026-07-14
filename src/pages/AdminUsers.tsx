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

type UserDetailResponse = {
  user: AdminUser & {
    createdAt: string;
    stats: { eventsCount: number; ordersCount: number; paidAmount: number };
  };
};

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | AdminUser['role']>('all');
  const [status, setStatus] = useState<'all' | AdminUser['status']>('all');
  const [selected, setSelected] = useState<UserDetailResponse | null>(null);
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

  const loadDetail = async (userId: string) => {
    try {
      const res = await api.get<UserDetailResponse>(`/api/admin/users/${userId}`);
      setSelected(res);
    } catch {
      setSelected(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setUserStatus = async (userId: string, next: AdminUser['status']) => {
    await api.post(`/api/admin/users/${userId}/status`, { status: next });
    await load();
    if (selected?.user.id === userId) await loadDetail(userId);
  };

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="User Management" subtitle="Search users, suspend or ban accounts, change roles, and force password resets.">
      <FlowCard>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FlowInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" />
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
        {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading users…</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border px-3 py-2.5" style={cardMutedStyleFor(ui)}>
                <button type="button" className="w-full text-left" onClick={() => void loadDetail(u.id)}>
                  <div className="text-sm font-semibold" style={{ color: ui.text }}>
                    {u.displayName}{' '}
                    <span className="text-xs font-normal" style={{ color: ui.textMuted }}>
                      ({u.role})
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: ui.textMuted }}>
                    {u.email} · {u.status}
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap gap-2">
                  {u.status === 'active' ? (
                    <>
                      <FlowButton variant="secondary" onClick={() => void setUserStatus(u.id, 'suspended')}>
                        Suspend
                      </FlowButton>
                      <FlowButton variant="secondary" onClick={() => void setUserStatus(u.id, 'banned')}>
                        Ban
                      </FlowButton>
                    </>
                  ) : (
                    <FlowButton variant="secondary" onClick={() => void setUserStatus(u.id, 'active')}>
                      Activate
                    </FlowButton>
                  )}
                  <FlowButton variant="secondary" onClick={() => void api.post(`/api/admin/users/${u.id}/force-password-reset`, {})}>
                    Force reset
                  </FlowButton>
                  {u.role === 'attendee' ? (
                    <FlowButton onClick={async () => { await api.post(`/api/admin/users/${u.id}/role`, { role: 'organizer' }); await load(); }}>
                      Make organizer
                    </FlowButton>
                  ) : u.role === 'organizer' ? (
                    <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/users/${u.id}/role`, { role: 'attendee' }); await load(); }}>
                      Make attendee
                    </FlowButton>
                  ) : null}
                  {u.role !== 'super_admin' ? (
                    <FlowButton
                      variant="secondary"
                      onClick={async () => {
                        if (!window.confirm(`Promote ${u.email} to super admin?`)) return;
                        await api.post(`/api/admin/users/${u.id}/role`, { role: 'super_admin' });
                        await load();
                      }}
                    >
                      Promote super admin
                    </FlowButton>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <aside className="rounded-xl border p-3" style={cardMutedStyleFor(ui)}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              User detail
            </p>
            {!selected ? (
              <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                Select a user to view stats.
              </p>
            ) : (
              <div className="mt-2 space-y-2 text-sm" style={{ color: ui.textMuted }}>
                <p className="font-semibold" style={{ color: ui.text }}>
                  {selected.user.displayName}
                </p>
                <p>{selected.user.email}</p>
                <p>Joined {new Date(selected.user.createdAt).toLocaleDateString()}</p>
                <p>Events: {selected.user.stats.eventsCount}</p>
                <p>Orders: {selected.user.stats.ordersCount}</p>
                <p>Paid total: LKR {selected.user.stats.paidAmount.toLocaleString()}</p>
              </div>
            )}
          </aside>
        </div>
      </FlowCard>
    </AdminShell>
  );
};
