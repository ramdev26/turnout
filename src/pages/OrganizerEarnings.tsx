import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { OrganizerPayout } from '../types';
import { formatLKR } from '../utils/money';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

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

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ earnings: EarningsPayload }>('/api/organizer/earnings');
        setEarnings(res.earnings);
      } catch (e: any) {
        setError(e?.error || 'Failed to load earnings');
      }
    })();
  }, []);

  if (error) return <div className="py-8 text-sm font-semibold text-red-600">{error}</div>;
  if (!earnings) return <div className="py-8 text-sm text-neutral-500">Loading earnings…</div>;

  return (
    <OrganizerShell title="Earnings & Payouts" subtitle="Track gross revenue, commission deductions, and payout history.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Gross Revenue" value={formatLKR(earnings.grossRevenue)} />
          <Card label="Platform Fees" value={formatLKR(earnings.platformFees)} />
          <Card label="Net Earnings" value={formatLKR(earnings.netEarnings)} />
          <Card label="Paid Out" value={formatLKR(earnings.paidOut)} />
          <Card label="Available Balance" value={formatLKR(earnings.availableBalance)} accent />
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-neutral-900">Payout History</h2>
          {earnings.payoutHistory.length === 0 ? (
            <div className="text-sm text-neutral-500">No payouts yet.</div>
          ) : (
            <div className="space-y-2">
              {earnings.payoutHistory.map((p) => (
                <div key={p.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-neutral-900">{formatLKR(p.totalAmount)}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{p.status}</span>
                  </div>
                  {p.reference ? <div className="mt-1 text-xs text-neutral-500">Reference: {p.reference}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </OrganizerShell>
  );
};

const Card = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${accent ? 'border-[#00E676]/30 bg-[#ecfdf3]' : 'border-neutral-200 bg-white'}`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
    <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
  </div>
);
