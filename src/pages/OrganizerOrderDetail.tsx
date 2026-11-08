import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Landmark,
  Loader2,
  Mail,
  Phone,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { Event, Order } from '../types';
import { formatLKR } from '../utils/money';
import { formatApiError } from '../utils/apiError';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowButton, FlowCard, FlowPage, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { accentButtonStyleFor, cardMutedStyleFor } from '../themes/flowUi';

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed / Cancelled';
  return status;
}

function statusStyle(status: string): React.CSSProperties {
  if (status === 'paid') return { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' };
  if (status === 'pending') return { background: 'rgba(245, 158, 11, 0.16)', color: '#d97706' };
  if (status === 'failed') return { background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
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

export const OrganizerOrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const ui = APP_FLOW_UI;
  const cardMutedStyle = cardMutedStyleFor(ui);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  const load = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ order: Order; event?: Event }>(`/api/orders/${orderId}`);
      setOrder(res.order);
      setEvent(res.event || null);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to load order'));
      setOrder(null);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const confirmBankTransfer = async () => {
    if (!orderId) return;
    setActing(true);
    setError(null);
    try {
      await api.post(`/api/orders/${orderId}/confirm-bank-transfer`, {});
      setFeedback('Bank transfer confirmed. Tickets issued.');
      await load();
    } catch (e: unknown) {
      setError(formatApiError(e, 'Could not confirm bank transfer'));
    } finally {
      setActing(false);
    }
  };

  const rejectBankTransfer = async () => {
    if (!orderId) return;
    setActing(true);
    setError(null);
    try {
      await api.post(`/api/orders/${orderId}/reject-bank-transfer`, {});
      setFeedback('Order marked as failed / cancelled.');
      await load();
    } catch (e: unknown) {
      setError(formatApiError(e, 'Could not reject bank transfer'));
    } finally {
      setActing(false);
    }
  };

  const tickets = order?.tickets || [];
  const attendees = order?.attendees || [];
  const isPendingBank =
    order?.status === 'pending' && order?.paymentMethod === 'bank_transfer';

  return (
    <OrganizerFlowShell
      title={order ? `Order #${order.id}` : 'Order'}
      subtitle={event?.title || 'Ticket sale details'}
      navLinks={organizerMainNav}
    >
      <FlowPage>
        <button
          type="button"
          onClick={() => navigate('/dashboard/orders')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: ui.textMuted }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </button>

        {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
        {feedback ? <FlowAlert variant="success">{feedback}</FlowAlert> : null}

        {loading ? (
          <FlowCard>
            <p className="flex items-center gap-2 text-sm" style={{ color: ui.textMuted }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading order…
            </p>
          </FlowCard>
        ) : null}

        {!loading && !order ? (
          <FlowCard muted>
            <p className="font-semibold" style={{ color: ui.text }}>
              Order not found
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              This order may have been removed or you do not have access.
            </p>
          </FlowCard>
        ) : null}

        {!loading && order ? (
          <div className="space-y-5">
            <FlowCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-xl font-bold" style={{ color: ui.text }}>
                      #{order.id}
                    </h2>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={statusStyle(order.status)}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    Placed {formatOrderDate(order.createdAt)} · {paymentMethodLabel(order.paymentMethod)}
                  </p>
                  {event ? (
                    <Link
                      to={`/dashboard/events/${event.id}/settings`}
                      className="mt-2 inline-flex text-sm font-semibold underline-offset-2 hover:underline"
                      style={{ color: ui.accent }}
                    >
                      {event.title}
                    </Link>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                    Total
                  </p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: ui.text }}>
                    {formatLKR(order.totalAmount)}
                  </p>
                  {order.discountAmount && order.discountAmount > 0 ? (
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      Discount {formatLKR(order.discountAmount)}
                      {order.couponCode ? ` · ${order.couponCode}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {isPendingBank ? (
                <div className="mt-5 rounded-2xl border p-4" style={cardMutedStyle}>
                  <div className="flex items-start gap-3">
                    <Landmark className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ui.accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" style={{ color: ui.text }}>
                        Bank transfer awaiting review
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                        Confirm to issue tickets, or reject to mark this order failed / cancelled.
                      </p>
                      {order.bankTransferSlipUrl ? (
                        <a
                          href={toApiUrl(order.bankTransferSlipUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline"
                          style={{ color: ui.accent }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View transfer slip
                        </a>
                      ) : (
                        <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                          No slip uploaded yet.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void confirmBankTransfer()}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-60"
                          style={accentButtonStyleFor(ui)}
                        >
                          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Confirm payment
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void rejectBankTransfer()}
                          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold text-rose-600 disabled:opacity-60"
                          style={{ borderColor: 'rgba(244,63,94,0.35)' }}
                        >
                          <X className="h-4 w-4" />
                          Reject / cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {order.paymentMethod === 'bank_transfer' && order.status === 'paid' && order.bankTransferSlipUrl ? (
                <a
                  href={toApiUrl(order.bankTransferSlipUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline"
                  style={{ color: ui.accent }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View bank transfer slip
                </a>
              ) : null}
            </FlowCard>

            <div className="grid gap-5 lg:grid-cols-2">
              <FlowCard>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Buyer
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-semibold" style={{ color: ui.text }}>
                    <User className="h-4 w-4 shrink-0" style={{ color: ui.textMuted }} />
                    {order.buyerName || '—'}
                  </p>
                  <p className="flex items-center gap-2" style={{ color: ui.textMuted }}>
                    <Mail className="h-4 w-4 shrink-0" />
                    {order.buyerEmail || '—'}
                  </p>
                  <p className="flex items-center gap-2" style={{ color: ui.textMuted }}>
                    <Phone className="h-4 w-4 shrink-0" />
                    {order.buyerPhone || '—'}
                  </p>
                </div>
              </FlowCard>

              <FlowCard>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Tickets
                </h3>
                {tickets.length === 0 ? (
                  <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                    No line items on this order.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {tickets.map((item, idx) => (
                      <li
                        key={`${item.ticketId}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm"
                        style={cardMutedStyle}
                      >
                        <span className="flex min-w-0 items-center gap-2" style={{ color: ui.text }}>
                          <Ticket className="h-4 w-4 shrink-0" style={{ color: ui.accent }} />
                          <span className="truncate font-semibold">
                            {item.name}
                            <span className="font-normal opacity-70"> ×{item.quantity}</span>
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold" style={{ color: ui.text }}>
                          {formatLKR((item.lineTotal ?? item.price * item.quantity) || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </FlowCard>
            </div>

            <FlowCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Attendees / passes
                </h3>
                {event ? (
                  <Link
                    to={`/dashboard/events/${event.id}/checkin`}
                    className="text-sm font-semibold underline-offset-2 hover:underline"
                    style={{ color: ui.accent }}
                  >
                    Open check-in
                  </Link>
                ) : null}
              </div>
              {attendees.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                  {order.status === 'paid'
                    ? 'No attendee passes found for this order.'
                    : 'Passes are issued after the order is paid or confirmed.'}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {attendees.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm"
                      style={cardMutedStyle}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: ui.text }}>
                          {a.fullName}
                        </p>
                        <p className="truncate" style={{ color: ui.textMuted }}>
                          {a.ticketName || 'Ticket'} · {a.email}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                        style={
                          a.checkedInAt
                            ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' }
                            : { background: 'rgba(0,0,0,0.06)', color: '#737373' }
                        }
                      >
                        {a.checkedInAt ? 'Checked in' : 'Not checked in'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </FlowCard>

            <div className="flex flex-wrap gap-2">
              <FlowButton onClick={() => navigate('/dashboard/orders')}>Back to orders</FlowButton>
              {event?.slug ? (
                <a
                  href={`/e/${event.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                  style={{ borderColor: ui.borderColor, color: ui.text }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Public event page
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
