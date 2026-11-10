import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardList, Loader2, Search, Trash2 } from 'lucide-react';
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

const PAGE_SIZE = 20;

type OrdersResponse = {
  orders: Order[];
  total: number;
  counts: { all: number; pending: number; paid: number; failed: number };
  events: { id: string; title: string; slug: string }[];
  limit?: number;
  offset?: number;
  from?: string | null;
  to?: string | null;
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

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw || '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export const OrganizerOrders: React.FC = () => {
  const ui = APP_FLOW_UI;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const status = (searchParams.get('status') as StatusFilter) || 'all';
  const eventId = searchParams.get('eventId') || '';
  const paymentMethod = searchParams.get('paymentMethod') || 'all';
  const qParam = searchParams.get('q') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const page = parsePage(searchParams.get('page'));

  const [q, setQ] = useState(qParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const setFilters = useCallback(
    (patch: Record<string, string>, options?: { resetPage?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
      });
      if (options?.resetPage !== false) {
        next.delete('page');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      setFilters({ [key]: value });
    },
    [setFilters]
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
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));
      if (eventId) params.set('eventId', eventId);
      if (paymentMethod && paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (qParam.trim()) params.set('q', qParam.trim());
      if (fromParam) params.set('from', fromParam);
      if (toParam) params.set('to', toParam);
      const res = await api.get<OrdersResponse>(`/api/organizer/orders?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to load orders'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, eventId, paymentMethod, qParam, fromParam, toParam, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds({});
  }, [status, eventId, paymentMethod, qParam, fromParam, toParam, page]);

  useEffect(() => {
    const flash = (location.state as { flash?: string } | null)?.flash;
    if (!flash) return;
    setFeedback(flash);
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate]);

  const counts = data?.counts || { all: 0, pending: 0, paid: 0, failed: 0 };
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);

  useEffect(() => {
    if (!data || loading) return;
    if (page > totalPages) {
      setFilters({ page: totalPages > 1 ? String(totalPages) : '' }, { resetPage: false });
    }
  }, [data, loading, page, totalPages, setFilters]);

  const eventOptions = useMemo(
    () => [
      { value: 'all', label: 'All events' },
      ...(data?.events || []).map((ev) => ({ value: ev.id, label: ev.title })),
    ],
    [data?.events]
  );

  const selectedOrderIds = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id]),
    [selectedIds]
  );
  const allVisibleSelected =
    !!data?.orders.length && data.orders.every((order) => selectedIds[order.id]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAllVisible = () => {
    if (!data?.orders.length) return;
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = { ...prev };
        data.orders.forEach((order) => {
          delete next[order.id];
        });
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = { ...prev };
      data.orders.forEach((order) => {
        next[order.id] = true;
      });
      return next;
    });
  };

  const deleteSelectedOrders = async () => {
    if (selectedOrderIds.length < 1) return;
    const ok = window.confirm(
      `Delete ${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? '' : 's'} permanently?\n\n` +
        'Ticket inventory, attendees, and payment records for these orders will be cleared. This cannot be undone.'
    );
    if (!ok) return;

    setBulkDeleting(true);
    setError(null);
    try {
      const res = await api.post<{
        deletedCount: number;
        releasedTickets?: number;
        errors?: { orderId: string; error: string }[];
      }>('/api/organizer/orders/bulk-delete', { orderIds: selectedOrderIds });
      const released = res.releasedTickets ?? 0;
      const failed = res.errors?.length ?? 0;
      setSelectedIds({});
      await load();
      setFeedback(
        failed > 0
          ? `Deleted ${res.deletedCount} order${res.deletedCount === 1 ? '' : 's'}` +
              (released > 0 ? ` · ${released} tickets returned` : '') +
              `. ${failed} could not be deleted.`
          : `Deleted ${res.deletedCount} order${res.deletedCount === 1 ? '' : 's'}` +
              (released > 0 ? ` · ${released} ticket${released === 1 ? '' : 's'} returned to inventory` : '') +
              '.'
      );
    } catch (e: unknown) {
      setError(formatApiError(e, 'Could not delete selected orders'));
    } finally {
      setBulkDeleting(false);
    }
  };

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

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setFilters({ page: clamped <= 1 ? '' : String(clamped) }, { resetPage: false });
  };

  const clearDates = () => {
    setFilters({ from: '', to: '' });
  };

  return (
    <OrganizerFlowShell
      title="Orders"
      subtitle="All ticket sales across your events — paid, pending, and cancelled."
      navLinks={organizerMainNav}
    >
      <FlowPage>
        {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
        {feedback ? <FlowAlert variant="success">{feedback}</FlowAlert> : null}

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

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                From date
              </span>
              <input
                type="date"
                value={fromParam}
                max={toParam || undefined}
                onChange={(e) => setFilter('from', e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                To date
              </span>
              <input
                type="date"
                value={toParam}
                min={fromParam || undefined}
                onChange={(e) => setFilter('to', e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearDates}
                disabled={!fromParam && !toParam}
                className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:opacity-40 sm:w-auto"
                style={{ borderColor: ui.borderColor, color: ui.textMuted }}
              >
                Clear dates
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: ui.textSubtle }}>
            Use one date for a single day, or both for a range. Leave blank to show all dates.
          </p>
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
              Try another date range or clear filters. New ticket sales will appear here after checkout.
            </p>
          </FlowCard>
        ) : null}

        {!loading && data && data.orders.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" style={{ color: ui.textMuted }}>
                Showing {rangeStart}–{rangeEnd} of {total} order{total === 1 ? '' : 's'}
                <span className="opacity-70"> · {PAGE_SIZE} per page</span>
              </p>
              <p className="text-sm tabular-nums" style={{ color: ui.textSubtle }}>
                Page {safePage} of {totalPages}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5" style={cardMutedStyle}>
              <label className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4"
                  style={{ accentColor: ui.accent }}
                />
                Select page
              </label>
              <button
                type="button"
                disabled={selectedOrderIds.length < 1 || bulkDeleting}
                onClick={() => void deleteSelectedOrders()}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold text-rose-600 disabled:opacity-40"
                style={{ borderColor: 'rgba(244,63,94,0.35)' }}
              >
                {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete selected{selectedOrderIds.length > 0 ? ` (${selectedOrderIds.length})` : ''}
              </button>
            </div>

            {data.orders.map((order) => (
              <div
                key={order.id}
                className="flex w-full items-stretch gap-3 rounded-2xl border px-4 py-3.5"
                style={cardMutedStyle}
              >
                <label
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedIds[order.id]}
                    onChange={() => toggleSelect(order.id)}
                    className="h-4 w-4"
                    style={{ accentColor: ui.accent }}
                    aria-label={`Select order ${order.id}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                  className="flex min-w-0 flex-1 items-stretch gap-3 text-left transition hover:opacity-95"
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
              </div>
            ))}

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(safePage - 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ borderColor: ui.borderColor, color: ui.text }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <p className="text-sm tabular-nums" style={{ color: ui.textMuted }}>
                  Page {safePage} / {totalPages}
                </p>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(safePage + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ borderColor: ui.borderColor, color: ui.text }}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
