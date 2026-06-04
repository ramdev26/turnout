import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
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
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowStatCard, FlowAlert, FlowInput, FlowButton, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { cn } from '../utils/cn';
import { cardStyleFor, fieldClassFor, fieldStyleFor, insetCardStyleFor } from '../themes/flowUi';
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

  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);
  const ui = APP_FLOW_UI;

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
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: ui.accent, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <OrganizerFlowShell
      title="Attendees & Check-in"
      subtitle={stats.total > 0 ? `${stats.checkedIn} of ${stats.total} checked in (${pct}%)` : 'Manage arrivals and door access'}
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage className="max-w-6xl">
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/staff/checkin/${eventId}`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: ui.accent }}
          >
            <ScanLine className="h-4 w-4" />
            Open scanner
          </Link>
          <FlowButton variant="secondary" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            Export CSV
          </FlowButton>
          <FlowButton variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </FlowButton>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FlowStatCard label="Registered" value={stats.total} icon={<Users className="h-5 w-5" />} />
          <FlowStatCard label="Checked in" value={stats.checkedIn} icon={<UserCheck className="h-5 w-5" />} accent={ui.accent} />
          <FlowStatCard label="Waiting" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        </div>

        <div className="rounded-2xl border p-5 shadow-sm" style={cardStyleFor(ui)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                <Shield className="h-4 w-4" style={{ color: ui.accent }} />
                Staff door access
              </div>
              <p className="mt-1 max-w-xl text-sm" style={{ color: ui.textMuted }}>
                Share the staff link and PIN with volunteers. They can scan tickets without your organizer login.
              </p>
            </div>
            <FlowButton variant="secondary" disabled={configLoading} onClick={() => void regeneratePin()} className="!px-3 !py-2 text-xs">
              {configLoading ? 'Updating…' : 'Regenerate PIN'}
            </FlowButton>
          </div>
          {config && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4" style={insetCardStyleFor(ui)}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Staff PIN
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-2xl font-bold tracking-[0.2em]" style={{ color: ui.text }}>
                    {config.staffPin}
                  </span>
                  <FlowButton variant="secondary" type="button" onClick={() => void copyText(config.staffPin, 'PIN')} className="!px-2 !py-1">
                    <Copy className="h-3.5 w-3.5" />
                  </FlowButton>
                </div>
              </div>
              <div className="rounded-xl border p-4" style={insetCardStyleFor(ui)}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Staff scanner URL
                </p>
                <p className="mt-2 truncate text-sm font-medium" style={{ color: ui.accent }}>
                  {config.staffUrl}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(config.staffUrl, 'Staff link')}
                  className="mt-2 text-xs font-bold hover:opacity-90"
                  style={{ color: ui.textMuted }}
                >
                  Copy link
                </button>
              </div>
            </div>
          )}
          {copyHint && (
            <p className="mt-2 text-xs font-medium" style={{ color: ui.accent }}>
              {copyHint}
            </p>
          )}
        </div>

        {err && <FlowAlert variant="error">{err}</FlowAlert>}
        {msg && !err && <FlowAlert variant="success">{msg}</FlowAlert>}

        {lastCheckIn && (
          <div className="rounded-2xl border p-4" style={{ borderColor: ui.accent, background: ui.accentSoft }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.accent }}>
              Last scan
            </p>
            <p className="mt-1 text-lg font-semibold" style={{ color: ui.text }}>
              {lastCheckIn.fullName}
            </p>
            <p className="text-sm" style={{ color: ui.textMuted }}>
              {lastCheckIn.ticketName} · {lastCheckIn.email}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border p-6 shadow-sm" style={cardStyleFor(ui)}>
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: ui.text }}>
              <QrCode className="h-5 w-5" style={{ color: ui.accent }} />
              Manual check-in
            </h2>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Paste a token from a ticket QR or search the list below.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <FlowInput
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void checkIn()}
                placeholder="QR token"
                className="flex-1"
              />
              <FlowButton onClick={() => void checkIn()} disabled={checkingIn || !qrToken.trim()} className="shrink-0">
                {checkingIn ? 'Checking…' : 'Check in'}
              </FlowButton>
            </div>
          </div>

          <div className="rounded-2xl border p-6 shadow-sm" style={cardStyleFor(ui)}>
            <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
              Quick tips
            </h2>
            <ul className="mt-3 space-y-2 text-sm" style={{ color: ui.textMuted }}>
              <li>· Use the scanner on a phone at the entrance for fastest flow.</li>
              <li>· Each ticket has its own QR — one check-in per attendee row.</li>
              <li>· Undo is available if someone was checked in by mistake.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border shadow-sm" style={cardStyleFor(ui)}>
          <div
            className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: ui.borderColor }}
          >
            <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
              Attendee list
            </h2>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'checked_in'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-bold capitalize',
                    statusFilter === f ? 'text-white' : ''
                  )}
                  style={
                    statusFilter === f
                      ? { backgroundColor: ui.accent }
                      : { background: ui.fieldBg, color: ui.textMuted }
                  }
                >
                  {f === 'checked_in' ? 'Checked in' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-b p-4" style={{ borderColor: ui.borderColor }}>
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: ui.textSubtle }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, ticket…"
                className={cn(fieldClassFor(ui), 'w-full py-2.5 pl-10 pr-4')}
                style={fieldStyleFor(ui)}
              />
            </div>
            <FlowButton variant="secondary" type="button" onClick={() => setShowTokens((v) => !v)} className="shrink-0 !px-3 !py-2 text-xs">
              {showTokens ? 'Hide tokens' : 'Show tokens'}
            </FlowButton>
          </div>

          <div className="max-h-[560px] overflow-auto">
            {attendees.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: ui.textMuted }}>
                No attendees match your filters. Tickets appear here after orders are completed.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: ui.borderColor }}>
                {attendees.map((a) => (
                  <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: ui.text }}>
                          {a.fullName}
                        </span>
                        {a.checkedInAt ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: ui.accentSoft, color: ui.accent }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            In
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fcd34d' }}
                          >
                            Waiting
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                        {a.ticketName} · {a.email}
                        {a.phone ? ` · ${a.phone}` : ''}
                      </p>
                      {showTokens && (
                        <p className="mt-2 font-mono text-[11px]" style={{ color: ui.textSubtle }}>
                          …{a.qrToken.slice(-8)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {!a.checkedInAt && (
                        <FlowButton type="button" onClick={() => void checkIn(a.qrToken)} className="!px-3 !py-1.5 text-xs">
                          Check in
                        </FlowButton>
                      )}
                      {a.checkedInAt && (
                        <FlowButton
                          variant="secondary"
                          type="button"
                          onClick={() => void undoCheckIn(a)}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Undo
                        </FlowButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FlowPage>
    </OrganizerFlowShell>
  );
};
