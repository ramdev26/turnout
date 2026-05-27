import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, FlowInput, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

type AdminEvent = {
  id: string;
  title: string;
  status: string;
  eventStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  isFeatured: boolean;
  organizerName: string;
};

export const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdminEvent['eventStatus']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim() !== '') params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);
      setEvents((await api.get<{ events: AdminEvent[] }>(`/api/admin/events?${params.toString()}`)).events);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="Event Control" subtitle="Moderate approvals, publishing and featured events.">
      <FlowCard>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <FlowInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or slug..." />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-xl border px-3 py-2 text-sm outline-none" style={selectStyle}>
            <option value="all">All moderation statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <FlowButton onClick={() => void load()}>Filter</FlowButton>
        </div>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading events...</div>}
        <div className="mt-2 space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5" style={cardMutedStyleFor(ui)}>
              <div className="text-sm min-w-0">
                <div className="font-semibold" style={{ color: ui.text }}>{e.title}</div>
                <div className="text-xs" style={{ color: ui.textMuted }}>{e.organizerName} · {e.eventStatus} · {e.status}</div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { eventStatus: 'approved' }); await load(); }}>Approve</FlowButton>
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { eventStatus: 'rejected' }); await load(); }}>Reject</FlowButton>
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/events/${e.id}/status`, { status: 'blocked' }); await load(); }}>Unpublish</FlowButton>
                <FlowButton onClick={async () => { await api.post(`/api/admin/events/${e.id}/moderate`, { isFeatured: !e.isFeatured }); await load(); }}>
                  {e.isFeatured ? 'Unfeature' : 'Feature'}
                </FlowButton>
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
