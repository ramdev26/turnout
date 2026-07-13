import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatApiError } from '../utils/apiError';
import { AdminSummary } from '../types';
import { formatLKR } from '../utils/money';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowStatCard, FlowCard, FlowAlert, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

export const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const [s] = await Promise.all([
      api.get<{ summary: AdminSummary }>('/api/admin/summary'),
    ]);
    setSummary(s.summary);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e: unknown) {
        setError(formatApiError(e, 'Failed to load admin dashboard'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ui = APP_FLOW_UI;
  if (loading) return <AdminShell title="Super Admin Dashboard"><div className="py-8 text-sm" style={{ color: ui.textMuted }}>Loading…</div></AdminShell>;
  if (error) return <AdminShell title="Super Admin Dashboard"><FlowAlert variant="error">{error}</FlowAlert></AdminShell>;

  return (
    <AdminShell title="Platform Dashboard" subtitle="Revenue, users, events, payouts, and top performers across Turnout.">
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <FlowStatCard label="Total Users" value={summary.totalUsers ?? 0} />
          <FlowStatCard label="Total Events" value={summary.totalEvents ?? 0} />
          <FlowStatCard label="Active Events" value={summary.activeEvents ?? 0} accent={ui.accent} />
          <FlowStatCard label="Revenue" value={formatLKR(summary.totalRevenue)} />
          <FlowStatCard label="Today Revenue" value={formatLKR(summary.todayRevenue ?? 0)} accent={ui.accent} />
          <FlowStatCard label="Platform Fees" value={formatLKR(summary.totalPlatformFees)} />
          <FlowStatCard label="Paid Out" value={formatLKR(summary.totalPaidOut)} />
          <FlowStatCard label="Pending Payouts" value={formatLKR(summary.pendingPayoutAmount)} />
          <FlowStatCard label="Transactions" value={summary.transactionCount} />
          <FlowStatCard label="Failed Payments" value={summary.failedPayments ?? 0} />
          <FlowStatCard label="Refund Requests" value={summary.refundRequests ?? 0} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <FlowCard>
          <h2 className="mb-3 text-lg font-semibold" style={{ color: ui.text }}>Top Performing Events</h2>
          <div className="space-y-2">
            {(summary?.topEvents ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm" style={cardMutedStyleFor(ui)}>
                <span className="font-medium" style={{ color: ui.text }}>{event.title}</span>
                <span className="font-semibold" style={{ color: ui.accent }}>{formatLKR(event.revenue)}</span>
              </div>
            ))}
          </div>
        </FlowCard>
        <FlowCard>
          <h2 className="mb-3 text-lg font-semibold" style={{ color: ui.text }}>Top Organizers</h2>
          <div className="space-y-2">
            {(summary?.topOrganizers ?? []).map((org) => (
              <div key={org.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm" style={cardMutedStyleFor(ui)}>
                <span className="font-medium" style={{ color: ui.text }}>{org.name}</span>
                <span className="font-semibold" style={{ color: ui.accent }}>{formatLKR(org.earnings)}</span>
              </div>
            ))}
          </div>
        </FlowCard>
      </div>
    </AdminShell>
  );
};
