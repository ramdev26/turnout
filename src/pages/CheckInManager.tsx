import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Download,
  Landmark,
  List,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Shield,
  Undo2,
  UserPlus,
  Users,
  UserCheck,
  Clock,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { Attendee, CheckoutFieldDefinition, Event, Order } from '../types';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { CheckInScannerPanel } from '../components/organizer/CheckInScannerPanel';
import { BankTransferOrdersPanel } from '../components/organizer/BankTransferOrdersPanel';
import { AttendeeDetailDrawer } from '../components/organizer/AttendeeDetailDrawer';
import { ManualAddAttendeeModal } from '../components/organizer/ManualAddAttendeeModal';
import { FlowPage, FlowStatCard, FlowAlert, FlowButton, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { cn } from '../utils/cn';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { parseQrCheckInPayload } from '../utils/qrCheckIn';
import { absoluteAppUrl } from '../lib/publicAppUrl';
import { normalizeCheckoutFields } from '../utils/checkoutFields';

type AttendeeStats = { total: number; checkedIn: number; pending: number };
type CheckinConfig = { staffPin: string; staffUrl: string };
type CheckinResult = {
  ok: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  attendee?: Attendee;
};

type PanelView = 'scan' | 'list' | 'transfers';

export const CheckInManager: React.FC = () => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [stats, setStats] = useState<AttendeeStats>({ total: 0, checkedIn: 0, pending: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [panel, setPanel] = useState<PanelView>(
    initialTab === 'transfers' || initialTab === 'list' || initialTab === 'scan' ? initialTab : 'scan'
  );
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFieldDefinition[]>([]);
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const { eventId } = useParams<{ eventId: string }>();

  const selectPanel = (id: PanelView) => {
    setPanel(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'scan') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);
  const volunteerScannerUrl = useMemo(
    () => (config?.staffUrl ? absoluteAppUrl(config.staffUrl) : ''),
    [config?.staffUrl]
  );
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!eventId) return;
      const background = opts?.background ?? false;
      if (background) setRefreshing(true);
      else if (!hasLoadedOnceRef.current) setInitialLoading(true);
      if (!background) setErr(null);
      try {
        const searchParams = new URLSearchParams({ limit: '2000' });
        if (debouncedQ.trim()) searchParams.set('q', debouncedQ.trim());
        if (statusFilter !== 'all') searchParams.set('status', statusFilter);
        const res = await api.get<{ attendees: Attendee[]; stats: AttendeeStats }>(
          `/api/events/${eventId}/attendees?${searchParams.toString()}`
        );
        setAttendees(res.attendees);
        setStats(res.stats);
        hasLoadedOnceRef.current = true;
      } catch (e: unknown) {
        const error = e as { error?: string; message?: string };
        setErr(error?.message || error?.error || 'Failed to load attendees');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, debouncedQ, statusFilter]
  );

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

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ event: Event }>(`/api/events/${eventId}`);
        if (!cancelled) {
          setCheckoutFields(normalizeCheckoutFields(res.event?.customization?.checkoutFields));
        }
      } catch {
        if (!cancelled) setCheckoutFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ orders: Order[] }>(`/api/events/${eventId}/bank-transfer-orders?status=pending`);
        if (!cancelled) setPendingTransfers((res.orders || []).length);
      } catch {
        // Badge is optional; transfers tab still loads its own list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!selectedAttendee) return;
    const fresh = attendees.find((a) => a.id === selectedAttendee.id);
    if (fresh && fresh !== selectedAttendee) setSelectedAttendee(fresh);
  }, [attendees, selectedAttendee]);

  const handleRefresh = () => {
    void load({ background: true });
    void loadConfig();
  };

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
      await load({ background: true });
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
      await load({ background: true });
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

  const onScannerSuccess = useCallback(
    (res: CheckinResult) => {
      setLastCheckIn(res.attendee || null);
      setMsg(res.message || (res.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully'));
      setErr(null);
      void load({ background: true });
    },
    [load]
  );

  const pct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  if (!eventId) {
    return (
      <OrganizerFlowShell title="Check-in" navLinks={[]}>
        <FlowPage>
          <FlowAlert variant="error">Event not found.</FlowAlert>
        </FlowPage>
      </OrganizerFlowShell>
    );
  }

  if (initialLoading) {
    return (
      <OrganizerFlowShell title="Attendees & Check-in" navLinks={navLinks} maxWidth="wide">
        <div className="flex h-64 items-center justify-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: ui.accent, borderTopColor: 'transparent' }}
          />
        </div>
      </OrganizerFlowShell>
    );
  }

  return (
    <OrganizerFlowShell
      title="Attendees & Check-in"
      subtitle={stats.total > 0 ? `${stats.checkedIn} of ${stats.total} checked in (${pct}%)` : 'Scan tickets at the door or manage the list'}
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage className="max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-xl border p-1 sm:w-auto" style={cardStyle}>
            {(
              [
                { id: 'scan' as const, label: 'Scanner', icon: ScanLine },
                { id: 'list' as const, label: 'Attendee list', icon: List },
                { id: 'transfers' as const, label: 'Bank transfers', icon: Landmark },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectPanel(id)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold sm:flex-none sm:px-4',
                  panel === id ? 'turnout-btn-accent' : ''
                )}
                style={panel === id ? accentButtonStyleFor(ui) : { color: ui.textMuted }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                {id === 'transfers' && pendingTransfers > 0 ? (
                  <span
                    className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={
                      panel === id
                        ? { background: 'rgba(255,255,255,0.22)', color: 'inherit' }
                        : { background: 'rgba(245,158,11,0.22)', color: '#d97706' }
                    }
                  >
                    {pendingTransfers > 99 ? '99+' : pendingTransfers}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {panel === 'list' ? (
              <FlowButton onClick={() => setShowAddAttendee(true)} className="flex-1 sm:flex-none">
                <UserPlus className="h-4 w-4" />
                Add attendee
              </FlowButton>
            ) : null}
            <FlowButton variant="secondary" onClick={() => void exportCsv()} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4" />
              Export CSV
            </FlowButton>
            <FlowButton
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </FlowButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FlowStatCard label="Registered" value={stats.total} icon={<Users className="h-5 w-5" />} />
          <FlowStatCard label="Checked in" value={stats.checkedIn} icon={<UserCheck className="h-5 w-5" />} accent={ui.accent} />
          <FlowStatCard label="Waiting" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        </div>

        {err && <FlowAlert variant="error">{err}</FlowAlert>}
        {msg && !err && <FlowAlert variant="success">{msg}</FlowAlert>}

        {panel === 'scan' && (
          <div className="space-y-6">
            <CheckInScannerPanel eventId={eventId} onCheckInSuccess={onScannerSuccess} />

            <div className="rounded-2xl border p-5 shadow-sm" style={cardStyle}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                    <Shield className="h-4 w-4" style={{ color: ui.accent }} />
                    Volunteer door access
                  </div>
                  <p className="mt-1 max-w-xl text-sm" style={{ color: ui.textMuted }}>
                    Share the PIN with volunteers on a separate phone. They can open the volunteer link below — no organizer login needed.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={configLoading}
                  onClick={() => void regeneratePin()}
                  className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
                  style={{ ...cardStyle, color: ui.text }}
                >
                  {configLoading ? 'Updating…' : 'Regenerate PIN'}
                </button>
              </div>
              {config && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-4" style={cardMutedStyle}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Staff PIN
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-2xl font-bold tracking-[0.2em]" style={{ color: ui.text }}>
                        {config.staffPin}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText(config.staffPin, 'PIN')}
                        className="rounded-lg border px-2 py-1 text-xs font-bold"
                        style={{ ...cardStyle, color: ui.text }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 sm:col-span-2" style={cardMutedStyle}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Volunteer scanner link
                    </p>
                    <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                      Share this full link with volunteers — they enter the PIN above to open the scanner.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        readOnly
                        value={volunteerScannerUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className={cn(fieldClass, 'min-w-0 flex-1 font-mono text-xs sm:text-sm')}
                        style={fieldStyle}
                        aria-label="Volunteer scanner link"
                      />
                      <button
                        type="button"
                        onClick={() => void copyText(volunteerScannerUrl, 'Volunteer link')}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
                        style={{ ...cardStyle, color: ui.text }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {copyHint && (
                <p className="mt-2 text-xs font-medium" style={{ color: ui.accent }}>
                  {copyHint}
                </p>
              )}
            </div>
          </div>
        )}

        {panel === 'list' && (
          <div className="space-y-6">
            {lastCheckIn && (
              <div className="rounded-2xl border p-4" style={{ borderColor: ui.accent, background: ui.accentSoft }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.accentOn }}>
                  Last check-in
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
              <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardStyle}>
                <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: ui.text }}>
                  <QrCode className="h-5 w-5" style={{ color: ui.accent }} />
                  Manual check-in
                </h2>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Paste a token from a ticket QR if the camera is unavailable.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={qrToken}
                    onChange={(e) => setQrToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void checkIn()}
                    placeholder="QR token"
                    className={cn(fieldClass, 'flex-1')}
                    style={fieldStyle}
                  />
                  <button
                    type="button"
                    onClick={() => void checkIn()}
                    disabled={checkingIn || !qrToken.trim()}
                    className="turnout-btn-accent shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    style={accentButtonStyleFor(ui)}
                  >
                    {checkingIn ? 'Checking…' : 'Check in'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardStyle}>
                <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                  Quick tips
                </h2>
                <ul className="mt-3 space-y-2 text-sm" style={{ color: ui.textMuted }}>
                  <li>· Use the Scanner tab on your phone at the entrance.</li>
                  <li>· Each ticket has its own QR — one check-in per attendee.</li>
                  <li>· Tap Refresh after bulk changes to update counts.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border shadow-sm" style={cardStyle}>
              <div
                className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                style={{ borderColor: ui.borderColor }}
              >
                <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                  Attendee list
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAttendee(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:hidden"
                    style={accentButtonStyleFor(ui)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                  {(['all', 'pending', 'checked_in'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-bold capitalize',
                        statusFilter === f ? 'turnout-btn-accent' : ''
                      )}
                      style={
                        statusFilter === f
                          ? accentButtonStyleFor(ui)
                          : { background: ui.fieldBg, color: ui.textMuted }
                      }
                    >
                      {f === 'checked_in' ? 'Checked in' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-b p-4 sm:flex-row" style={{ borderColor: ui.borderColor }}>
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: ui.textSubtle }}
                  />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, email, ticket…"
                    className={cn(fieldClass, 'w-full py-2.5 pl-10 pr-4')}
                    style={fieldStyle}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowTokens((v) => !v)}
                  className="shrink-0 rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ ...cardStyle, color: ui.textMuted }}
                >
                  {showTokens ? 'Hide tokens' : 'Show tokens'}
                </button>
              </div>

              <div className="max-h-[min(70vh,560px)] overflow-auto">
                {attendees.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: ui.textMuted }}>
                    <p>No attendees match your filters.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddAttendee(true)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline"
                      style={{ color: ui.accent }}
                    >
                      <UserPlus className="h-4 w-4" />
                      Register an attendee manually
                    </button>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: ui.borderColor }}>
                    {attendees.map((a) => (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAttendee(a)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedAttendee(a);
                          }
                        }}
                        className="flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold" style={{ color: ui.text }}>
                              {a.fullName}
                            </span>
                            {a.checkedInAt ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: ui.accentSoft, color: ui.accentOn }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                In
                              </span>
                            ) : (
                              <span
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: 'rgba(245,158,11,0.20)', color: '#fbbf24' }}
                              >
                                Waiting
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                            {a.ticketName} · {a.email}
                            {a.phone ? ` · ${a.phone}` : ''}
                          </p>
                          {a.customFields && Object.keys(a.customFields).length > 0 ? (
                            <p className="mt-1 text-xs font-medium" style={{ color: ui.accent }}>
                              {Object.keys(a.customFields).length} checkout answer
                              {Object.keys(a.customFields).length === 1 ? '' : 's'} · tap for details
                            </p>
                          ) : (
                            <p className="mt-1 text-xs" style={{ color: ui.textSubtle }}>
                              Tap for full details
                            </p>
                          )}
                          {showTokens && (
                            <p className="mt-2 font-mono text-[11px]" style={{ color: ui.textSubtle }}>
                              …{a.qrToken.slice(-8)}
                            </p>
                          )}
                        </div>
                        <div
                          className="flex shrink-0 gap-2"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {!a.checkedInAt && (
                            <button
                              type="button"
                              onClick={() => void checkIn(a.qrToken)}
                              className="turnout-btn-accent rounded-lg px-3 py-1.5 text-xs font-bold"
                              style={accentButtonStyleFor(ui)}
                            >
                              Check in
                            </button>
                          )}
                          {a.checkedInAt && (
                            <button
                              type="button"
                              onClick={() => void undoCheckIn(a)}
                              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold"
                              style={{ ...cardStyle, color: ui.textMuted }}
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
        )}

        {panel === 'transfers' && (
          <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardStyle}>
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: ui.text }}>
                <Landmark className="h-5 w-5" style={{ color: ui.accent }} />
                Pending bank transfers
              </h2>
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                Confirm or reject transfer slips here. Tickets are issued after you confirm payment.
              </p>
            </div>
            <BankTransferOrdersPanel
              eventId={eventId}
              ui={ui}
              onFeedback={setMsg}
              onError={setErr}
              onPendingCountChange={setPendingTransfers}
            />
          </div>
        )}

        {selectedAttendee ? (
          <AttendeeDetailDrawer
            attendee={selectedAttendee}
            checkoutFields={checkoutFields}
            ui={ui}
            checkingIn={checkingIn}
            onClose={() => setSelectedAttendee(null)}
            onCheckIn={(a) => {
              void checkIn(a.qrToken);
            }}
            onUndoCheckIn={(a) => {
              void undoCheckIn(a);
            }}
          />
        ) : null}

        <ManualAddAttendeeModal
          open={showAddAttendee}
          eventId={eventId}
          checkoutFields={checkoutFields}
          ui={ui}
          onClose={() => setShowAddAttendee(false)}
          onCreated={(attendee, nextStats) => {
            setAttendees((prev) => [attendee, ...prev.filter((a) => a.id !== attendee.id)]);
            if (nextStats) setStats(nextStats);
            else {
              setStats((prev) => ({
                total: prev.total + 1,
                checkedIn: prev.checkedIn,
                pending: prev.pending + 1,
              }));
            }
            setMsg(`${attendee.fullName} registered successfully.`);
            setErr(null);
            setSelectedAttendee(attendee);
            void load({ background: true });
          }}
        />
      </FlowPage>
    </OrganizerFlowShell>
  );
};
