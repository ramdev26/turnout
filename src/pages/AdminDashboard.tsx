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
import { FlowStatCard, FlowCard, FlowAlert, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';
import { Skeleton } from '../components/ui/Feedback';
import { cn } from '../utils/cn';

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? '+100%' : null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}%`;
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

  const signupTrend = useMemo(() => {
    const series = summary?.charts?.signupsByDay ?? [];
    if (series.length < 2) return null;
    const recent = series.slice(-7).reduce((sum, row) => sum + row.signups, 0);
    const prior = series.slice(-14, -7).reduce((sum, row) => sum + row.signups, 0);
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

  if (loading) {
    return (
      <AdminShell title="Platform Dashboard" subtitle="Loading analytics…">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-[360px] rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[360px] rounded-2xl" />
            <Skeleton className="h-[360px] rounded-2xl" />
          </div>
        </div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Platform Dashboard">
        <FlowAlert variant="error">{error}</FlowAlert>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Platform Dashboard"
      subtitle="Live revenue, growth, payouts, and performance analytics across Turnout."
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
            refreshing && 'opacity-60',
          )}
          style={cardMutedStyleFor(ui)}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {summary && (
        <>
          <FlowCard className="overflow-hidden p-0">
            <div
              className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 xl:p-8"
              style={{
                background: `linear-gradient(135deg, ${ui.cardBg} 0%, rgba(192, 255, 114, 0.08) 100%)`,
              }}
            >
              <div className="sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ui.textMuted }}>
                  Gross revenue
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: ui.accent }}>
                  {formatLKR(summary.totalRevenue)}
                </p>
                <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                  Today {formatLKR(summary.todayRevenue ?? 0)}
                  {revenueTrend ? <span style={{ color: ui.accent }}> · {revenueTrend} vs prior week</span> : null}
                </p>
              </div>
              <FlowStatCard
                label="Total users"
                value={summary.totalUsers ?? 0}
                icon={<Users className="h-4 w-4" />}
                accent={signupTrend ? ui.accent : undefined}
              />
              <FlowStatCard
                label="Active events"
                value={summary.activeEvents ?? 0}
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <FlowStatCard
                label="Pending payouts"
                value={formatLKR(summary.pendingPayoutAmount)}
                icon={<Wallet className="h-4 w-4" />}
                accent={summary.pendingPayoutAmount > 0 ? '#fbbf24' : undefined}
              />
            </div>
          </FlowCard>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <FlowStatCard label="Total events" value={summary.totalEvents ?? 0} icon={<CalendarDays className="h-4 w-4" />} />
            <FlowStatCard label="Platform fees" value={formatLKR(summary.totalPlatformFees)} icon={<TrendingUp className="h-4 w-4" />} />
            <FlowStatCard label="Organizer earnings" value={formatLKR(summary.totalOrganizerEarnings)} icon={<Banknote className="h-4 w-4" />} />
            <FlowStatCard label="Paid out" value={formatLKR(summary.totalPaidOut)} />
            <FlowStatCard label="Transactions" value={summary.transactionCount} />
            <FlowStatCard
              label="Failed / refunds"
              value={`${summary.failedPayments ?? 0} / ${summary.refundRequests ?? 0}`}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent={(summary.failedPayments ?? 0) > 0 ? '#f87171' : undefined}
            />
          </div>

          <AdminDashboardCharts summary={summary} />

          <div className="grid gap-4 lg:grid-cols-2">
            <FlowCard>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: ui.text }}>
                Operations snapshot
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Pending payout requests', summary.pendingPayoutCount],
                  ['Refund requests', summary.refundRequests ?? 0],
                  ['Failed payments', summary.failedPayments ?? 0],
                  ['Paid transactions', summary.transactionCount - (summary.failedPayments ?? 0)],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border px-4 py-3"
                    style={cardMutedStyleFor(ui)}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: ui.text }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </FlowCard>

            <FlowCard>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: ui.text }}>
                Quick leaderboard
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                    Top event
                  </p>
                  {(summary.topEvents ?? []).slice(0, 3).map((event, index) => (
                    <div
                      key={event.id}
                      className="mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                      style={cardMutedStyleFor(ui)}
                    >
                      <span style={{ color: ui.textMuted }}>{index + 1}.</span>
                      <span className="flex-1 px-2 font-medium" style={{ color: ui.text }}>
                        {event.title}
                      </span>
                      <span className="font-semibold" style={{ color: ui.accent }}>
                        {formatLKR(event.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                    Top organizer
                  </p>
                  {(summary.topOrganizers ?? []).slice(0, 3).map((org, index) => (
                    <div
                      key={org.id}
                      className="mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                      style={cardMutedStyleFor(ui)}
                    >
                      <span style={{ color: ui.textMuted }}>{index + 1}.</span>
                      <span className="flex-1 px-2 font-medium" style={{ color: ui.text }}>
                        {org.name}
                      </span>
                      <span className="font-semibold" style={{ color: ui.accent }}>
                        {formatLKR(org.earnings)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FlowCard>
          </div>
        </>
      )}
    </AdminShell>
  );
};
