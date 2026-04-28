import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { Button } from '../components/ui/Button';

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
  const onRoleFilterChange = (value: string) => setRole(value as 'all' | AdminUser['role']);
  const onStatusFilterChange = (value: string) => setStatus(value as 'all' | AdminUser['status']);

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim() !== '') params.set('q', q.trim());
      if (role !== 'all') params.set('role', role);
      if (status !== 'all') params.set('status', status);
      const res = await api.get<{ users: AdminUser[] }>(`/api/admin/users?${params.toString()}`);
      setUsers(res.users);
    } catch (e: any) {
      setError(e?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="User Management" subtitle="Search, suspend, role changes and password reset controls.">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => onRoleFilterChange(e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <option value="all">All roles</option>
            <option value="organizer">Organizer</option>
            <option value="attendee">Attendee</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select value={status} onChange={(e) => onStatusFilterChange(e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <Button onClick={load}>Search</Button>
        </div>
        {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-neutral-500">Loading users...</div> : null}
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-neutral-900">{u.displayName} <span className="text-xs text-neutral-500">({u.role})</span></div>
                <div className="text-xs text-neutral-500">{u.email} • {u.status}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/users/${u.id}/status`, { status: u.status === 'active' ? 'suspended' : 'active' }); await load(); }}>
                  {u.status === 'active' ? 'Suspend' : 'Activate'}
                </Button>
                <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/users/${u.id}/force-password-reset`, {}); }}>
                  Force Reset
                </Button>
                {u.role !== 'super_admin' ? (
                  <Button size="sm" onClick={async () => { await api.post(`/api/admin/users/${u.id}/role`, { role: u.role === 'attendee' ? 'organizer' : 'attendee' }); await load(); }}>
                    Toggle Role
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
};
