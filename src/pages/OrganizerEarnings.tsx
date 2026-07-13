import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, Banknote, Percent, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { OrganizerPayout } from '../types';
import { formatLKR } from '../utils/money';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowStatCard, FlowCard, FlowAlert } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { accentButtonStyleFor, cardMutedStyleFor } from '../themes/flowUi';
import { Skeleton } from '../components/ui/Feedback';
import { cn } from '../utils/cn';

type EarningsPayload = {
  grossRevenue: number;
  platformFees: number;
  netEarnings: number;
  paidOut: number;
  availableBalance: number;
  payoutHistory: OrganizerPayout[];
};

function payoutStatusStyle(status: string, ui: typeof APP_FLOW_UI) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'paid') {
    return { background: ui.accentSoft, color: ui.accentOn, borderColor: ui.borderColor };
  }
  if (normalized === 'pending' || normalized === 'processing') {
    return { background: 'rgba(255, 255, 255, 0.08)', color: ui.textMuted, borderColor: ui.borderColor };
  }
  return { background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', borderColor: 'rgba(239, 68, 68, 0.25)' };
}

export const OrganizerEarnings: React.FC = () => {
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ earnings: EarningsPayload }>('/api/organizer/earnings');
        setEarnings(res.earnings);
      } catch (e: unknown) {
        const err = e as { error?: string };
        setError(err?.error || 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <OrganizerFlowShell
      title="Earnings & Payouts"
      subtitle="Track gross revenue, platform fees, and payout history."
      navLinks={organizerMainNav}
    >
      <FlowPage>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}

        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-36 rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        )}

        {!loading && earnings && (
          <div className="space-y-6">
            <FlowCard className="overflow-hidden p-0">
              <div
                className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
                style={accentButtonStyleFor(ui)}
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">Available balance</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                    {formatLKR(earnings.availableBalance)}
                  </p>
                  <p className="mt-2 max-w-md text-sm opacity-80">
                    Ready for withdrawal once payouts are processed to your registered bank account.
                  </p>
                </div>
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(10, 36, 38, 0.12)' }}
                >
                  <Wallet className="h-7 w-7" />
                </div>
              </div>
            </FlowCard>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FlowStatCard
                label="Gross Revenue"
                value={formatLKR(earnings.grossRevenue)}
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <FlowStatCard
                label="Platform Fees"
                value={formatLKR(earnings.platformFees)}
                icon={<Percent className="h-5 w-5" />}
              />
              <FlowStatCard
                label="Net Earnings"
                value={formatLKR(earnings.netEarnings)}
                icon={<Banknote className="h-5 w-5" />}
              />
              <FlowStatCard
                label="Paid Out"
                value={formatLKR(earnings.paidOut)}
                icon={<ArrowDownToLine className="h-5 w-5" />}
              />
            </div>

            <FlowCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                    Payout history
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    Transfers sent to your bank after each payout cycle.
                  </p>
                </div>
                <span
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ ...cardMutedStyleFor(ui), color: ui.textMuted }}
                >
                  {earnings.payoutHistory.length} record{earnings.payoutHistory.length === 1 ? '' : 's'}
                </span>
              </div>

              {earnings.payoutHistory.length === 0 ? (
                <div
                  className="mt-6 rounded-2xl border border-dashed px-6 py-12 text-center"
                  style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
                >
                  <ArrowDownToLine className="mx-auto h-8 w-8" style={{ color: ui.textSubtle }} />
                  <p className="mt-3 text-base font-semibold" style={{ color: ui.text }}>
                    No payouts yet
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: ui.textMuted }}>
                    When your available balance is paid out, each transfer will appear here with status and reference.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {earnings.payoutHistory.map((p) => {
                    const badge = payoutStatusStyle(p.status, ui);
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                        style={{ borderColor: ui.borderColor, background: ui.fieldBg }}
                      >
                        <div>
                          <p className="text-sm font-semibold tabular-nums" style={{ color: ui.text }}>
                            {formatLKR(p.totalAmount)}
                          </p>
                          {p.reference ? (
                            <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
                              Ref: {p.reference}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide')}
                          style={badge}
                        >
                          {p.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </FlowCard>
          </div>
        )}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
