import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Eye,
  Globe2,
  Megaphone,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import {
  APP_FLOW_UI,
  FlowAlert,
  FlowButton,
  FlowCard,
  FlowPage,
  FlowStatCard,
} from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { cardMutedStyleFor, cardStyleFor } from '../themes/flowUi';

type VisitDay = { date: string; visits: number; uniqueVisitors: number };
type SourceRow = { source: string; visits: number; uniqueVisitors: number };
type CampaignRow = { campaign: string; visits: number; uniqueVisitors: number };
type RecentVisit = {
  id: string;
  visitorKey: string;
  source: string;
  referrer: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  path: string | null;
  visitedAt: string;
};

type EventAnalyticsPayload = {
  eventId: string;
  eventTitle: string;
  days: number;
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    visitsToday: number;
    topSource: string | null;
  };
  visitsByDay: VisitDay[];
  sources: SourceRow[];
  campaigns: CampaignRow[];
  recentVisits: RecentVisit[];
  sales: {
    orders: number;
    ticketsSold: number;
    conversionRate: number;
  };
};

const CHART = {
  visits: '#34d399',
  unique: '#60a5fa',
  source: '#c0ff72',
} as const;

const SOURCE_COLORS = ['#34d399', '#60a5fa', '#c0ff72', '#fbbf24', '#f87171', '#a78bfa', '#93b5b7'];

function shortDate(value: string) {
  try {
    return format(parseISO(value), 'MMM d');
  } catch {
    return value;
  }
}

function formatVisitedAt(value: string) {
  try {
    const d = value.includes('T') ? parseISO(value) : new Date(value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return value;
    return format(d, 'MMM d, HH:mm');
  } catch {
    return value;
  }
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(rate >= 0.1 ? 1 : 2)}%`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
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
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: entry.color || CHART.visits }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export const EventAnalytics: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<EventAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!eventId) return;
      const background = opts?.background ?? false;
      if (background) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.get<EventAnalyticsPayload>(
          `/api/events/${eventId}/analytics?days=${days}`
        );
        setData(res);
      } catch (e) {
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message || '')
            : '';
        setError(msg || 'Could not load analytics for this event.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, days]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const maxSourceVisits = Math.max(1, ...(data?.sources.map((s) => s.visits) || [1]));

  return (
    <OrganizerFlowShell
      title="Analytics"
      subtitle={data?.eventTitle || 'Visitor insights for this event'}
      backTo="/dashboard"
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                style={
                  days === d
                    ? { background: ui.accent, color: ui.accentOn }
                    : { background: ui.pillBg, color: ui.textMuted }
                }
              >
                {d}d
              </button>
            ))}
          </div>
          <FlowButton
            type="button"
            variant="secondary"
            onClick={() => void load({ background: true })}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </FlowButton>
        </div>

        {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}

        {loading && !data ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--primary)]" />
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FlowStatCard label="Page visits" value={data.summary.totalVisits} icon={<Eye className="h-4 w-4" />} />
              <FlowStatCard
                label="Unique visitors"
                value={data.summary.uniqueVisitors}
                icon={<Users className="h-4 w-4" />}
              />
              <FlowStatCard
                label="Visits today"
                value={data.summary.visitsToday}
                icon={<Globe2 className="h-4 w-4" />}
              />
              <FlowStatCard
                label="Visit → order"
                value={pct(data.sales.conversionRate)}
                icon={<ShoppingBag className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <FlowCard className="lg:col-span-2">
                <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                  Visitors over time
                </h2>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Daily page views and unique visitors for the last {data.days} days.
                </p>
                <div className="mt-4 h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.visitsByDay}>
                      <defs>
                        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.visits} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART.visits} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={ui.borderColor} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        tick={{ fill: ui.textMuted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: ui.textMuted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="visits"
                        name="Visits"
                        stroke={CHART.visits}
                        fill="url(#visitsFill)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="uniqueVisitors"
                        name="Unique"
                        stroke={CHART.unique}
                        fill="transparent"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </FlowCard>

              <FlowCard>
                <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                  Top sources
                </h2>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Where visitors came from (UTM source or referrer).
                </p>
                {data.sources.length === 0 ? (
                  <p className="mt-8 text-sm" style={{ color: ui.textSubtle }}>
                    No visits yet. Share your event link to start collecting sources.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {data.sources.map((row) => (
                      <li key={row.source}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium" style={{ color: ui.text }}>
                            {row.source}
                          </span>
                          <span className="tabular-nums" style={{ color: ui.textMuted }}>
                            {row.visits}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: ui.pillBg }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, (row.visits / maxSourceVisits) * 100)}%`,
                              background: CHART.source,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {data.summary.topSource ? (
                  <p className="mt-4 text-xs" style={{ color: ui.textSubtle }}>
                    Leading source: <span style={{ color: ui.text }}>{data.summary.topSource}</span>
                  </p>
                ) : null}
              </FlowCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FlowCard>
                <div className="mb-4 flex items-center gap-2">
                  <Megaphone className="h-4 w-4" style={{ color: ui.textMuted }} />
                  <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                    Campaigns
                  </h2>
                </div>
                {data.campaigns.length === 0 ? (
                  <p className="text-sm" style={{ color: ui.textSubtle }}>
                    Add <code className="text-xs">utm_campaign</code> to your share links to track campaigns.
                  </p>
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.campaigns} layout="vertical" margin={{ left: 8, right: 12 }}>
                        <CartesianGrid stroke={ui.borderColor} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fill: ui.textMuted, fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="campaign"
                          width={100}
                          tick={{ fill: ui.textMuted, fontSize: 11 }}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="visits" name="Visits" radius={[0, 6, 6, 0]}>
                          {data.campaigns.map((_, i) => (
                            <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </FlowCard>

              <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardMutedStyle}>
                <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                  Sales snapshot
                </h2>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Orders and tickets sold for this event (all time).
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                      Paid orders
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums">{data.sales.orders}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                      Tickets sold
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums">{data.sales.ticketsSold}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm" style={{ color: ui.textSubtle }}>
                  Tip: share links like{' '}
                  <code className="text-xs">?utm_source=instagram&utm_campaign=launch</code> to attribute
                  traffic.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardStyle}>
              <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                Recent visitors
              </h2>
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                Latest landing page views with source details.
              </p>
              {data.recentVisits.length === 0 ? (
                <p className="mt-6 text-sm" style={{ color: ui.textSubtle }}>
                  No visitor activity recorded yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr style={{ color: ui.textMuted }}>
                        <th className="pb-2 pr-3 font-semibold">When</th>
                        <th className="pb-2 pr-3 font-semibold">Source</th>
                        <th className="pb-2 pr-3 font-semibold">Campaign</th>
                        <th className="pb-2 pr-3 font-semibold">Medium</th>
                        <th className="pb-2 font-semibold">Referrer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentVisits.map((v) => (
                        <tr key={v.id} className="border-t" style={{ borderColor: ui.borderColor }}>
                          <td className="py-2.5 pr-3 tabular-nums" style={{ color: ui.textMuted }}>
                            {formatVisitedAt(v.visitedAt)}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{v.source}</td>
                          <td className="py-2.5 pr-3" style={{ color: ui.textMuted }}>
                            {v.utmCampaign || '—'}
                          </td>
                          <td className="py-2.5 pr-3" style={{ color: ui.textMuted }}>
                            {v.utmMedium || '—'}
                          </td>
                          <td className="max-w-[220px] truncate py-2.5" style={{ color: ui.textSubtle }}>
                            {v.referrerHost || v.referrer || 'Direct'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
