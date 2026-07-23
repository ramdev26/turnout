import React, { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Landmark, Loader2, RefreshCw, X } from 'lucide-react';
import { api, toApiUrl } from '../../api/client';
import { Order } from '../../types';
import { formatApiError } from '../../utils/apiError';
import { formatLKRWhole } from '../../utils/money';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor } from '../../themes/flowUi';
import { FlowAlert } from '../flow/FlowPrimitives';

type Props = {
  eventId: string;
  ui: CreateThemeUI;
  onFeedback?: (message: string) => void;
  onError?: (message: string) => void;
  onPendingCountChange?: (count: number) => void;
};

export function BankTransferOrdersPanel({ eventId, ui, onFeedback, onError, onPendingCountChange }: Props) {
  const cardMutedStyle = cardMutedStyleFor(ui);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ orders: Order[] }>(`/api/events/${eventId}/bank-transfer-orders?status=pending`);
    const next = res.orders || [];
    setOrders(next);
    onPendingCountChange?.(next.length);
  }, [eventId, onPendingCountChange]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e: unknown) {
        onError?.(formatApiError(e, 'Failed to load bank transfer orders'));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, onError]);

  const confirmOrder = async (orderId: string) => {
    setActingId(orderId);
    try {
      await api.post(`/api/orders/${orderId}/confirm-bank-transfer`, {});
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        onPendingCountChange?.(next.length);
        return next;
      });
      onFeedback?.('Bank transfer confirmed. Tickets issued.');
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Could not confirm bank transfer'));
    } finally {
      setActingId(null);
    }
  };

  const rejectOrder = async (orderId: string) => {
    setActingId(orderId);
    try {
      await api.post(`/api/orders/${orderId}/reject-bank-transfer`, {});
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        onPendingCountChange?.(next.length);
        return next;
      });
      onFeedback?.('Bank transfer order rejected.');
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Could not reject bank transfer'));
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: ui.textMuted }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading transfer orders…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: ui.textMuted }}>
          Review slips and confirm payment before tickets are issued.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
          style={{ borderColor: ui.borderColor, color: ui.text }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <FlowAlert variant="info">No pending bank transfer orders right now.</FlowAlert>
      ) : (
        orders.map((order) => {
          const slipUrl = order.bankTransferSlipUrl
            ? order.bankTransferSlipUrl.startsWith('http')
              ? order.bankTransferSlipUrl
              : toApiUrl(order.bankTransferSlipUrl)
            : null;
          const busy = actingId === order.id;
          return (
            <div key={order.id} className="rounded-xl border p-4" style={cardMutedStyle}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: ui.text }}>
                    {order.buyerName || 'Buyer'} · Order #{order.id}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                    {order.buyerEmail}
                    {order.buyerPhone ? ` · ${order.buyerPhone}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: ui.text }}>
                    {formatLKRWhole(order.totalAmount)}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    {order.tickets?.map((t) => `${t.name} × ${t.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {slipUrl ? (
                    <a
                      href={slipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: ui.borderColor, color: ui.text }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View slip
                    </a>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: ui.textMuted }}>
                      Waiting for slip
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy || !slipUrl}
                    onClick={() => void confirmOrder(order.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={accentButtonStyleFor(ui)}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void rejectOrder(order.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function BankTransferSectionIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <Landmark className={className} style={style} />;
}
