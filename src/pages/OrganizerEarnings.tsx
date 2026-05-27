import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { OrganizerPayout } from '../types';
import { formatLKR } from '../utils/money';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowStatCard, FlowCard, FlowAlert } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

type EarningsPayload = {
  grossRevenue: number;
  platformFees: number;
  netEarnings: number;
  paidOut: number;
  availableBalance: number;
  payoutHistory: OrganizerPayout[];
};

export const OrganizerEarnings: React.FC = () => {
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
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
      }
    })();
  }, []);

  return (
    <OrganizerFlowShell
      title="Earnings & Payouts"
      subtitle="Track gross revenue, commission deductions, and payout history."
      navLinks={organizerMainNav}
    >
      <FlowPage>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {!earnings && !error && (
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Loading earnings…
          </p>
        )}
        {earnings && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <FlowStatCard label="Gross Revenue" value={formatLKR(earnings.grossRevenue)} />
              <FlowStatCard label="Platform Fees" value={formatLKR(earnings.platformFees)} />
              <FlowStatCard label="Net Earnings" value={formatLKR(earnings.netEarnings)} />
              <FlowStatCard label="Paid Out" value={formatLKR(earnings.paidOut)} />
              <FlowStatCard label="Available Balance" value={formatLKR(earnings.availableBalance)} accent={ui.accent} />
            </div>

            <FlowCard>
              <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                Payout History
              </h2>
              {earnings.payoutHistory.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                  No payouts yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {earnings.payoutHistory.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border px-3 py-2.5 text-sm"
                      style={{ borderColor: ui.borderColor, background: ui.fieldBg }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold" style={{ color: ui.text }}>
                          {formatLKR(p.totalAmount)}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                          {p.status}
                        </span>
                      </div>
                      {p.reference ? (
                        <div className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                          Reference: {p.reference}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </FlowCard>
          </div>
        )}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
