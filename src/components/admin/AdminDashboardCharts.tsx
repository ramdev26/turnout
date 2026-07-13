import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { AdminSummary } from '../../types';
import { formatLKR } from '../../utils/money';
import { formatLKRCompact } from '../../utils/chartFormat';
import { APP_FLOW_UI, FlowCard } from '../flow/FlowPrimitives';
import { cardMutedStyleFor } from '../../themes/flowUi';

/** Semantic palette — each meaning maps to one color everywhere. */
const CHART = {
  revenue: '#c0ff72',
  success: '#34d399',
  pending: '#fbbf24',
  danger: '#f87171',
  info: '#60a5fa',
  muted: '#93b5b7',
} as const;

const STATUS_COLORS: Record<string, string> = {
  Paid: CHART.success,
  Pending: CHART.pending,
  Failed: CHART.danger,
};

const ROLE_COLORS: Record<string, string> = {
  Organizers: CHART.revenue,
  Attendees: CHART.info,
  'Super Admins': CHART.muted,
};

function shortDate(value: string) {
  try {
    return format(parseISO(value), 'MMM d');
  } catch {
    return value;
  }
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  valueFormatter?: (value: number) => string;
}) {
  const ui = APP_FLOW_UI;
  if (!active || !payload?.length) return null;
  return (
    <div
      className="pointer-events-none z-50 rounded-xl border px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: 'rgba(5, 46, 48, 0.96)', borderColor: ui.borderColor, color: ui.text }}
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
        {typeof label === 'string' ? shortDate(label) : label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-semibold tabular-nums" style={{ color: ui.text }}>
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: entry.color || CHART.revenue }} />
          {entry.name}: {valueFormatter ? valueFormatter(Number(entry.value ?? 0)) : entry.value}
        </p>
      ))}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const ui = APP_FLOW_UI;
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: ui.textMuted }}>
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm" style={{ color: ui.textSubtle }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 300,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  const ui = APP_FLOW_UI;
  return (
    <FlowCard>
      <h3 className="text-base font-semibold" style={{ color: ui.text }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
          {subtitle}
        </p>
      ) : null}
      <div className="mt-4 w-full" style={{ height }}>
        {children}
      </div>
    </FlowCard>
  );
}

function RankedList({
  title,
  subtitle,
  rows,
  formatValue,
  barColor,
}: {
  title: string;
  subtitle?: string;
  rows: { id: string; label: string; value: number }[];
  formatValue: (n: number) => string;
  barColor: string;
}) {
  const ui = APP_FLOW_UI;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <FlowCard>
      <h3 className="text-base font-semibold" style={{ color: ui.text }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
          {subtitle}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: ui.textMuted }}>
            No data yet.
          </p>
        ) : (
          rows.map((row, index) => {
            const pct = Math.max(4, (row.value / max) * 100);
            return (
              <div key={row.id} className="rounded-xl border px-3 py-3" style={cardMutedStyleFor(ui)}>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: ui.accentSoft, color: ui.accentOn }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug" style={{ color: ui.text }} title={row.label}>
                        {row.label}
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: ui.text }}>
                        {formatValue(row.value)}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: barColor }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </FlowCard>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  const ui = APP_FLOW_UI;
  const valueColor = tone === 'warn' ? CHART.pending : tone === 'ok' ? CHART.success : ui.text;
  return (
    <div className="rounded-xl border px-4 py-3" style={cardMutedStyleFor(ui)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

export function AdminDashboardCharts({ summary }: { summary: AdminSummary }) {
  const ui = APP_FLOW_UI;
  const charts = summary.charts;

  const topEvents = useMemo(
    () =>
      (summary.topEvents ?? []).map((event) => ({
        id: event.id,
        label: event.title,
        value: event.revenue,
      })),
    [summary.topEvents],
  );

  const topOrganizers = useMemo(
    () =>
      (summary.topOrganizers ?? []).map((org) => ({
        id: org.id,
        label: org.name,
        value: org.earnings,
      })),
    [summary.topOrganizers],
  );

  const axisStyle = { fill: ui.textMuted, fontSize: 11 };
  const gridStroke = 'rgba(147, 181, 183, 0.18)';

  const legendStyle = { color: ui.textMuted, fontSize: 12, paddingTop: 8 };

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading title="Revenue" subtitle={`Paid volume over the last ${charts?.days ?? 30} days`} />
        <ChartCard title="Gross revenue trend" subtitle="Hover a point for the exact day total" height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts?.revenueByDay ?? []} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.revenue} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART.revenue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis tickFormatter={formatLKRCompact} tick={axisStyle} axisLine={false} tickLine={false} width={64} />
              <Tooltip
                cursor={{ stroke: CHART.revenue, strokeWidth: 1, strokeDasharray: '4 4' }}
                wrapperStyle={{ zIndex: 40, outline: 'none' }}
                content={<ChartTooltip valueFormatter={(v) => formatLKR(v)} />}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={CHART.revenue}
                fill="url(#adminRevenueFill)"
                strokeWidth={2.5}
                activeDot={{ r: 5, fill: CHART.revenue, stroke: ui.pageBg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section>
        <SectionHeading title="Growth & payments" subtitle="Signups and transaction outcomes" />
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="New signups" subtitle="Daily registrations" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.signupsByDay ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: 'rgba(192, 255, 114, 0.08)' }}
                  wrapperStyle={{ zIndex: 40, outline: 'none' }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="signups" name="Signups" fill={CHART.info} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Transaction status" subtitle="Paid, pending, and failed" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.transactionsByStatus ?? []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="46%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(charts?.transactionsByStatus ?? []).map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? CHART.muted} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 40, outline: 'none' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as { status?: string; count?: number; amount?: number };
                    return (
                      <div
                        className="pointer-events-none z-50 rounded-xl border px-3 py-2.5 text-xs shadow-2xl"
                        style={{ background: 'rgba(5, 46, 48, 0.96)', borderColor: ui.borderColor, color: ui.text }}
                      >
                        <p className="mb-1 font-semibold" style={{ color: ui.text }}>
                          {row?.status}
                        </p>
                        <p className="tabular-nums" style={{ color: ui.textMuted }}>
                          {row?.count ?? 0} transactions · {formatLKR(row?.amount ?? 0)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Platform balance" subtitle="Fees, earnings, and payout pipeline" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Platform fees" value={formatLKR(summary.totalPlatformFees)} />
          <MetricTile label="Organizer earnings" value={formatLKR(summary.totalOrganizerEarnings)} tone="ok" />
          <MetricTile label="Paid out" value={formatLKR(summary.totalPaidOut)} />
          <MetricTile
            label="Pending payouts"
            value={formatLKR(summary.pendingPayoutAmount)}
            tone={summary.pendingPayoutAmount > 0 ? 'warn' : undefined}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Users by role" subtitle="Account distribution" height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.usersByRole ?? []}
                  dataKey="count"
                  nameKey="role"
                  cx="50%"
                  cy="46%"
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(charts?.usersByRole ?? []).map((entry) => (
                    <Cell key={entry.role} fill={ROLE_COLORS[entry.role] ?? CHART.muted} />
                  ))}
                </Pie>
                <Tooltip wrapperStyle={{ zIndex: 40, outline: 'none' }} content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <FlowCard>
            <h3 className="text-base font-semibold" style={{ color: ui.text }}>
              Operations
            </h3>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Items that may need admin attention
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Pending payout requests" value={String(summary.pendingPayoutCount)} tone={summary.pendingPayoutCount > 0 ? 'warn' : undefined} />
              <MetricTile label="Refund requests" value={String(summary.refundRequests ?? 0)} tone={(summary.refundRequests ?? 0) > 0 ? 'warn' : undefined} />
              <MetricTile label="Failed payments" value={String(summary.failedPayments ?? 0)} tone={(summary.failedPayments ?? 0) > 0 ? 'warn' : undefined} />
              <MetricTile label="Total transactions" value={String(summary.transactionCount)} />
            </div>
          </FlowCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Top performers" subtitle="Full names with share of leader revenue" />
        <div className="grid gap-4 xl:grid-cols-2">
          <RankedList
            title="Top events"
            subtitle="By gross ticket revenue"
            rows={topEvents}
            formatValue={formatLKR}
            barColor={CHART.revenue}
          />
          <RankedList
            title="Top organizers"
            subtitle="By net organizer earnings"
            rows={topOrganizers}
            formatValue={formatLKR}
            barColor={CHART.success}
          />
        </div>
      </section>
    </div>
  );
}
