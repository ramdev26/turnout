import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Ticket, OrderItem, AttendeeProfile } from '../types';
import { api } from '../api/client';
import { getLandingTemplateForEvent } from '../templates/templates';
import { landingCssVars, resolveEventTheme } from '../themes/eventThemes';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/useAuthStore';
import { formatLKR } from '../utils/money';
import { ticketRemaining } from '../components/landing/LandingShared';

declare global {
  interface Window {
    payhere?: {
      onCompleted: (orderId: string) => void;
      onDismissed: () => void;
      onError: (error: string) => void;
      startPayment: (payment: Record<string, unknown>) => void;
    };
  }
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
  const { user } = useAuthStore();

  const { register, handleSubmit, reset } = useForm<{ buyerName: string; buyerEmail: string; buyerPhone: string }>({
    defaultValues: { buyerName: '', buyerEmail: '', buyerPhone: '' },
  });

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
  };

  const submitCheckout = async (values: { buyerName: string; buyerEmail: string; buyerPhone: string }) => {
    if (!event || !hasSelectedTickets) return;
    setIsPurchasing(true);
    setPayError(null);
    try {
      const orderItems: OrderItem[] = tickets
        .filter((t) => selectedTickets[t.id] > 0)
        .map((t) => ({
          ticketId: t.id,
          name: t.name,
          quantity: selectedTickets[t.id],
          price: t.price,
        }));

      const attendees = orderItems.flatMap((it) =>
        Array.from({ length: it.quantity }).map(() => ({
          ticketId: it.ticketId,
          fullName: values.buyerName || 'Attendee',
          email: values.buyerEmail,
          phone: values.buyerPhone,
        }))
      );

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
        const res = await api.post<{ sdkPayment: Record<string, unknown> }>('/api/payhere/initiate', {
          eventId: event.id,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerPhone: values.buyerPhone,
          tickets: orderItems,
          attendees,
        });

        const ensureScript = async () => {
          if (window.payhere) return;
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-payhere-sdk="1"]') as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener('load', () => resolve(), { once: true });
              existing.addEventListener('error', () => reject(new Error('Failed to load PayHere SDK')), { once: true });
              return;
            }
            const s = document.createElement('script');
            s.src = 'https://www.payhere.lk/lib/payhere.js';
            s.async = true;
            s.dataset.payhereSdk = '1';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load PayHere SDK'));
            document.body.appendChild(s);
          });
        };

        await ensureScript();
        if (!window.payhere) throw new Error('PayHere SDK not available');

        window.payhere.onCompleted = (orderId: string) => {
          setCheckoutOpen(false);
          navigate(`/payhere/return?order_id=${encodeURIComponent(orderId)}`);
        };
        window.payhere.onDismissed = () => {
          setPayError('Payment was cancelled. You can try again.');
        };
        window.payhere.onError = (error: string) => {
          setPayError(error || 'Payment failed');
        };
        window.payhere.startPayment(res.sdkPayment);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string };
      setPayError(err?.message || err?.error || 'Could not complete checkout. Please try again.');
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
  const theme = resolveEventTheme(event.customization);

  return (
    <div style={landingCssVars(event.customization)} className="min-h-screen transition-[background] duration-700">
      {template.render({
        event,
        tickets,
        selectedTickets,
        onTicketChange: handleTicketChange,
        totalAmount,
        onCheckout: handlePurchase,
        isPurchasing,
      })}

      {hasSelectedTickets && (
        <div className="landing-glass fixed inset-x-0 bottom-0 z-[60] border-t p-4 md:hidden" style={{ borderColor: 'var(--landing-border)' }}>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="landing-btn-primary flex w-full items-center justify-center rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isPurchasing ? 'Processing…' : totalAmount <= 0 ? 'Complete registration' : `Pay ${formatLKR(totalAmount)}`}
          </button>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            className="landing-page max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border p-7 shadow-2xl sm:max-w-md sm:rounded-3xl"
            style={{
              borderColor: 'var(--landing-border)',
              background: 'var(--landing-surface)',
              color: 'var(--landing-text)',
              boxShadow: 'var(--landing-shadow-hover)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="landing-eyebrow" style={{ color: 'var(--primary)' }}>
                  Checkout
                </p>
                <div className="landing-display mt-1 text-2xl">Your tickets</div>
                <div className="mt-1 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  {event.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                Close
              </button>
            </div>

            <div className="landing-card-premium mt-6 rounded-2xl p-5">
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

            <form onSubmit={handleSubmit(submitCheckout)} className="mt-6 flex flex-col gap-4">
              {user?.role === 'attendee' && (
                <div
                  className="rounded-xl border p-3 text-xs font-medium"
                  style={{ borderColor: 'var(--landing-border)', background: theme.landing.surfaceMutedBg, color: 'var(--landing-text-muted)' }}
                >
                  Pre-filled from your attendee profile.
                </div>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  Full name
                </span>
                <input
                  {...register('buyerName', { required: true })}
                  className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
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
                  className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  Phone (optional)
                </span>
                <input
                  {...register('buyerPhone')}
                  className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--landing-text)' }}
                />
              </label>
              <button
                type="submit"
                disabled={isPurchasing || !prefillReady}
                className="landing-btn-primary mt-2 h-12 w-full rounded-2xl text-sm font-bold text-white disabled:opacity-50"
              >
                {isPurchasing ? 'Processing…' : totalAmount <= 0 ? 'Confirm registration' : 'Pay with PayHere'}
              </button>
              {payError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{payError}</div>
              )}
            </form>
          </div>
        </div>
      )}

      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
};
