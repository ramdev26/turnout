import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardList, Search } from 'lucide-react';
import { api } from '../api/client';
import { Order } from '../types';
import { formatLKR } from '../utils/money';
import { formatApiError } from '../utils/apiError';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowCard, FlowPage, FlowStatCard, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { cardMutedStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { Skeleton } from '../components/ui/Feedback';
import { cn } from '../utils/cn';
import { TurnoutSelect } from '../components/ui/TurnoutSelect';

type OrdersResponse = {
  orders: Order[];
  total: number;
  counts: { all: number; pending: number; paid: number; failed: number };
  events: { id: string; title: string; slug: string }[];
};

type StatusFilter = 'all' | 'pending' | 'paid' | 'failed';

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed / Cancelled';
  return status;
}

function statusStyle(status: string): React.CSSProperties {
  if (status === 'paid') {
    return { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' };
  }
  if (status === 'pending') {
    return { background: 'rgba(245, 158, 11, 0.16)', color: '#d97706' };
  }
  if (status === 'failed') {
    return { background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
  }
  return { background: 'rgba(0,0,0,0.06)', color: '#525252' };
}

function paymentMethodLabel(method?: string | null): string {
  switch (method) {
    case 'payhere':
      return 'Card / PayHere';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'free':
      return 'Free';
    case 'complimentary':
      return 'Complimentary';
    case 'vip_invite':
      return 'VIP invite';
    case 'manual_cash':
      return 'Manual · Cash';
    case 'manual_bank':
      return 'Manual · Bank';
    case 'manual_card':
      return 'Manual · Card';
    case 'manual_other':
    case 'manual':
      return 'Manual';
    default:
      return method ? method.replace(/_/g, ' ') : '—';
  }
}

function formatOrderDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const OrganizerOrders: React.FC = () => {
  const ui = APP_FLOW_UI;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const status = (searchParams.get('status') as StatusFilter) || 'all';
  const eventId = searchParams.get('eventId') || '';
  const paymentMethod = searchParams.get('paymentMethod') || 'all';
  const qParam = searchParams.get('q') || '';

  const [q, setQ] = useState(qParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrdersResponse | null>(null);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (q.trim() === qParam.trim()) return;
      setFilter('q', q.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, qParam, setFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', status);
      params.set('limit', '100');
      if (eventId) params.set('eventId', eventId);
      if (paymentMethod && paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (qParam.trim()) params.set('q', qParam.trim());
      const res = await api.get<OrdersResponse>(`/api/organizer/orders?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to load orders'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, eventId, paymentMethod, qParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = data?.counts || { all: 0, pending: 0, paid: 0, failed: 0 };
  const eventOptions = useMemo(
    () => [
      { value: 'all', label: 'All events' },
      ...(data?.events || []).map((ev) => ({ value: ev.id, label: ev.title })),
    ],
    [data?.events]
  );

  const paymentOptions = [
    { value: 'all', label: 'All methods' },
    { value: 'payhere', label: 'Card / PayHere' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'free', label: 'Free' },
    { value: 'complimentary', label: 'Complimentary' },
    { value: 'manual_cash', label: 'Manual · Cash' },
    { value: 'manual_bank', label: 'Manual · Bank' },
    { value: 'manual_card', label: 'Manual · Card' },
    { value: 'manual_other', label: 'Manual · Other' },
    { value: 'vip_invite', label: 'VIP invite' },
  ];

  const statusTabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'paid', label: 'Paid', count: counts.paid },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'failed', label: 'Failed / Cancelled', count: counts.failed },
  ];

  return (
    <OrganizerFlowShell
      title="Orders"
      subtitle="All ticket sales across your events — paid, pending, and cancelled."
      navLinks={organizerMainNav}
    >
      <FlowPage>
        {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FlowStatCard label="All orders" value={counts.all} icon={<ClipboardList className="h-5 w-5" />} />
          <FlowStatCard label="Paid" value={counts.paid} />
          <FlowStatCard label="Pending" value={counts.pending} />
          <FlowStatCard label="Failed / Cancelled" value={counts.failed} />
        </div>

        <FlowCard>
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => {
              const active = status === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter('status', tab.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                    active ? 'shadow-sm' : 'opacity-80 hover:opacity-100'
                  )}
                  style={
                    active
                      ? { background: ui.accentSoft, color: ui.accent, borderColor: ui.borderColor }
                      : { borderColor: ui.borderColor, color: ui.textMuted }
                  }
                >
                  {tab.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_14rem_14rem]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: ui.textMuted }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search order #, buyer name, email, phone…"
                className={cn(fieldClass, 'w-full pl-10')}
                style={fieldStyle}
              />
            </div>
            <TurnoutSelect
              value={eventId || 'all'}
              onChange={(next) => setFilter('eventId', next === 'all' ? '' : next)}
              ariaLabel="Filter by event"
              tone={ui.isDark ? 'dark' : 'light'}
              style={fieldStyle}
              buttonClassName={fieldClass}
              options={eventOptions}
            />
            <TurnoutSelect
              value={paymentMethod || 'all'}
              onChange={(next) => setFilter('paymentMethod', next)}
              ariaLabel="Filter by payment method"
              tone={ui.isDark ? 'dark' : 'light'}
              style={fieldStyle}
              buttonClassName={fieldClass}
              options={paymentOptions}
            />
          </div>
        </FlowCard>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : null}

        {!loading && data && data.orders.length === 0 ? (
          <FlowCard muted>
            <p className="font-semibold" style={{ color: ui.text }}>
              No orders found
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Ticket sales will appear here once attendees checkout on your events.
            </p>
          </FlowCard>
        ) : null}

        {!loading && data && data.orders.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: ui.textMuted }}>
              Showing {data.orders.length} of {data.total} order{data.total === 1 ? '' : 's'}
            </p>
            {data.orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                className="flex w-full items-stretch gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:opacity-95"
                style={cardMutedStyle}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold" style={{ color: ui.text }}>
                      #{order.id}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                      style={statusStyle(order.status)}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <span className="text-xs font-medium" style={{ color: ui.textSubtle }}>
                      {paymentMethodLabel(order.paymentMethod)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold" style={{ color: ui.text }}>
                    {order.buyerName || order.buyerEmail || 'Guest'}
                  </p>
                  <p className="truncate text-sm" style={{ color: ui.textMuted }}>
                    {order.eventTitle || `Event #${order.eventId}`}
                    {order.ticketSummary ? ` · ${order.ticketSummary}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: ui.textSubtle }}>
                    {formatOrderDate(order.createdAt)}
                    {order.buyerEmail ? ` · ${order.buyerEmail}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between py-0.5">
                  <span className="text-base font-bold tabular-nums" style={{ color: ui.text }}>
                    {formatLKR(order.totalAmount)}
                  </span>
                  <ChevronRight className="h-4 w-4" style={{ color: ui.textMuted }} />
                </div>
              </button>
            ))}
          </div>
        ) : null}

      </FlowPage>
    </OrganizerFlowShell>
  );
};
