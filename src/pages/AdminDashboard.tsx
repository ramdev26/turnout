import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import { formatApiError } from '../utils/apiError';
import { AdminSummary } from '../types';
import { formatLKR } from '../utils/money';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminDashboardCharts } from '../components/admin/AdminDashboardCharts';
import { FlowCard, FlowAlert, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { accentButtonStyleFor, cardMutedStyleFor } from '../themes/flowUi';
import { Skeleton } from '../components/ui/Feedback';
import { cn } from '../utils/cn';

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? '+100%' : null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}%`;
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  highlight?: 'warn' | 'accent';
}) {
  const ui = APP_FLOW_UI;
  const hintColor = highlight === 'warn' ? '#fbbf24' : highlight === 'accent' ? ui.accent : ui.textMuted;
  return (
    <div className="rounded-2xl border p-5" style={cardMutedStyleFor(ui)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ui.textMuted }}>
          {label}
        </p>
        {icon ? <span style={{ color: ui.textSubtle }}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: ui.text }}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs font-medium" style={{ color: hintColor }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await api.get<{ summary: AdminSummary }>('/api/admin/summary');
    setSummary(res.summary);
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

  const revenueTrend = useMemo(() => {
    const series = summary?.charts?.revenueByDay ?? [];
    if (series.length < 2) return null;
    const recent = series.slice(-7).reduce((sum, row) => sum + row.revenue, 0);
    const prior = series.slice(-14, -7).reduce((sum, row) => sum + row.revenue, 0);
    return pctChange(recent, prior);
  }, [summary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to refresh dashboard'));
    } finally {
      setRefreshing(false);
    }
  };

  const refreshButton = (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        refreshing && 'opacity-60',
      )}
      style={accentButtonStyleFor(ui)}
    >
      <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );

  if (loading) {
    return (
      <AdminShell title="Platform Dashboard" subtitle="Loading analytics…">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Platform Dashboard" actions={refreshButton}>
        <FlowAlert variant="error">{error}</FlowAlert>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Platform Dashboard"
      subtitle="Revenue, growth, payouts, and performance across Turnout."
      actions={refreshButton}
    >
      {summary && (
        <div className="space-y-8">
          <FlowCard className="overflow-hidden p-0">
            <div
              className="border-b px-6 py-5 sm:px-8"
              style={{ borderColor: ui.borderColor, background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ui.textMuted }}>
                At a glance
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: ui.text }}>
                {formatLKR(summary.totalRevenue)}
              </p>
              <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                Total gross revenue
                <span className="mx-2 opacity-40">·</span>
                Today {formatLKR(summary.todayRevenue ?? 0)}
                {revenueTrend ? (
                  <>
                    <span className="mx-2 opacity-40">·</span>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: ui.accentSoft, color: ui.accentOn }}
                    >
                      {revenueTrend} vs last week
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 sm:p-8">
              <KpiCard
                label="Users"
                value={summary.totalUsers ?? 0}
                icon={<Users className="h-4 w-4" />}
              />
              <KpiCard
                label="Active events"
                value={summary.activeEvents ?? 0}
                hint={`${summary.totalEvents ?? 0} total events`}
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <KpiCard
                label="Pending payouts"
                value={formatLKR(summary.pendingPayoutAmount)}
                hint={summary.pendingPayoutCount > 0 ? `${summary.pendingPayoutCount} open requests` : 'No open requests'}
                icon={<Wallet className="h-4 w-4" />}
                highlight={summary.pendingPayoutAmount > 0 ? 'warn' : undefined}
              />
              <KpiCard
                label="Platform fees"
                value={formatLKR(summary.totalPlatformFees)}
                hint={`${summary.transactionCount} transactions`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>
          </FlowCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Organizer earnings', value: formatLKR(summary.totalOrganizerEarnings), icon: <Banknote className="h-3.5 w-3.5" /> },
              { label: 'Paid out', value: formatLKR(summary.totalPaidOut), icon: <Wallet className="h-3.5 w-3.5" /> },
              { label: 'Failed payments', value: summary.failedPayments ?? 0, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
              { label: 'Refund requests', value: summary.refundRequests ?? 0, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={cardMutedStyleFor(ui)}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: ui.text }}>
                    {item.value}
                  </p>
                </div>
                <span style={{ color: ui.textSubtle }}>{item.icon}</span>
              </div>
            ))}
          </div>

          <AdminDashboardCharts summary={summary} />
        </div>
      )}
    </AdminShell>
  );
};
