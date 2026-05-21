import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Shield,
  Undo2,
  Users,
  UserCheck,
  Clock,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { Attendee } from '../types';
import { OrganizerShell } from '../components/organizer/OrganizerShell';
import { cn } from '../utils/cn';
import { parseQrCheckInPayload } from '../utils/qrCheckIn';

type AttendeeStats = { total: number; checkedIn: number; pending: number };
type CheckinConfig = { staffPin: string; staffUrl: string };
type CheckinResult = {
  ok: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  attendee?: Attendee;
};

export const CheckInManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [stats, setStats] = useState<AttendeeStats>({ total: 0, checkedIn: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [qrToken, setQrToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [config, setConfig] = useState<CheckinConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<Attendee | null>(null);
  const [showTokens, setShowTokens] = useState(false);

  const eventLinks = useMemo(
    () => [
      { to: '/dashboard', label: 'Dashboard', exact: true },
      { to: `/dashboard/events/${eventId}/settings`, label: 'Settings', exact: true },
      { to: `/dashboard/events/${eventId}/agenda`, label: 'Agenda' },
      { to: `/dashboard/events/${eventId}/checkin`, label: 'Check-in' },
      { to: `/dashboard/events/${eventId}/runbook`, label: 'Runbook' },
    ],
    [eventId]
  );

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ limit: '2000' });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get<{ attendees: Attendee[]; stats: AttendeeStats }>(
        `/api/events/${eventId}/attendees?${params.toString()}`
      );
      setAttendees(res.attendees);
      setStats(res.stats);
    } catch (e: unknown) {
      const error = e as { error?: string; message?: string };
      setErr(error?.message || error?.error || 'Failed to load attendees');
    } finally {
      setLoading(false);
    }
  }, [eventId, debouncedQ, statusFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadConfig = useCallback(async () => {
    if (!eventId) return;
    setConfigLoading(true);
    try {
      const res = await api.get<CheckinConfig>(`/api/events/${eventId}/checkin-config`);
      setConfig(res);
    } catch {
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} copied`);
      window.setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Copy failed');
    }
  };

  const regeneratePin = async () => {
    if (!eventId) return;
    setConfigLoading(true);
    try {
      const res = await api.post<CheckinConfig>(`/api/events/${eventId}/checkin-config`, { regenerate: true });
      setConfig(res);
      setMsg('Staff PIN regenerated. Share the new PIN with your door team.');
    } catch (e: unknown) {
      const error = e as { message?: string; error?: string };
      setErr(error?.message || error?.error || 'Could not update PIN');
    } finally {
      setConfigLoading(false);
    }
  };

  const checkIn = async (token?: string) => {
    if (!eventId) return;
    const raw = (token ?? qrToken).trim();
    if (!raw) return;
    const parsed = parseQrCheckInPayload(raw, eventId);
    if (!parsed.qrToken) {
      setErr(parsed.error === 'wrong_event' ? 'This ticket is for a different event.' : 'Invalid QR token.');
      return;
    }
    setCheckingIn(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.post<CheckinResult>(`/api/events/${eventId}/checkin`, { qrToken: parsed.qrToken });
      setLastCheckIn(res.attendee || null);
      setMsg(res.message || (res.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully'));
      setQrToken('');
      await load();
    } catch (e: unknown) {
      const error = e as { message?: string; error?: string };
      setErr(error?.message || error?.error || 'Check-in failed');
      setLastCheckIn(null);
    } finally {
      setCheckingIn(false);
    }
  };

  const undoCheckIn = async (attendee: Attendee) => {
    if (!eventId || !attendee.checkedInAt) return;
    if (!window.confirm(`Undo check-in for ${attendee.fullName}?`)) return;
    setErr(null);
    try {
      await api.post(`/api/events/${eventId}/checkin/undo`, { qrToken: attendee.qrToken });
      setMsg(`Check-in undone for ${attendee.fullName}`);
      await load();
    } catch (e: unknown) {
      const error = e as { message?: string; error?: string };
      setErr(error?.message || error?.error || 'Undo failed');
    }
  };

  const exportCsv = async () => {
    if (!eventId) return;
    try {
      const res = await fetch(toApiUrl(`/api/events/${eventId}/attendees.csv`), { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-event-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr('Could not download CSV. Make sure you are signed in.');
    }
  };

  const pct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  if (loading && attendees.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <OrganizerShell
      title="Attendees & Check-in"
      subtitle={stats.total > 0 ? `${stats.checkedIn} of ${stats.total} checked in (${pct}%)` : 'Manage arrivals and door access'}
      links={eventLinks}
    >
      <div className="mx-auto max-w-6xl space-y-6 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/dashboard/events/${eventId}/settings`}
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Event settings
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/staff/checkin/${eventId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <ScanLine className="h-4 w-4" />
              Open scanner
            </Link>
            <button
              type="button"
              onClick={() => void exportCsv()}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Users className="h-5 w-5" />} label="Registered" value={stats.total} />
          <StatCard icon={<UserCheck className="h-5 w-5 text-emerald-600" />} label="Checked in" value={stats.checkedIn} accent="emerald" />
          <StatCard icon={<Clock className="h-5 w-5 text-amber-600" />} label="Waiting" value={stats.pending} accent="amber" />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Shield className="h-4 w-4 text-teal-600" />
                Staff door access
              </div>
              <p className="mt-1 max-w-xl text-sm text-neutral-500">
                Share the staff link and PIN with volunteers. They can scan tickets without your organizer login.
              </p>
            </div>
            <button
              type="button"
              disabled={configLoading}
              onClick={() => void regeneratePin()}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {configLoading ? 'Updating…' : 'Regenerate PIN'}
            </button>
          </div>
          {config && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Staff PIN</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-2xl font-bold tracking-[0.2em] text-neutral-900">{config.staffPin}</span>
                  <button type="button" onClick={() => void copyText(config.staffPin, 'PIN')} className="rounded-lg border px-2 py-1 text-xs font-bold">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Staff scanner URL</p>
                <p className="mt-2 truncate text-sm font-medium text-teal-700">{config.staffUrl}</p>
                <button
                  type="button"
                  onClick={() => void copyText(config.staffUrl, 'Staff link')}
                  className="mt-2 text-xs font-bold text-neutral-600 hover:text-neutral-900"
                >
                  Copy link
                </button>
              </div>
            </div>
          )}
          {copyHint && <p className="mt-2 text-xs font-medium text-emerald-700">{copyHint}</p>}
        </div>

        {(msg || err) && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm font-medium',
              err ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            )}
          >
            {err || msg}
          </div>
        )}

        {lastCheckIn && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Last scan</p>
            <p className="mt-1 text-lg font-semibold text-emerald-950">{lastCheckIn.fullName}</p>
            <p className="text-sm text-emerald-800">
              {lastCheckIn.ticketName} · {lastCheckIn.email}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <QrCode className="h-5 w-5 text-teal-600" />
              Manual check-in
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Paste a token from a ticket QR or search the list below.</p>
            <div className="mt-4 flex gap-2">
              <input
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void checkIn()}
                placeholder="QR token"
                className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="button"
                onClick={() => void checkIn()}
                disabled={checkingIn || !qrToken.trim()}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {checkingIn ? 'Checking…' : 'Check in'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Quick tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>· Use the scanner on a phone at the entrance for fastest flow.</li>
              <li>· Each ticket has its own QR — one check-in per attendee row.</li>
              <li>· Undo is available if someone was checked in by mistake.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Attendee list</h2>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'checked_in'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-bold capitalize',
                    statusFilter === f ? 'bg-teal-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  )}
                >
                  {f === 'checked_in' ? 'Checked in' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-b border-neutral-100 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, ticket…"
                className="w-full rounded-xl border border-neutral-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowTokens((v) => !v)}
              className="shrink-0 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600"
            >
              {showTokens ? 'Hide tokens' : 'Show tokens'}
            </button>
          </div>

          <div className="max-h-[560px] overflow-auto">
            {attendees.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                No attendees match your filters. Tickets appear here after orders are completed.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {attendees.map((a) => (
                  <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-neutral-900">{a.fullName}</span>
                        {a.checkedInAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            In
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                            Waiting
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-neutral-500">
                        {a.ticketName} · {a.email}
                        {a.phone ? ` · ${a.phone}` : ''}
                      </p>
                      {showTokens && (
                        <p className="mt-2 font-mono text-[11px] text-neutral-400">
                          …{a.qrToken.slice(-8)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {!a.checkedInAt && (
                        <button
                          type="button"
                          onClick={() => void checkIn(a.qrToken)}
                          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                        >
                          Check in
                        </button>
                      )}
                      {a.checkedInAt && (
                        <button
                          type="button"
                          onClick={() => void undoCheckIn(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </OrganizerShell>
  );
};

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: 'emerald' | 'amber';
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-500">{icon}</div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-3xl font-bold tabular-nums',
          accent === 'emerald' && 'text-emerald-700',
          accent === 'amber' && 'text-amber-700',
          !accent && 'text-neutral-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}
