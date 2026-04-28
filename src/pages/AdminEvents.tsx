import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { Button } from '../components/ui/Button';

type AdminEvent = { id: string; title: string; status: string; eventStatus: 'pending' | 'approved' | 'rejected' | 'suspended'; isFeatured: boolean; organizerName: string };

export const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdminEvent['eventStatus']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim() !== '') params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);
      setEvents((await api.get<{ events: AdminEvent[] }>(`/api/admin/events?${params.toString()}`)).events);
    } catch (e: any) {
      setError(e?.error || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Event Control" subtitle="Moderate approvals, publishing and featured events.">
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or slug..." className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | AdminEvent['eventStatus'])} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <option value="all">All moderation statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button onClick={load}>Filter</Button>
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-neutral-500">Loading events...</div> : null}
        {events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-sm">
              <div className="font-semibold text-neutral-900">{e.title}</div>
              <div className="text-xs text-neutral-500">{e.organizerName} • {e.eventStatus} • {e.status}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { eventStatus: 'approved' }); await load(); }}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { eventStatus: 'rejected' }); await load(); }}>Reject</Button>
              <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/status`, { status: 'blocked' }); await load(); }}>Unpublish</Button>
              <Button size="sm" onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { isFeatured: !e.isFeatured }); await load(); }}>{e.isFeatured ? 'Unfeature' : 'Feature'}</Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
};
