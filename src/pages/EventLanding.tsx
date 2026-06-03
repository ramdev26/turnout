import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Ticket, OrderItem, AttendeeProfile } from '../types';
import { api } from '../api/client';
import { getLandingTemplateForEvent } from '../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../themes/eventThemes';
import { loadLandingFont } from '../themes/landingFonts';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/useAuthStore';
import { formatLKR } from '../utils/money';
import { ticketRemaining } from '../components/landing/LandingShared';
import {
  preloadPayHereScript,
  startPayHereCheckout,
  type PayHereInitiateResponse,
} from '../lib/payhereCheckout';
import { formatApiError } from '../utils/apiError';
import { Users } from 'lucide-react';

type TicketHolderInput = {
  key: string;
  ticketId: string;
  ticketName: string;
  label: string;
  fullName: string;
  email: string;
  phone: string;
};

function buildTicketHolders(items: OrderItem[]): TicketHolderInput[] {
  return items.flatMap((it) =>
    Array.from({ length: it.quantity }, (_, i) => ({
      key: `${it.ticketId}-${i}`,
      ticketId: it.ticketId,
      ticketName: it.name,
      label:
        it.quantity > 1
          ? `${it.name} · Ticket ${i + 1} of ${it.quantity}`
          : it.name,
      fullName: '',
      email: '',
      phone: '',
    }))
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const EventLanding: React.FC = () => {
  const { eventId, slug } = useParams<{ eventId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [prefillReady, setPrefillReady] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payherePopupOpen, setPayherePopupOpen] = useState(false);
  const { user } = useAuthStore();

  const { register, handleSubmit, reset, watch } = useForm<{
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    attendeeName: string;
    attendeeEmail: string;
    attendeePhone: string;
  }>({
    defaultValues: {
      buyerName: '',
      buyerEmail: '',
      buyerPhone: '',
      attendeeName: '',
      attendeeEmail: '',
      attendeePhone: '',
    },
  });
  const [buyingForSomeoneElse, setBuyingForSomeoneElse] = useState(false);
  const [assignEachTicket, setAssignEachTicket] = useState(false);
  const [ticketHolders, setTicketHolders] = useState<TicketHolderInput[]>([]);
  const buyerName = watch('buyerName');
  const buyerEmail = watch('buyerEmail');
  const buyerPhone = watch('buyerPhone');

  const orderItems = useMemo<OrderItem[]>(
    () =>
      tickets
        .filter((t) => (selectedTickets[t.id] || 0) > 0)
        .map((t) => ({
          ticketId: t.id,
          name: t.name,
          quantity: selectedTickets[t.id],
          price: t.price,
        })),
    [selectedTickets, tickets]
  );

  const totalTicketQuantity = useMemo(
    () => orderItems.reduce((sum, it) => sum + it.quantity, 0),
    [orderItems]
  );

  const canAssignEachTicket = totalTicketQuantity > 1;

  useEffect(() => {
    if (!canAssignEachTicket) setAssignEachTicket(false);
  }, [canAssignEachTicket]);

  useEffect(() => {
    if (!checkoutOpen) {
      setAssignEachTicket(false);
      setBuyingForSomeoneElse(false);
    }
  }, [checkoutOpen]);

  useEffect(() => {
    if (!checkoutOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [checkoutOpen]);

  useEffect(() => {
    if (!checkoutOpen || !assignEachTicket) return;
    setTicketHolders((prev) => {
      const next = buildTicketHolders(orderItems);
      const prevByKey = Object.fromEntries(prev.map((row) => [row.key, row]));
      return next.map((row) => ({
        ...row,
        fullName: prevByKey[row.key]?.fullName ?? row.fullName,
        email: prevByKey[row.key]?.email ?? row.email,
        phone: prevByKey[row.key]?.phone ?? row.phone,
      }));
    });
  }, [checkoutOpen, orderItems, assignEachTicket]);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId && !slug) return;
      try {
        const eventRes = eventId
          ? await api.get<{ event: Event }>(`/api/events/${eventId}`)
          : await api.get<{ event: Event }>(`/api/events/slug/${slug}`);
        const ticketRes = await api.get<{ tickets: Ticket[] }>(`/api/events/${eventRes.event.id}/tickets`);
        setEvent(eventRes.event);
        setTickets(ticketRes.tickets);
      } catch (error) {
        console.error('Error fetching event:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchEventData();
  }, [eventId, slug]);

  useEffect(() => {
    if (!event) return;
    document.title = `${event.title} | Turnout`;
    loadLandingFont(normalizeLandingCustomization(event.customization).fontFamily);
  }, [event]);

  useEffect(() => {
    const prefillCheckout = async () => {
      if (!user || user.role !== 'attendee') {
        setPrefillReady(true);
        return;
      }
      try {
        const res = await api.get<{ profile: AttendeeProfile }>('/api/me/profile');
        reset({
          buyerName: res.profile.displayName || user.displayName,
          buyerEmail: res.profile.email || user.email,
          buyerPhone: res.profile.phone || '',
        });
      } catch {
        reset({
          buyerName: user.displayName || '',
          buyerEmail: user.email || '',
          buyerPhone: '',
        });
      } finally {
        setPrefillReady(true);
      }
    };
    void prefillCheckout();
  }, [reset, user]);

  const handleTicketChange = (ticketId: string, quantity: number) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    const max = ticket ? ticketRemaining(ticket) : 0;
    setSelectedTickets((prev) => ({
      ...prev,
      [ticketId]: Math.max(0, Math.min(quantity, max)),
    }));
  };

  const totalAmount = tickets.reduce((sum, ticket) => sum + ticket.price * (selectedTickets[ticket.id] || 0), 0);

  const hasSelectedTickets = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);

  const orderLines = useMemo(
    () =>
      tickets
        .filter((t) => (selectedTickets[t.id] || 0) > 0)
        .map((t) => ({ name: t.name, qty: selectedTickets[t.id], total: t.price * selectedTickets[t.id] })),
    [selectedTickets, tickets]
  );

  const handlePurchase = () => {
    if (!event || !hasSelectedTickets) return;
    setCheckoutOpen(true);
    setPayError(null);
    if (totalAmount > 0) {
      void preloadPayHereScript(true);
    }
  };

  const waitForPaidOrder = async (orderId: string, accessToken?: string) => {
    if (!accessToken) {
      throw new Error('Checkout session expired. Close this window and try checkout again.');
    }
    const tokenQs = `?token=${encodeURIComponent(accessToken)}`;
    let lastHint: string | null = null;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const res = await api.get<{ order: { status: string } }>(`/api/payhere/status/${orderId}${tokenQs}`);
        if (res.order.status === 'paid') return;
        if (res.order.status === 'failed') {
          throw new Error('Payment failed. Please try again.');
        }
        lastHint = 'Payment received — confirming your tickets…';
      } catch (e: unknown) {
        const err = e as { error?: string; message?: string };
        if (err?.error === 'forbidden' || err?.error === 'missing_token') {
          throw new Error(formatApiError(e, 'Could not verify this order. Close checkout and try again.'));
        }
        lastHint = formatApiError(e, 'Waiting for payment confirmation…');
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    throw new Error(
      lastHint ||
        'Payment is still confirming. Check your email shortly, or open the confirmation link from PayHere.'
    );
  };

  const submitCheckout = async (values: {
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    attendeeName: string;
    attendeeEmail: string;
    attendeePhone: string;
  }) => {
    if (!event || !hasSelectedTickets) return;
    setIsPurchasing(true);
    setPayError(null);
    try {
      let attendees: { ticketId: string; fullName: string; email: string; phone: string }[];

      if (assignEachTicket && canAssignEachTicket) {
        for (const row of ticketHolders) {
          if (!row.fullName.trim()) {
            setPayError(`Enter a full name for ${row.label}.`);
            setIsPurchasing(false);
            return;
          }
          if (!isValidEmail(row.email)) {
            setPayError(`Enter a valid email for ${row.label}.`);
            setIsPurchasing(false);
            return;
          }
        }
        attendees = ticketHolders.map((row) => ({
          ticketId: row.ticketId,
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          phone: row.phone.trim(),
        }));
      } else if (buyingForSomeoneElse) {
        if (!values.attendeeName.trim() || !isValidEmail(values.attendeeEmail)) {
          setPayError('Enter the attendee name and a valid email.');
          setIsPurchasing(false);
          return;
        }
        attendees = orderItems.flatMap((it) =>
          Array.from({ length: it.quantity }).map(() => ({
            ticketId: it.ticketId,
            fullName: values.attendeeName.trim(),
            email: values.attendeeEmail.trim().toLowerCase(),
            phone: values.attendeePhone.trim(),
          }))
        );
      } else {
        attendees = orderItems.flatMap((it) =>
          Array.from({ length: it.quantity }).map(() => ({
            ticketId: it.ticketId,
            fullName: values.buyerName.trim() || 'Attendee',
            email: values.buyerEmail.trim().toLowerCase(),
            phone: values.buyerPhone.trim(),
          }))
        );
      }

      if (totalAmount <= 0) {
        const res = await api.post<{ orderId: string; accessToken?: string }>('/api/orders', {
          eventId: event.id,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerPhone: values.buyerPhone,
          tickets: orderItems,
          attendees,
        });
        setCheckoutOpen(false);
        const tokenQs = res.accessToken ? `?token=${encodeURIComponent(res.accessToken)}` : '';
        navigate(`/orders/${res.orderId}/success${tokenQs}`);
      } else {
        const res = await api.post<PayHereInitiateResponse>('/api/payhere/initiate', {
          eventId: event.id,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerPhone: values.buyerPhone,
          tickets: orderItems,
          attendees,
        });

        await preloadPayHereScript(res.sandbox !== false);
        setPayError(null);
        setPayherePopupOpen(true);

        await startPayHereCheckout(res, {
          onCompleted: async (orderId) => {
            setPayherePopupOpen(false);
            const resolvedId = orderId || res.orderId;
            try {
              await waitForPaidOrder(resolvedId, res.accessToken);
              setCheckoutOpen(false);
              const tokenQs = res.accessToken ? `?token=${encodeURIComponent(res.accessToken)}` : '';
              navigate(`/orders/${res.orderId}/success${tokenQs}`);
            } catch (confirmErr: unknown) {
              const returnUrl =
                typeof res.fields?.return_url === 'string'
                  ? res.fields.return_url
                  : typeof res.sdkPayment?.return_url === 'string'
                    ? (res.sdkPayment.return_url as string)
                    : '';
              if (returnUrl && res.accessToken) {
                window.location.assign(returnUrl);
                return;
              }
              throw confirmErr;
            }
          },
          onDismissed: () => {
            setPayherePopupOpen(false);
            setPayError('Payment cancelled. You can try again when ready.');
          },
          onError: (message) => {
            setPayherePopupOpen(false);
            setPayError(message);
          },
        });
      }
    } catch (error: unknown) {
      setPayError(formatApiError(error, 'Could not complete checkout. Please try again.'));
    } finally {
      setIsPurchasing(false);
    }
  };

  const themeVars = event ? landingCssVars(event.customization) : landingCssVars(undefined);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ ...themeVars, background: 'var(--landing-page-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-11 w-11 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--landing-text-muted)' }}>
            Loading event…
          </p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ ...themeVars, background: 'var(--landing-page-bg)' }}>
        <div
          className="w-full max-w-md rounded-3xl border p-8 text-center"
          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface)', color: 'var(--landing-text)' }}
        >
          <h2 className="text-2xl font-semibold tracking-tight">Event not found</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
            This event may have been removed or the link is incorrect.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (event.status !== 'published') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ ...landingCssVars(event.customization), background: 'var(--landing-page-bg)' }}>
        <div
          className="w-full max-w-md rounded-3xl border p-8 text-center"
          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface)', color: 'var(--landing-text)' }}
        >
          <h2 className="text-2xl font-semibold tracking-tight">{event.title}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
            This event is not published yet. Check back when tickets go live.
          </p>
        </div>
      </div>
    );
  }

  const template = getLandingTemplateForEvent(event);

  return (
    <div style={landingCssVars(event.customization)} className="min-h-dvh overflow-x-hidden transition-[background] duration-700">
      {template.render({
        event,
        tickets,
        selectedTickets,
        onTicketChange: handleTicketChange,
        totalAmount,
        onCheckout: handlePurchase,
        isPurchasing,
      })}

      {hasSelectedTickets && !checkoutOpen && (
        <div
          className="landing-glass fixed inset-x-0 bottom-0 z-[60] border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
          style={{ borderColor: 'var(--landing-border)' }}
        >
          <button
            type="button"
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="landing-btn-primary flex w-full items-center justify-center rounded-2xl py-3.5 text-base font-bold text-white disabled:opacity-50"
          >
            {isPurchasing ? 'Processing…' : totalAmount <= 0 ? 'Complete registration' : `Pay ${formatLKR(totalAmount)}`}
          </button>
        </div>
      )}

      {payherePopupOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl"
            style={{
              borderColor: 'var(--landing-border)',
              background: 'var(--landing-surface)',
              color: 'var(--landing-text)',
            }}
          >
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
            />
            <p className="mt-4 text-sm font-semibold">Complete your payment</p>
            <p className="mt-2 text-xs" style={{ color: 'var(--landing-text-muted)' }}>
              Use the secure payment window that opened. Stay on this page — your tickets will be confirmed automatically.
            </p>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-checkout-title"
        >
          <div
            className={`landing-page flex w-full max-h-[min(92dvh,100%)] flex-col overflow-hidden rounded-t-[1.75rem] border shadow-2xl sm:max-h-[min(92vh,100%)] sm:rounded-3xl ${
              assignEachTicket ? 'sm:max-w-xl' : 'sm:max-w-md'
            }`}
            style={{
              borderColor: 'var(--landing-border)',
              background: 'var(--landing-surface)',
              color: 'var(--landing-text)',
              boxShadow: 'var(--landing-shadow-hover)',
            }}
          >
            <div
              className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-7"
              style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface)' }}
            >
              <div className="min-w-0 pr-2">
                <p className="landing-eyebrow" style={{ color: 'var(--primary)' }}>
                  Checkout
                </p>
                <div id="landing-checkout-title" className="landing-display mt-1 text-xl sm:text-2xl">
                  Your tickets
                </div>
                <div className="mt-1 truncate text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  {event.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="-mr-1 shrink-0 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-6">
            <div className="landing-card-premium rounded-2xl p-4 sm:p-5">
              {orderLines.map((line) => (
                <div key={line.name} className="flex justify-between py-1 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  <span>
                    {line.name} × {line.qty}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--landing-text)' }}>
                    {formatLKR(line.total)}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold" style={{ borderColor: 'var(--landing-border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>{totalAmount <= 0 ? 'Free' : formatLKR(totalAmount)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(submitCheckout)} className="mt-5 flex flex-col gap-3.5 sm:mt-6 sm:gap-4">
              {user?.role === 'attendee' && (
                <div
                  className="rounded-xl border p-3 text-xs font-medium"
                  style={{
                    borderColor: 'var(--landing-border)',
                    background: 'var(--landing-surface-muted)',
                    color: 'var(--landing-text-muted)',
                  }}
                >
                  Pre-filled from your attendee profile.
                </div>
              )}

              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                Purchaser (you)
              </p>
              <p className="-mt-2 text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                Payment and order confirmation go here.
                {assignEachTicket
                  ? ' Each ticket holder also receives their pass by email.'
                  : buyingForSomeoneElse
                    ? ' The ticket holder receives their pass by email.'
                    : canAssignEachTicket
                      ? ' All tickets will be issued under this name unless you assign them below.'
                      : ' Your ticket will be issued to this email.'}
              </p>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  Full name
                </span>
                <input
                  {...register('buyerName', { required: true })}
                  className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                  style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  Email
                </span>
                <input
                  type="email"
                  {...register('buyerEmail', { required: true })}
                  className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                  style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  Phone (optional)
                </span>
                <input
                  {...register('buyerPhone')}
                  className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                  style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                />
              </label>

              {canAssignEachTicket && !assignEachTicket && (
                <label
                  className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--landing-border)' }}
                >
                  <input
                    type="checkbox"
                    checked={assignEachTicket}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAssignEachTicket(next);
                      if (next) setBuyingForSomeoneElse(false);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="font-semibold text-[var(--landing-text)]">Assign each ticket to a different person</span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                      Optional — each pass gets its own name, email, and QR code.
                    </span>
                  </span>
                </label>
              )}

              {assignEachTicket && canAssignEachTicket ? (
                <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--landing-border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--landing-text)]">Assign each ticket</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                          {totalTicketQuantity} tickets — enter who each pass is for.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                      style={{ color: 'var(--landing-text-muted)' }}
                      onClick={() => setAssignEachTicket(false)}
                    >
                      Turn off
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold underline-offset-2 hover:underline"
                    style={{ color: 'var(--primary)' }}
                    onClick={() => {
                      const name = buyerName.trim();
                      const email = buyerEmail.trim();
                      const phone = buyerPhone.trim();
                      setTicketHolders((rows) =>
                        rows.map((row, index) =>
                          index === 0
                            ? { ...row, fullName: name, email, phone }
                            : row
                        )
                      );
                    }}
                  >
                    Use my details for the first ticket
                  </button>
                  <div className="flex flex-col gap-4">
                    {ticketHolders.map((row) => (
                      <div
                        key={row.key}
                        className="space-y-3 rounded-xl border p-3"
                        style={{
                          borderColor: 'var(--landing-border)',
                          background: 'var(--landing-surface-muted)',
                        }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                          {row.label}
                        </p>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                            Full name
                          </span>
                          <input
                            required
                            value={row.fullName}
                            onChange={(e) =>
                              setTicketHolders((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, fullName: e.target.value } : r))
                              )
                            }
                            className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                            style={{
                              borderColor: 'var(--landing-border)',
                              background: 'var(--landing-surface)',
                              color: 'var(--landing-text)',
                            }}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                            Email
                          </span>
                          <input
                            type="email"
                            required
                            value={row.email}
                            onChange={(e) =>
                              setTicketHolders((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, email: e.target.value } : r))
                              )
                            }
                            className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                            style={{
                              borderColor: 'var(--landing-border)',
                              background: 'var(--landing-surface)',
                              color: 'var(--landing-text)',
                            }}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                            Phone (optional)
                          </span>
                          <input
                            value={row.phone}
                            onChange={(e) =>
                              setTicketHolders((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, phone: e.target.value } : r))
                              )
                            }
                            className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                            style={{
                              borderColor: 'var(--landing-border)',
                              background: 'var(--landing-surface)',
                              color: 'var(--landing-text)',
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--landing-border)' }}>
                    <input
                      type="checkbox"
                      checked={buyingForSomeoneElse}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setBuyingForSomeoneElse(next);
                        if (next) setAssignEachTicket(false);
                      }}
                      className="h-4 w-4"
                    />
                    <span>
                      {canAssignEachTicket
                        ? 'Buying all tickets for someone else'
                        : 'Buying this ticket for someone else'}
                    </span>
                  </label>

                  {buyingForSomeoneElse && (
                    <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--landing-border)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                        Ticket holder
                      </p>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                          Full name
                        </span>
                        <input
                          {...register('attendeeName', { required: buyingForSomeoneElse })}
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                          Email
                        </span>
                        <input
                          type="email"
                          {...register('attendeeEmail', { required: buyingForSomeoneElse })}
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                          Phone (optional)
                        </span>
                        <input
                          {...register('attendeePhone')}
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                        />
                      </label>
                    </div>
                  )}

                  {!buyingForSomeoneElse && (
                    <p className="text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                      {canAssignEachTicket
                        ? `All ${totalTicketQuantity} tickets will be issued to ${buyerName || 'you'} (${buyerEmail || 'your email'})`
                        : `Your ticket will be issued to ${buyerName || 'you'} (${buyerEmail || 'your email'})`}
                      {buyerPhone ? ` · ${buyerPhone}` : ''}.
                    </p>
                  )}
                </>
              )}
              <button
                type="submit"
                disabled={isPurchasing || !prefillReady}
                className="landing-btn-primary mt-2 h-12 w-full rounded-2xl text-base font-bold text-white disabled:opacity-50"
              >
                {isPurchasing
                  ? 'Processing…'
                  : totalAmount <= 0
                    ? 'Confirm registration'
                    : `Pay ${formatLKR(totalAmount)}`}
              </button>
              {payError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{payError}</div>
              )}
            </form>
            </div>
          </div>
        </div>
      )}

      {hasSelectedTickets && !checkoutOpen ? (
        <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      ) : null}
    </div>
  );
};
