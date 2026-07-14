import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Ticket,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { AdminSearchBar } from '../components/admin/AdminSearchBar';
import { AdminShell } from '../components/admin/AdminShell';
import {
  FlowAlert,
  FlowButton,
  FlowCard,
  FlowStatCard,
  APP_FLOW_UI,
} from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { formatLKR } from '../utils/money';
import { cn } from '../utils/cn';
import type { Attendee } from '../types';

type AttendeeStats = { total: number; checkedIn: number; pending: number };

type AdminEventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  eventStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  isFeatured: boolean;
  organizerName: string;
  createdAt: string;
  attendeeStats: AttendeeStats;
};

type AdminEventDetail = {
  event: {
    id: string;
    slug: string;
    title: string;
    status: string;
    eventStatus: AdminEventRow['eventStatus'];
    isFeatured: boolean;
    date: string | null;
    location: string | null;
    createdAt: string;
    organizerName: string;
    organizerEmail: string;
  };
  attendeeStats: AttendeeStats;
  orders: { paidCount: number; revenue: number };
  tickets: Array<{ id: string; name: string; price: number; quantity: number | null; sold: number }>;
};

function checkInRate(stats: AttendeeStats): string {
  if (stats.total === 0) return '0%';
  return `${Math.round((stats.checkedIn / stats.total) * 100)}%`;
}

function formatEventDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ui = APP_FLOW_UI;
  return (
    <section className="rounded-xl border p-4" style={cardMutedStyleFor(ui)}>
      <div className="mb-3 flex items-center gap-2">
        {icon ? <span style={{ color: ui.textMuted }}>{icon}</span> : null}
        <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export const AdminEvents: React.FC = () => {
  const ui = APP_FLOW_UI;
  const fieldStyle = fieldStyleFor(ui);
  const [rows, setRows] = useState<AdminEventRow[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<'all' | AdminEventRow['eventStatus']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminEventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeStats, setAttendeeStats] = useState<AttendeeStats>({ total: 0, checkedIn: 0, pending: 0 });
  const [attendeeQ, setAttendeeQ] = useState('');
  const [debouncedAttendeeQ, setDebouncedAttendeeQ] = useState('');
  const [attendeeStatus, setAttendeeStatus] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = opts?.background ?? false;
      if (background) setRefreshing(true);
      else if (!hasLoadedOnceRef.current) setInitialLoading(true);
      if (!background) setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
        if (status !== 'all') params.set('status', status);
        const res = await api.get<{ events: AdminEventRow[] }>(`/api/admin/events?${params.toString()}`);
        setRows(res.events);
        hasLoadedOnceRef.current = true;
      } catch (e: unknown) {
        const err = e as { error?: string };
        setError(err?.error || 'Failed to load events');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQ, status],
  );

  const loadDetail = async (eventId: string) => {
    setDetailLoading(true);
    setError(null);
    setAttendeeQ('');
    setDebouncedAttendeeQ('');
    setAttendeeStatus('all');
    try {
      const res = await api.get<AdminEventDetail>(`/api/admin/events/${eventId}`);
      setDetail(res);
      setSelectedId(eventId);
      setAttendeeStats(res.attendeeStats);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load event details');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAttendees = useCallback(
    async (eventId: string) => {
      setAttendeesLoading(true);
      try {
        const params = new URLSearchParams({ limit: '500' });
        if (debouncedAttendeeQ.trim()) params.set('q', debouncedAttendeeQ.trim());
        if (attendeeStatus !== 'all') params.set('status', attendeeStatus);
        const res = await api.get<{ attendees: Attendee[]; stats: AttendeeStats }>(
          `/api/admin/events/${eventId}/attendees?${params.toString()}`,
        );
        setAttendees(res.attendees);
        setAttendeeStats(res.stats);
      } catch (e: unknown) {
        const err = e as { error?: string };
        setError(err?.error || 'Failed to load attendees');
      } finally {
        setAttendeesLoading(false);
      }
    },
    [debouncedAttendeeQ, attendeeStatus],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedAttendeeQ(attendeeQ), 300);
    return () => window.clearTimeout(timer);
  }, [attendeeQ]);

  useEffect(() => {
    void load({ background: hasLoadedOnceRef.current });
  }, [load]);

  useEffect(() => {
    if (!selectedId || !detail) return;
    void loadAttendees(selectedId);
  }, [selectedId, detail, loadAttendees]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const moderate = async (eventId: string, body: Record<string, unknown>) => {
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/events/${eventId}/moderate`, body);
      setMessage('Event updated.');
      await load({ background: true });
      if (selectedId === eventId) await loadDetail(eventId);
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string };
      setError(err?.message || err?.error || 'Could not update event');
    }
  };

  const setPublishStatus = async (eventId: string, next: string) => {
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/admin/events/${eventId}/status`, { status: next });
      setMessage('Publish status updated.');
      await load({ background: true });
      if (selectedId === eventId) await loadDetail(eventId);
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string };
      setError(err?.message || err?.error || 'Could not update status');
    }
  };

  const selectStyle = { ...fieldStyle, color: ui.text };

  return (
    <AdminShell
      title="Event Control"
      subtitle="Moderate events, review ticket sales, and monitor attendee check-ins."
    >
      {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
      {message ? <FlowAlert variant="success">{message}</FlowAlert> : null}

      {initialLoading ? (
        <FlowCard>
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Loading events…
          </p>
        </FlowCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,520px)]">
          <FlowCard className="overflow-hidden p-0">
            <div className="border-b p-4 sm:p-5" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <AdminSearchBar
                  value={q}
                  onChange={setQ}
                  placeholder="Search title or slug…"
                  refreshing={refreshing}
                  aria-label="Search events"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className={fieldClassFor(ui)}
                  style={selectStyle}
                >
                  <option value="all">All moderation statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="border-b px-5 py-4" style={{ borderColor: ui.borderColor }}>
              <p className="text-sm font-semibold" style={{ color: ui.text }}>
                {rows.length} event{rows.length === 1 ? '' : 's'}
                {debouncedQ.trim() ? (
                  <span className="font-normal" style={{ color: ui.textMuted }}>
                    {' '}
                    matching &ldquo;{debouncedQ.trim()}&rdquo;
                  </span>
                ) : null}
              </p>
              <p className="flex items-center gap-2 text-xs" style={{ color: ui.textMuted }}>
                {refreshing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating results…
                  </>
                ) : (
                  'Select an event to view attendees and check-in stats'
                )}
              </p>
            </div>

            <div className="max-h-[calc(100vh-16rem)] divide-y overflow-y-auto" style={{ borderColor: ui.borderColor }}>
              {rows.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: ui.textMuted }}>
                  No events match your filters.
                </p>
              ) : (
                rows.map((e) => {
                  const selected = selectedId === e.id;
                  const stats = e.attendeeStats;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => void loadDetail(e.id)}
                      className={cn(
                        'w-full px-5 py-4 text-left transition hover:bg-white/[0.03]',
                        selected && 'bg-white/[0.05]',
                      )}
                      style={selected ? { boxShadow: `inset 3px 0 0 ${ui.accent}` } : undefined}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold" style={{ color: ui.text }}>
                            {e.title}
                          </p>
                          <p className="mt-0.5 truncate text-sm" style={{ color: ui.textMuted }}>
                            {e.organizerName} · {e.eventStatus} · {e.status}
                          </p>
                          <p className="mt-2 text-xs" style={{ color: ui.textSubtle }}>
                            {stats.total} attendee{stats.total === 1 ? '' : 's'} · {stats.checkedIn} checked in
                            {stats.total > 0 ? ` (${checkInRate(stats)})` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums" style={{ color: ui.text }}>
                            {stats.checkedIn}/{stats.total}
                          </p>
                          <p className="text-[11px] uppercase tracking-wide" style={{ color: ui.textMuted }}>
                            check-ins
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </FlowCard>

          <div className="xl:sticky xl:top-6 xl:self-start">
            {detailLoading ? (
              <FlowCard>
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Loading event…
                </p>
              </FlowCard>
            ) : !detail || !selectedRow ? (
              <FlowCard className="text-center">
                <Calendar className="mx-auto h-10 w-10" style={{ color: ui.textSubtle }} />
                <p className="mt-3 text-sm font-medium" style={{ color: ui.text }}>
                  Select an event
                </p>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Attendee counts, check-ins, tickets, and moderation controls appear here.
                </p>
              </FlowCard>
            ) : (
              <div className="space-y-4">
                <FlowCard>
                  <p className="text-lg font-semibold" style={{ color: ui.text }}>
                    {detail.event.title}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    {detail.event.organizerName} · {detail.event.organizerEmail}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border px-2.5 py-1 capitalize" style={cardMutedStyleFor(ui)}>
                      {detail.event.eventStatus}
                    </span>
                    <span className="rounded-full border px-2.5 py-1 capitalize" style={cardMutedStyleFor(ui)}>
                      {detail.event.status}
                    </span>
                    {detail.event.isFeatured ? (
                      <span className="rounded-full border px-2.5 py-1" style={cardMutedStyleFor(ui)}>
                        Featured
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2" style={{ color: ui.textMuted }}>
                      <Calendar className="h-4 w-4 shrink-0" />
                      {formatEventDate(detail.event.date)}
                    </div>
                    {detail.event.location ? (
                      <div className="flex items-center gap-2" style={{ color: ui.textMuted }}>
                        <MapPin className="h-4 w-4 shrink-0" />
                        {detail.event.location}
                      </div>
                    ) : null}
                  </div>

                  <a
                    href={`/e/${detail.event.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                    style={{ color: ui.accent }}
                  >
                    View public page
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </FlowCard>

                <div className="grid grid-cols-2 gap-3">
                  <FlowStatCard
                    label="Attendees"
                    value={attendeeStats.total}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <FlowStatCard
                    label="Checked in"
                    value={attendeeStats.checkedIn}
                    icon={<UserCheck className="h-4 w-4" />}
                    accent="#34d399"
                  />
                  <FlowStatCard
                    label="Pending"
                    value={attendeeStats.pending}
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <FlowStatCard
                    label="Check-in rate"
                    value={checkInRate(attendeeStats)}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    accent={ui.accent}
                  />
                </div>

                <DetailSection title="Sales overview" icon={<Ticket className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border px-3 py-2.5" style={cardStyleFor(ui)}>
                      <p className="text-xs" style={{ color: ui.textMuted }}>
                        Paid orders
                      </p>
                      <p className="mt-1 font-bold tabular-nums" style={{ color: ui.text }}>
                        {detail.orders.paidCount}
                      </p>
                    </div>
                    <div className="rounded-lg border px-3 py-2.5" style={cardStyleFor(ui)}>
                      <p className="text-xs" style={{ color: ui.textMuted }}>
                        Revenue
                      </p>
                      <p className="mt-1 font-bold tabular-nums" style={{ color: ui.text }}>
                        {formatLKR(detail.orders.revenue)}
                      </p>
                    </div>
                  </div>
                  {detail.tickets.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {detail.tickets.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                          style={cardMutedStyleFor(ui)}
                        >
                          <span className="min-w-0 truncate font-medium" style={{ color: ui.text }}>
                            {t.name}
                          </span>
                          <span className="shrink-0 tabular-nums" style={{ color: ui.textMuted }}>
                            {t.sold}
                            {t.quantity != null ? ` / ${t.quantity}` : ''} sold · {formatLKR(t.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                      No ticket types configured.
                    </p>
                  )}
                </DetailSection>

                <DetailSection title={`Attendees (${attendeeStats.total})`} icon={<Users className="h-4 w-4" />}>
                  <div className="mb-3 space-y-3">
                    <AdminSearchBar
                      value={attendeeQ}
                      onChange={setAttendeeQ}
                      placeholder="Search name, email, ticket…"
                      refreshing={attendeesLoading}
                      aria-label="Search attendees"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'pending', 'checked_in'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAttendeeStatus(f)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition',
                            attendeeStatus === f ? '' : 'border',
                          )}
                          style={
                            attendeeStatus === f
                              ? { background: ui.accent, color: ui.accentOn }
                              : { ...cardMutedStyleFor(ui), color: ui.textMuted }
                          }
                        >
                          {f === 'checked_in' ? 'Checked in' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {attendees.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm" style={{ ...cardMutedStyleFor(ui), color: ui.textMuted }}>
                      {attendeesLoading ? 'Loading attendees…' : 'No attendees match your filters.'}
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {attendees.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-lg border px-3 py-2.5"
                          style={cardStyleFor(ui)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold" style={{ color: ui.text }}>
                                {a.fullName}
                              </p>
                              <p className="truncate text-xs" style={{ color: ui.textMuted }}>
                                {a.ticketName} · {a.email}
                              </p>
                            </div>
                            {a.checkedInAt ? (
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                In
                              </span>
                            ) : (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
                              >
                                Pending
                              </span>
                            )}
                          </div>
                          {a.checkedInAt ? (
                            <p className="mt-1.5 text-[11px]" style={{ color: ui.textSubtle }}>
                              Checked in {formatEventDate(a.checkedInAt)}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailSection>

                <DetailSection title="Moderation" icon={<CheckCircle2 className="h-4 w-4" />}>
                  <div className="flex flex-wrap gap-2">
                    <FlowButton variant="secondary" onClick={() => void moderate(detail.event.id, { eventStatus: 'approved' })}>
                      Approve
                    </FlowButton>
                    <FlowButton variant="secondary" onClick={() => void moderate(detail.event.id, { eventStatus: 'rejected' })}>
                      Reject
                    </FlowButton>
                    <FlowButton variant="secondary" onClick={() => void setPublishStatus(detail.event.id, 'blocked')}>
                      Unpublish
                    </FlowButton>
                    <FlowButton
                      onClick={() =>
                        void moderate(detail.event.id, { isFeatured: !detail.event.isFeatured })
                      }
                    >
                      {detail.event.isFeatured ? 'Unfeature' : 'Feature'}
                    </FlowButton>
                  </div>
                </DetailSection>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
};
