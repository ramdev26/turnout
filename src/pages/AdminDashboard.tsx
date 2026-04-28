import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminSummary } from '../types';
import { formatLKR } from '../utils/money';
import { AdminShell } from '../components/admin/AdminShell';

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
      } catch (e: any) {
        setError(e?.error || 'Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="py-8 text-sm text-neutral-500">Loading admin dashboard…</div>;
  if (error) return <div className="py-8 text-sm font-semibold text-red-600">{error}</div>;

  return (
    <AdminShell title="Super Admin Dashboard" subtitle="Real-time platform visibility and control.">
      {summary && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Total Users" value={String(summary.totalUsers ?? 0)} />
          <StatCard label="Total Events" value={String(summary.totalEvents ?? 0)} />
          <StatCard label="Active Events" value={String(summary.activeEvents ?? 0)} />
          <StatCard label="Revenue" value={formatLKR(summary.totalRevenue)} />
          <StatCard label="Today Revenue" value={formatLKR(summary.todayRevenue ?? 0)} />
          <StatCard label="Platform Fees" value={formatLKR(summary.totalPlatformFees)} />
          <StatCard label="Paid Out" value={formatLKR(summary.totalPaidOut)} />
          <StatCard label="Pending Payouts" value={formatLKR(summary.pendingPayoutAmount)} />
          <StatCard label="Transactions" value={String(summary.transactionCount)} />
          <StatCard label="Failed Payments" value={String(summary.failedPayments ?? 0)} />
          <StatCard label="Refund Requests" value={String(summary.refundRequests ?? 0)} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-neutral-900">Top Performing Events</h2>
          <div className="space-y-2">
            {(summary?.topEvents ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                <span className="font-medium text-neutral-900">{event.title}</span>
                <span className="font-semibold text-emerald-700">{formatLKR(event.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-neutral-900">Top Organizers</h2>
          <div className="space-y-2">
            {(summary?.topOrganizers ?? []).map((org) => (
              <div key={org.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                <span className="font-medium text-neutral-900">{org.name}</span>
                <span className="font-semibold text-emerald-700">{formatLKR(org.earnings)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
    <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
  </div>
);
