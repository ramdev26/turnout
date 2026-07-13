import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  Circle,
  ExternalLink,
  Percent,
  Search,
  Ticket,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowAlert, FlowButton, FlowCard, FlowInput, FlowLabel, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
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

const MISSING_LABELS: Record<string, string> = {
  organization_name: 'Organization name',
  business_address: 'Business address',
  phone: 'Phone number',
  business_registration_doc: 'Business registration document',
  bank_statement_doc: 'Bank statement document',
  bank_account_holder_name: 'Account holder name',
  bank_name: 'Bank name',
  bank_branch: 'Bank branch',
  bank_account_number: 'Bank account number',
};

function docUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/api/')) return url.startsWith('http') ? url : toApiUrl(url);
  return toApiUrl(url);
}

function commissionSummary(mode?: string, value?: number): string {
  if (mode === 'flat_per_ticket') return `${formatLKR(value ?? 0)} / ticket`;
  return `${value ?? 10}% of order`;
}

function setupChecks(row: Pick<
  AdminOrganizerRow,
  'bankAccountConfigured' | 'businessRegistrationDocUploaded' | 'bankStatementDocUploaded' | 'paidEventReady'
>) {
  return [
    { key: 'paid', label: 'Paid events ready', ok: row.paidEventReady },
    { key: 'bank', label: 'Bank account', ok: row.bankAccountConfigured },
    { key: 'br', label: 'BR document', ok: row.businessRegistrationDocUploaded },
    { key: 'stmt', label: 'Bank statement', ok: row.bankStatementDocUploaded },
  ];
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

function InfoRow({ label, value }: { label: string; value: string }) {
  const ui = APP_FLOW_UI;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium" style={{ color: ui.textMuted }}>
        {label}
      </span>
      <span className="text-sm font-medium sm:text-right" style={{ color: ui.text }}>
        {value}
      </span>
    </div>
  );
}

export const AdminOrganizers: React.FC = () => {
  const ui = APP_FLOW_UI;
  const fieldStyle = fieldStyleFor(ui);
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

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.organizerId === selectedId) ?? null,
    [rows, selectedId],
  );

  const createPayout = async (organizerId: string, amount: number) => {
    if (amount <= 0) return;
    setMessage(null);
    setError(null);
    try {
      await api.post('/api/admin/payouts', {
        organizerId,
        totalAmount: amount,
        notes: 'Created from BasAdmin organizers panel',
      });
      setMessage('Payout created successfully.');
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
      setMessage('Commission saved.');
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
      subtitle="Manage profiles, commission rates, KYC, bank details, and payouts."
    >
      {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
      {message ? <FlowAlert variant="success">{message}</FlowAlert> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: ui.textMuted }} />
          <FlowInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
            placeholder="Search name, email, or organization…"
            className="pl-10"
          />
        </div>
        <FlowButton onClick={() => void load()}>Search</FlowButton>
      </div>

      {loading ? (
        <FlowCard>
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Loading organizers…
          </p>
        </FlowCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]">
          <FlowCard className="p-0">
            <div className="border-b px-5 py-4" style={{ borderColor: ui.borderColor }}>
              <p className="text-sm font-semibold" style={{ color: ui.text }}>
                {rows.length} organizer{rows.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs" style={{ color: ui.textMuted }}>
                Select one to edit commission and review setup
              </p>
            </div>
            <div className="max-h-[calc(100vh-16rem)] divide-y overflow-y-auto" style={{ borderColor: ui.borderColor }}>
              {rows.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: ui.textMuted }}>
                  No organizers match your search.
                </p>
              ) : (
                rows.map((o) => {
                  const checks = setupChecks(o);
                  const done = checks.filter((c) => c.ok).length;
                  const selected = selectedId === o.organizerId;
                  return (
                    <button
                      key={o.organizerId}
                      type="button"
                      onClick={() => void loadDetail(o.organizerId)}
                      className={cn(
                        'w-full px-5 py-4 text-left transition hover:bg-white/[0.03]',
                        selected && 'bg-white/[0.05]',
                      )}
                      style={selected ? { boxShadow: `inset 3px 0 0 ${ui.accent}` } : undefined}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold" style={{ color: ui.text }}>
                            {o.organizationName || o.displayName}
                          </p>
                          <p className="mt-0.5 truncate text-sm" style={{ color: ui.textMuted }}>
                            {o.email}
                          </p>
                          <p className="mt-2 text-xs" style={{ color: ui.textSubtle }}>
                            {o.eventsCount} event{o.eventsCount === 1 ? '' : 's'} · Setup {done}/{checks.length} ·{' '}
                            {commissionSummary(o.commissionMode, o.commissionValue)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums" style={{ color: ui.text }}>
                            {formatLKR(o.availableBalance)}
                          </p>
                          <p className="text-[11px] uppercase tracking-wide" style={{ color: ui.textMuted }}>
                            available
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
                  Loading organizer…
                </p>
              </FlowCard>
            ) : !detail || !selectedRow ? (
              <FlowCard className="text-center">
                <Building2 className="mx-auto h-10 w-10" style={{ color: ui.textSubtle }} />
                <p className="mt-3 text-sm font-medium" style={{ color: ui.text }}>
                  Select an organizer
                </p>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Commission, business profile, documents, and payouts appear here.
                </p>
              </FlowCard>
            ) : (
              <div className="space-y-4">
                <FlowCard>
                  <p className="text-lg font-semibold" style={{ color: ui.text }}>
                    {detail.profile.organizationName || detail.user.displayName}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    {detail.user.email}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border px-2.5 py-1 capitalize" style={cardMutedStyleFor(ui)}>
                      {detail.user.status}
                    </span>
                    <span className="rounded-full border px-2.5 py-1" style={cardMutedStyleFor(ui)}>
                      Gateway: {detail.readiness.gatewayMode === 'own_payhere' ? 'Own PayHere' : 'Turnout'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border px-3 py-3" style={cardMutedStyleFor(ui)}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                        Net earnings
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: ui.text }}>
                        {formatLKR(detail.balance.netEarnings)}
                      </p>
                    </div>
                    <div className="rounded-xl border px-3 py-3" style={cardMutedStyleFor(ui)}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                        Available
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: ui.text }}>
                        {formatLKR(detail.balance.availableBalance)}
                      </p>
                    </div>
                  </div>

                  {detail.balance.availableBalance > 0 ? (
                    <FlowButton
                      className="mt-4 w-full"
                      onClick={() => void createPayout(detail.user.id, detail.balance.availableBalance)}
                    >
                      Pay out {formatLKR(detail.balance.availableBalance)}
                    </FlowButton>
                  ) : null}
                </FlowCard>

                <DetailSection title="Platform commission" icon={<Percent className="h-4 w-4" />}>
                  <p className="mb-4 text-sm" style={{ color: ui.textMuted }}>
                    Applied to this organizer&apos;s ticket sales. Current:{' '}
                    <span style={{ color: ui.text }}>
                      {detail.commission.mode === 'flat_per_ticket'
                        ? `${formatLKR(detail.commission.value)} per ticket`
                        : `${detail.commission.value}% of order total`}
                    </span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>Commission type</FlowLabel>
                      <select
                        className={fieldClassFor(ui)}
                        style={{ ...fieldStyle, color: ui.text }}
                        value={commissionMode}
                        onChange={(e) => setCommissionMode(e.target.value as 'percentage' | 'flat_per_ticket')}
                      >
                        <option value="percentage">Percentage of order</option>
                        <option value="flat_per_ticket">Flat fee per ticket</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>{commissionMode === 'flat_per_ticket' ? 'Amount (LKR)' : 'Rate (%)'}</FlowLabel>
                      <FlowInput
                        type="number"
                        min={0}
                        step={commissionMode === 'flat_per_ticket' ? '0.01' : '0.1'}
                        value={commissionValue}
                        onChange={(e) => setCommissionValue(e.target.value)}
                        placeholder={commissionMode === 'flat_per_ticket' ? '50' : '10'}
                      />
                    </label>
                  </div>
                  <FlowButton
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => void saveCommission(detail.user.id)}
                    disabled={savingCommission}
                  >
                    {savingCommission ? 'Saving…' : 'Save commission'}
                  </FlowButton>
                </DetailSection>

                <DetailSection title="Setup checklist" icon={<CheckCircle2 className="h-4 w-4" />}>
                  <ul className="space-y-2">
                    {setupChecks(selectedRow).map((item) => (
                      <li key={item.key} className="flex items-center gap-2 text-sm">
                        {item.ok ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#34d399' }} />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0" style={{ color: ui.textSubtle }} />
                        )}
                        <span style={{ color: item.ok ? ui.text : ui.textMuted }}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  {!detail.readiness.isReady && detail.readiness.missing?.length > 0 ? (
                    <div
                      className="mt-4 rounded-lg border px-3 py-3"
                      style={{ borderColor: 'rgba(251, 191, 36, 0.35)', background: 'rgba(251, 191, 36, 0.08)' }}
                    >
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: '#fbbf24' }}>
                        <AlertCircle className="h-4 w-4" />
                        Still needed
                      </div>
                      <ul className="space-y-1 text-sm" style={{ color: ui.textMuted }}>
                        {detail.readiness.missing.map((key) => (
                          <li key={key}>· {MISSING_LABELS[key] ?? key.replaceAll('_', ' ')}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </DetailSection>

                <DetailSection title="Business & bank" icon={<Building2 className="h-4 w-4" />}>
                  <div className="space-y-3">
                    <InfoRow label="Phone" value={detail.profile.phone || '—'} />
                    <InfoRow label="Address" value={detail.profile.businessAddress || '—'} />
                    <InfoRow label="Registration no." value={detail.profile.businessRegistrationNo || '—'} />
                    <InfoRow label="Account holder" value={detail.profile.bankAccountHolderName || '—'} />
                    <InfoRow
                      label="Bank"
                      value={
                        detail.profile.bankName
                          ? `${detail.profile.bankName}${detail.profile.bankBranch ? ` · ${detail.profile.bankBranch}` : ''}`
                          : '—'
                      }
                    />
                    <InfoRow
                      label="Account"
                      value={
                        detail.profile.bankAccountNumberLast4
                          ? `•••• ${detail.profile.bankAccountNumberLast4}`
                          : 'Not configured'
                      }
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {detail.profile.businessRegistrationDocUrl ? (
                      <a
                        href={docUrl(detail.profile.businessRegistrationDocUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ ...cardMutedStyleFor(ui), color: ui.text }}
                      >
                        BR document
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {detail.profile.bankStatementDocUrl ? (
                      <a
                        href={docUrl(detail.profile.bankStatementDocUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ ...cardMutedStyleFor(ui), color: ui.text }}
                      >
                        Bank statement
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </DetailSection>

                <DetailSection title={`Events (${detail.events.length})`} icon={<Ticket className="h-4 w-4" />}>
                  {detail.events.length === 0 ? (
                    <p className="text-sm" style={{ color: ui.textMuted }}>
                      No events yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.events.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                          style={cardStyleFor(ui)}
                        >
                          <span className="min-w-0 truncate text-sm font-medium" style={{ color: ui.text }}>
                            {ev.title}
                          </span>
                          <a
                            href={`/e/${ev.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold"
                            style={{ color: ui.accent }}
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailSection>

                <DetailSection title="Recent payouts" icon={<Banknote className="h-4 w-4" />}>
                  {detail.payouts.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm" style={{ ...cardMutedStyleFor(ui), color: ui.textMuted }}>
                      No payouts recorded yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.payouts.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                          style={cardMutedStyleFor(ui)}
                        >
                          <span style={{ color: ui.textMuted }}>#{p.id}</span>
                          <span className="font-semibold tabular-nums" style={{ color: ui.text }}>
                            {formatLKR(p.totalAmount)}
                          </span>
                          <span className="capitalize" style={{ color: ui.textMuted }}>
                            {p.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to={`${BASADMIN_BASE}/payouts`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                    style={{ color: ui.accent }}
                  >
                    Open payout control
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </DetailSection>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
};
