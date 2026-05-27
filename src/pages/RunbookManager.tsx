import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { RunbookItem } from '../types';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowCard, FlowStatCard, FlowInput, FlowButton, FlowAlert } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

export const RunbookManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [items, setItems] = useState<RunbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueAt, setDueAt] = useState('');
  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);
  const ui = APP_FLOW_UI;

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: RunbookItem[] }>(`/api/events/${eventId}/runbook`);
      setItems(res.items);
    } catch (e: any) {
      setError(e?.error || 'Failed to load runbook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const addItem = async () => {
    if (!eventId || !title.trim()) return;
    setError(null);
    try {
      await api.post(`/api/events/${eventId}/runbook`, { title, priority, dueAt: dueAt || undefined });
      setTitle('');
      setPriority('medium');
      setDueAt('');
      await load();
    } catch (e: any) {
      setError(e?.error || 'Failed to add task');
    }
  };

  const toggleItem = async (itemId: string) => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/runbook/${itemId}/toggle`);
    await load();
  };

  const deleteItem = async (itemId: string) => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/runbook/${itemId}/delete`);
    await load();
  };

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((x) => x.status === 'done').length;
    const overdue = items.filter((x) => x.status === 'open' && x.dueAt && new Date(x.dueAt).getTime() < Date.now()).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, overdue, progress };
  }, [items]);

  return (
    <OrganizerFlowShell title="Event Runbook" subtitle="Private organizer checklist for event-day operations." navLinks={navLinks} maxWidth="wide">
      <FlowPage className="max-w-6xl">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FlowStatCard label="Tasks" value={stats.total} />
        <FlowStatCard label="Done" value={stats.done} accent={ui.accent} />
        <FlowStatCard label="Overdue" value={stats.overdue} />
        <FlowStatCard label="Progress" value={`${stats.progress}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <FlowCard>
          <h2 className="text-lg font-semibold" style={{ color: ui.text }}>Add runbook task</h2>
          <div className="mt-4 grid gap-3">
            <FlowInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Test entry gate scanners" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="rounded-xl border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <FlowInput type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <FlowButton type="button" onClick={addItem} disabled={!title.trim()} className="w-full">
              Add task
            </FlowButton>
            {error && <FlowAlert variant="error">{error}</FlowAlert>}
          </div>
        </FlowCard>

        <FlowCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Runbook items</h2>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-sm text-neutral-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">No tasks yet.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-sm font-extrabold ${item.status === 'done' ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{item.title}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Priority: <span className="font-semibold">{item.priority}</span>
                        {item.dueAt ? ` • Due: ${new Date(item.dueAt).toLocaleString()}` : ' • No due date'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold hover:bg-neutral-50"
                      >
                        {item.status === 'done' ? 'Re-open' : 'Mark done'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FlowCard>
      </div>
      </FlowPage>
    </OrganizerFlowShell>
  );
};
