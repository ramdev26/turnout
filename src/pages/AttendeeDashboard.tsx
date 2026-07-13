import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Order } from '../types';
import { EmptyState } from '../components/ui/Feedback';
import { AttendeeShell } from '../components/attendee/AttendeeShell';
import { FlowStatCard, FlowCard, FlowAlert, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { accentButtonStyleFor, accentSegmentStyleFor, cardStyleFor } from '../themes/flowUi';
import { cn } from '../utils/cn';

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildIcs(order: Order): string | null {
  if (!order.event) return null;
  const start = new Date(order.event.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const toUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Turnout//Attendee Calendar//EN',
    'BEGIN:VEVENT',
    `UID:turnout-order-${order.id}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtc(start)}`,
    `DTEND:${toUtc(end)}`,
    `SUMMARY:${(order.event.title || 'Event').replace(/\n/g, ' ')}`,
    `LOCATION:${(order.event.location || '').replace(/\n/g, ' ')}`,
    `DESCRIPTION:Order #${order.id} - Tickets from Turnout`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export const AttendeeDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusPass, setFocusPass] = useState<{ eventTitle: string; holder: string; token: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [notesByOrder, setNotesByOrder] = useState<Record<string, string>>(() => {
    try {
      const raw =
        localStorage.getItem('turnout_attendee_notes_v1') ||
        localStorage.getItem('eventtick_attendee_notes_v1');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [remindersByOrder, setRemindersByOrder] = useState<Record<string, { dayBefore: boolean; twoHoursBefore: boolean }>>(() => {
    try {
      const raw =
        localStorage.getItem('turnout_attendee_reminders_v1') ||
        localStorage.getItem('eventtick_attendee_reminders_v1');
      return raw ? (JSON.parse(raw) as Record<string, { dayBefore: boolean; twoHoursBefore: boolean }>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ orders: Order[] }>('/api/me/orders');
        setOrders(res.orders);
      } catch (e: any) {
        setError(e?.error || 'Failed to load attendee dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveNotes = (next: Record<string, string>) => {
    setNotesByOrder(next);
    localStorage.setItem('turnout_attendee_notes_v1', JSON.stringify(next));
  };

  const saveReminders = (next: Record<string, { dayBefore: boolean; twoHoursBefore: boolean }>) => {
    setRemindersByOrder(next);
    localStorage.setItem('turnout_attendee_reminders_v1', JSON.stringify(next));
  };

  const stats = useMemo(() => {
    const tickets = orders.reduce((sum, o) => sum + (o.attendees?.length || 0), 0);
    const upcoming = orders.filter((o) => o.event && new Date(o.event.date).getTime() > Date.now()).length;
    const checkedIn = orders.reduce((sum, o) => sum + (o.attendees?.filter((a) => !!a.checkedInAt).length || 0), 0);
    return { tickets, upcoming, checkedIn };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    const now = Date.now();
    return orders.filter((o) => {
      if (!o.event) return activeFilter === 'past';
      const t = new Date(o.event.date).getTime();
      return activeFilter === 'upcoming' ? t > now : t <= now;
    });
  }, [activeFilter, orders]);

  const ui = APP_FLOW_UI;

  if (loading) {
    return (
      <AttendeeShell title="Attendee Portal" subtitle="Loading your tickets…">
        <div className="flex h-64 items-center justify-center text-sm" style={{ color: ui.textMuted }}>
          Loading attendee dashboard...
        </div>
      </AttendeeShell>
    );
  }

  return (
    <AttendeeShell title="Attendee Portal" subtitle="Your personal event hub: tickets, reminders, notes, and check-in status.">
      <div className="flex flex-col gap-8">

      <div className="grid gap-4 sm:grid-cols-3">
        <FlowStatCard label="Tickets" value={stats.tickets} />
        <FlowStatCard label="Upcoming events" value={stats.upcoming} />
        <FlowStatCard label="Checked in" value={stats.checkedIn} accent={ui.accent} />
      </div>

      {error && <FlowAlert variant="error">{error}</FlowAlert>}

      <FlowCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold" style={{ color: ui.text }}>My ticket wallet</h2>
          <div className="flex flex-wrap gap-2">
            {(['all', 'upcoming', 'past'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={cn('rounded-lg px-3 py-2 text-xs font-bold capitalize')}
                style={
                  activeFilter === f
                    ? accentSegmentStyleFor(ui, true)
                    : { ...cardStyleFor(ui), color: ui.textMuted }
                }
              >
                {f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
        </div>
        {visibleOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No orders yet" description="Your purchases will appear here once you register for an event." />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border p-4 shadow-sm" style={cardStyleFor(ui)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-extrabold text-neutral-900">{order.event?.title || `Event #${order.eventId}`}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {order.event ? `${new Date(order.event.date).toLocaleString()} • ${order.event.location}` : 'Event details unavailable'}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">Order #{order.id} • {order.attendees?.length || 0} tickets</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {order.event?.slug && (
                      <Link to={`/e/${order.event.slug}`} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                        Open event page
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const ics = buildIcs(order);
                        if (!ics) return;
                        downloadTextFile(`event-${order.id}.ics`, ics);
                      }}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Add to calendar
                    </button>
                    {order.event?.location && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.event.location)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Get directions
                      </a>
                    )}
                    {order.event?.organizerEmail && (
                      <a
                        href={`mailto:${encodeURIComponent(order.event.organizerEmail)}?subject=${encodeURIComponent(
                          `Question about ${order.event.title}`
                        )}`}
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Contact organizer
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const first = order.attendees?.[0]?.qrToken || '';
                        if (!first) return;
                        navigator.clipboard.writeText(first);
                      }}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Copy pass token
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(order.attendees || []).map((a) => (
                    <div key={a.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="text-xs font-bold text-neutral-800">{a.fullName}</div>
                      <div className="mt-1 break-all rounded bg-neutral-900 p-2 font-mono text-[11px] text-neutral-100">{a.qrToken}</div>
                      <div className="mt-1 text-[11px] text-neutral-500">{a.checkedInAt ? 'Checked in' : 'Not checked in yet'}</div>
                      <button
                        type="button"
                        onClick={() =>
                          setFocusPass({
                            eventTitle: order.event?.title || `Event #${order.eventId}`,
                            holder: a.fullName,
                            token: a.qrToken,
                          })
                        }
                        className="mt-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        Open gate pass mode
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-500">My event notes</div>
                    <textarea
                      value={notesByOrder[order.id] || ''}
                      onChange={(e) => saveNotes({ ...notesByOrder, [order.id]: e.target.value })}
                      placeholder="Transport plan, meetup point, what to bring..."
                      rows={3}
                      className="mt-2 w-full rounded border border-neutral-200 px-2 py-2 text-xs"
                    />
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-500">Reminder preferences</div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={!!remindersByOrder[order.id]?.dayBefore}
                        onChange={(e) =>
                          saveReminders({
                            ...remindersByOrder,
                            [order.id]: {
                              dayBefore: e.target.checked,
                              twoHoursBefore: remindersByOrder[order.id]?.twoHoursBefore || false,
                            },
                          })
                        }
                      />
                      Remind me 1 day before
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={!!remindersByOrder[order.id]?.twoHoursBefore}
                        onChange={(e) =>
                          saveReminders({
                            ...remindersByOrder,
                            [order.id]: {
                              dayBefore: remindersByOrder[order.id]?.dayBefore || false,
                              twoHoursBefore: e.target.checked,
                            },
                          })
                        }
                      />
                      Remind me 2 hours before
                    </label>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </FlowCard>

      {focusPass && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-black/70 p-6 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-black">{focusPass.eventTitle}</div>
                <div className="mt-1 text-sm text-white/70">{focusPass.holder}</div>
              </div>
              <button
                type="button"
                onClick={() => setFocusPass(null)}
                className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-5 rounded-xl bg-white p-4 text-black">
              <div className="text-center text-xs font-bold uppercase tracking-wider text-neutral-500">Gate pass token</div>
              <div className="mt-3 break-all rounded-lg bg-neutral-900 p-4 text-center font-mono text-sm font-bold text-white">{focusPass.token}</div>
            </div>
            <div className="mt-3 text-center text-xs text-white/70">Show this screen directly at entry for faster check-in.</div>
          </div>
        </div>
      )}
      </div>
    </AttendeeShell>
  );
};
