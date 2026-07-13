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
import { APP_FLOW_UI, FlowCard } from '../flow/FlowPrimitives';

const CHART_COLORS = ['#c0ff72', '#86efac', '#4ade80', '#fbbf24', '#f87171', '#a78bfa'];

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
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{ background: ui.cardBg, borderColor: ui.borderColor, color: ui.text }}
    >
      <p className="mb-1 font-semibold" style={{ color: ui.textMuted }}>
        {typeof label === 'string' ? shortDate(label) : label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-medium" style={{ color: entry.color || ui.accent }}>
          {entry.name}: {valueFormatter ? valueFormatter(Number(entry.value ?? 0)) : entry.value}
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ui = APP_FLOW_UI;
  return (
    <FlowCard className={className}>
      <div className="mb-4">
        <h2 className="text-base font-semibold sm:text-lg" style={{ color: ui.text }}>
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="h-[280px] w-full sm:h-[320px]">{children}</div>
    </FlowCard>
  );
}

export function AdminDashboardCharts({ summary }: { summary: AdminSummary }) {
  const ui = APP_FLOW_UI;
  const charts = summary.charts;

  const revenueSplit = useMemo(
    () => [
      { name: 'Platform fees', value: summary.totalPlatformFees, fill: ui.accent },
      { name: 'Organizer earnings', value: summary.totalOrganizerEarnings, fill: '#86efac' },
      { name: 'Paid out', value: summary.totalPaidOut, fill: '#4ade80' },
      { name: 'Pending payout', value: summary.pendingPayoutAmount, fill: '#fbbf24' },
    ],
    [summary, ui.accent],
  );

  const topEventsData = useMemo(
    () =>
      (summary.topEvents ?? []).map((event) => ({
        name: event.title.length > 28 ? `${event.title.slice(0, 28)}…` : event.title,
        revenue: event.revenue,
      })),
    [summary.topEvents],
  );

  const topOrganizersData = useMemo(
    () =>
      (summary.topOrganizers ?? []).map((org) => ({
        name: org.name.length > 24 ? `${org.name.slice(0, 24)}…` : org.name,
        earnings: org.earnings,
      })),
    [summary.topOrganizers],
  );

  const axisStyle = { fill: ui.textMuted, fontSize: 11 };
  const gridStroke = ui.borderColor;

  return (
    <div className="space-y-6">
      <ChartCard
        title="Revenue trend"
        subtitle={`Gross paid volume over the last ${charts?.days ?? 30} days`}
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={charts?.revenueByDay ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ui.accent} stopOpacity={0.35} />
                <stop offset="95%" stopColor={ui.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v) => formatLKR(v)} tick={axisStyle} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => formatLKR(v)} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={ui.accent}
              fill="url(#adminRevenueFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="New signups" subtitle="User registrations per day">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts?.signupsByDay ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="signups" name="Signups" fill={ui.accent} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transactions by status" subtitle="Payment outcomes across the platform">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts?.transactionsByStatus ?? []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={98}
                paddingAngle={3}
              >
                {(charts?.transactionsByStatus ?? []).map((entry, index) => (
                  <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as { status?: string; count?: number; amount?: number };
                  return (
                    <div
                      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
                      style={{ background: ui.cardBg, borderColor: ui.borderColor, color: ui.text }}
                    >
                      <p className="mb-1 font-semibold" style={{ color: ui.textMuted }}>
                        {row?.status}
                      </p>
                      <p className="font-medium" style={{ color: ui.accent }}>
                        Count: {row?.count ?? 0}
                      </p>
                      <p className="font-medium" style={{ color: '#86efac' }}>
                        Volume: {formatLKR(row?.amount ?? 0)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ color: ui.textMuted, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Revenue allocation" subtitle="Where platform money sits today">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueSplit} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatLKR(v)} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={108} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => formatLKR(v)} />} />
              <Bar dataKey="value" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {revenueSplit.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Users by role" subtitle="Account mix on Turnout">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts?.usersByRole ?? []}
                dataKey="count"
                nameKey="role"
                cx="50%"
                cy="50%"
                outerRadius={98}
                paddingAngle={2}
              >
                {(charts?.usersByRole ?? []).map((entry, index) => (
                  <Cell key={entry.role} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ color: ui.textMuted, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily transactions" subtitle="All payment attempts per day">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts?.revenueByDay ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="transactions"
                name="Transactions"
                stroke="#86efac"
                fill="rgba(134, 239, 172, 0.18)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top events" subtitle="Highest grossing events">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topEventsData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatLKR(v)} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={112} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => formatLKR(v)} />} />
              <Bar dataKey="revenue" name="Revenue" fill={ui.accent} radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top organizers" subtitle="Highest net organizer earnings">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topOrganizersData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatLKR(v)} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={112} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => formatLKR(v)} />} />
              <Bar dataKey="earnings" name="Earnings" fill="#86efac" radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
