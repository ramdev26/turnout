import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toApiUrl } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowAlert, FlowButton, FlowCard, FlowInput, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';
import { formatLKR } from '../utils/money';
import { BASADMIN_BASE } from '../utils/adminNav';
import { cn } from '../utils/cn';
import type { OrganizerPaidEventReadiness, OrganizerProfile } from '../types';

type AdminOrganizerRow = {
  organizerId: string;
  displayName: string;
  email: string;
  status: string;
  organizationName: string;
  phone: string | null;
  businessAddress: string | null;
  businessRegistrationNo: string | null;
  businessRegistrationDocUploaded: boolean;
  bankStatementDocUploaded: boolean;
  bankAccountConfigured: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountHolderName: string | null;
  bankAccountNumberLast4: string | null;
  paidEventReady: boolean;
  gatewayMode: string;
  commissionMode?: 'percentage' | 'flat_per_ticket';
  commissionValue?: number;
  eventsCount: number;
  grossRevenue: number;
  netEarnings: number;
  paidOut: number;
  availableBalance: number;
  createdAt: string;
};

type OrganizerDetail = {
  user: { id: string; email: string; displayName: string; status: string; createdAt: string };
  profile: OrganizerProfile;
  readiness: OrganizerPaidEventReadiness;
  commission: {
    mode: 'percentage' | 'flat_per_ticket';
    value: number;
  };
  balance: {
    grossRevenue: number;
    platformFees: number;
    netEarnings: number;
    paidOut: number;
    availableBalance: number;
  };
  events: Array<{ id: string; slug: string; title: string; status: string; eventStatus: string; createdAt: string }>;
  payouts: Array<{
    id: string;
    totalAmount: number;
    status: string;
    reference: string | null;
    notes: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

function docUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/api/')) return url.startsWith('http') ? url : toApiUrl(url);
  return toApiUrl(url);
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const ui = APP_FLOW_UI;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: ok ? ui.accentSoft : 'rgba(248,113,113,0.15)',
        color: ok ? ui.accent : '#f87171',
      }}
    >
      {label}
    </span>
  );
}

export const AdminOrganizers: React.FC = () => {
  const ui = APP_FLOW_UI;
  const [rows, setRows] = useState<AdminOrganizerRow[]>([]);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrganizerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [commissionMode, setCommissionMode] = useState<'percentage' | 'flat_per_ticket'>('percentage');
  const [commissionValue, setCommissionValue] = useState<string>('10');
  const [savingCommission, setSavingCommission] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const res = await api.get<{ organizers: AdminOrganizerRow[] }>(`/api/admin/organizers?${params.toString()}`);
      setRows(res.organizers);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load organizers');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (organizerId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await api.get<OrganizerDetail>(`/api/admin/organizers/${organizerId}`);
      setDetail(res);
      setSelectedId(organizerId);
      setCommissionMode(res.commission.mode);
      setCommissionValue(String(res.commission.value ?? ''));
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load organizer details');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedRow = useMemo(
    () => rows.find((r) => r.organizerId === selectedId) ?? null,
    [rows, selectedId]
  );

  const createPayout = async (organizerId: string, amount: number) => {
    if (amount <= 0) return;
    setMessage(null);
    try {
      await api.post('/api/admin/payouts', {
        organizerId,
        totalAmount: amount,
        notes: 'Created from BasAdmin organizers panel',
      });
      setMessage('Payout created.');
      await load();
      if (selectedId === organizerId) await loadDetail(organizerId);
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string };
      setError(err?.message || err?.error || 'Could not create payout');
    }
  };

  const saveCommission = async (organizerId: string) => {
    const value = Number(commissionValue);
    if (!Number.isFinite(value) || value < 0) {
      setError('Commission value must be a positive number.');
      return;
    }
    setSavingCommission(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.post<{ commission: { mode: 'percentage' | 'flat_per_ticket'; value: number } }>(
        `/api/admin/organizers/${organizerId}/commission`,
        {
          commissionMode,
          commissionValue: value,
        },
      );
      setCommissionMode(res.commission.mode);
      setCommissionValue(String(res.commission.value));
      setMessage('Commission updated.');
      await load();
      if (selectedId === organizerId) await loadDetail(organizerId);
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string };
      setError(err?.message || err?.error || 'Failed to update commission');
    } finally {
      setSavingCommission(false);
    }
  };

  return (
    <AdminShell
      title="Organizers"
      subtitle="Business profiles, KYC documents, bank details, earnings, and payout control."
    >
      {error && <FlowAlert variant="error">{error}</FlowAlert>}
      {message && <FlowAlert variant="success">{message}</FlowAlert>}

      <FlowCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <FlowInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, organization…"
            className="min-w-[220px] flex-1"
          />
          <FlowButton onClick={() => void load()}>Search</FlowButton>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Loading organizers…
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  No organizers found.
                </p>
              ) : (
                rows.map((o) => (
                  <button
                    key={o.organizerId}
                    type="button"
                    onClick={() => void loadDetail(o.organizerId)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-3 text-left transition',
                      selectedId === o.organizerId && 'ring-2'
                    )}
                    style={{
                      ...cardMutedStyleFor(ui),
                      ...(selectedId === o.organizerId ? { borderColor: ui.accent } : {}),
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: ui.text }}>
                          {o.organizationName || o.displayName}
                        </p>
                        <p className="truncate text-xs" style={{ color: ui.textMuted }}>
                          {o.email} · {o.eventsCount} events
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: ui.accent }}>
                          {formatLKR(o.availableBalance)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                          available
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill ok={o.paidEventReady} label={o.paidEventReady ? 'Paid ready' : 'Setup incomplete'} />
                      <StatusPill
                        ok
                        label={
                          o.commissionMode === 'flat_per_ticket'
                            ? `Fee ${formatLKR(o.commissionValue ?? 0)} / ticket`
                            : `${o.commissionValue ?? 10}% fee`
                        }
                      />
                      <StatusPill ok={o.bankAccountConfigured} label="Bank" />
                      <StatusPill ok={o.businessRegistrationDocUploaded} label="BR doc" />
                      <StatusPill ok={o.bankStatementDocUploaded} label="Statement" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border p-4 xl:sticky xl:top-6 xl:self-start" style={cardMutedStyleFor(ui)}>
              {detailLoading ? (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Loading details…
                </p>
              ) : !detail || !selectedRow ? (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Select an organizer to view business details, documents, events, and payouts.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold" style={{ color: ui.text }}>
                      {detail.profile.organizationName || detail.user.displayName}
                    </p>
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      {detail.user.email} · {detail.user.status} · Gateway: {detail.readiness.gatewayMode}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border px-2.5 py-2" style={cardMutedStyleFor(ui)}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                        Net earnings
                      </p>
                      <p className="font-semibold" style={{ color: ui.text }}>
                        {formatLKR(detail.balance.netEarnings)}
                      </p>
                    </div>
                    <div className="rounded-lg border px-2.5 py-2" style={cardMutedStyleFor(ui)}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                        Available
                      </p>
                      <p className="font-semibold" style={{ color: ui.accent }}>
                        {formatLKR(detail.balance.availableBalance)}
                      </p>
                    </div>
                  </div>

                  {detail.balance.availableBalance > 0 && (
                    <FlowButton onClick={() => void createPayout(detail.user.id, detail.balance.availableBalance)}>
                      Pay {formatLKR(detail.balance.availableBalance)}
                    </FlowButton>
                  )}

                  <div className="rounded-xl border p-3" style={cardMutedStyleFor(ui)}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Organizer commission
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs" style={{ color: ui.textMuted }}>
                        Type
                        <select
                          className="mt-1 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm"
                          value={commissionMode}
                          onChange={(e) => setCommissionMode(e.target.value as 'percentage' | 'flat_per_ticket')}
                          style={{ borderColor: 'rgba(255,255,255,0.12)', color: ui.text }}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat_per_ticket">Flat fee per ticket (LKR)</option>
                        </select>
                      </label>
                      <label className="text-xs" style={{ color: ui.textMuted }}>
                        Value
                        <FlowInput
                          className="mt-1"
                          type="number"
                          min={0}
                          step={commissionMode === 'flat_per_ticket' ? '0.01' : '0.1'}
                          value={commissionValue}
                          onChange={(e) => setCommissionValue(e.target.value)}
                          placeholder={commissionMode === 'flat_per_ticket' ? 'e.g. 50' : 'e.g. 10'}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs" style={{ color: ui.textMuted }}>
                        Current: {detail.commission.mode === 'flat_per_ticket'
                          ? `${formatLKR(detail.commission.value)} per ticket`
                          : `${detail.commission.value}% of order total`}
                      </p>
                      <FlowButton onClick={() => void saveCommission(detail.user.id)} disabled={savingCommission}>
                        {savingCommission ? 'Saving…' : 'Save commission'}
                      </FlowButton>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Business
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: ui.textMuted }}>
                      <p>Phone: {detail.profile.phone || '—'}</p>
                      <p>Address: {detail.profile.businessAddress || '—'}</p>
                      <p>Reg. no: {detail.profile.businessRegistrationNo || '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Bank
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: ui.textMuted }}>
                      <p>{detail.profile.bankAccountHolderName || '—'}</p>
                      <p>
                        {detail.profile.bankName || '—'}
                        {detail.profile.bankBranch ? ` · ${detail.profile.bankBranch}` : ''}
                      </p>
                      <p>
                        Account:{' '}
                        {detail.profile.bankAccountNumberLast4
                          ? `•••• ${detail.profile.bankAccountNumberLast4}`
                          : 'Not configured'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detail.profile.businessRegistrationDocUrl ? (
                      <a
                        href={docUrl(detail.profile.businessRegistrationDocUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                        style={{ ...cardMutedStyleFor(ui), color: ui.text }}
                      >
                        View BR document
                      </a>
                    ) : null}
                    {detail.profile.bankStatementDocUrl ? (
                      <a
                        href={docUrl(detail.profile.bankStatementDocUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                        style={{ ...cardMutedStyleFor(ui), color: ui.text }}
                      >
                        View bank statement
                      </a>
                    ) : null}
                  </div>

                  {!detail.readiness.isReady && detail.readiness.missing && detail.readiness.missing.length > 0 && (
                    <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: '#fbbf24', color: ui.textMuted }}>
                      Missing setup: {detail.readiness.missing.join(', ')}
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Events ({detail.events.length})
                    </p>
                    <div className="max-h-36 space-y-1 overflow-y-auto">
                      {detail.events.map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium" style={{ color: ui.text }}>
                            {ev.title}
                          </span>
                          <a
                            href={`/e/${ev.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-semibold"
                            style={{ color: ui.accent }}
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Recent payouts
                    </p>
                    <div className="max-h-28 space-y-1 overflow-y-auto text-xs" style={{ color: ui.textMuted }}>
                      {detail.payouts.length === 0 ? (
                        <p>No payouts yet.</p>
                      ) : (
                        detail.payouts.map((p) => (
                          <p key={p.id}>
                            #{p.id} · {formatLKR(p.totalAmount)} · {p.status}
                          </p>
                        ))
                      )}
                    </div>
                  </div>

                  <Link
                    to={`${BASADMIN_BASE}/payouts`}
                    className="inline-block text-xs font-semibold"
                    style={{ color: ui.accent }}
                  >
                    Open full payout control →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </FlowCard>
    </AdminShell>
  );
};
