import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Ticket, OrderItem, AttendeeProfile } from '../types';
import { api } from '../api/client';
import { getLandingTemplateForEvent } from '../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../themes/eventThemes';
import { loadLandingFont } from '../themes/landingFonts';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/useAuthStore';
import { formatLKRWhole } from '../utils/money';
import {
  buildTicketHoldersFromItems,
  LandingCheckoutModal,
  type TicketHolderInput,
} from '../components/landing/LandingCheckoutModal';
import { ticketRemaining } from '../components/landing/LandingShared';
import { normalizeCheckoutFields, validateCustomFieldValues } from '../utils/checkoutFields';
import {
  preloadPayHereScript,
  startPayHereCheckout,
  type PayHereInitiateResponse,
} from '../lib/payhereCheckout';
import { formatApiError } from '../utils/apiError';

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
  const [perAttendeeCustomFields, setPerAttendeeCustomFields] = useState<Record<string, string>[]>([]);
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

  const checkoutFields = useMemo(
    () => normalizeCheckoutFields(event?.customization?.checkoutFields),
    [event?.customization?.checkoutFields]
  );

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
      const next = buildTicketHoldersFromItems(orderItems);
      const prevByKey = Object.fromEntries(prev.map((row) => [row.key, row]));
      return next.map((row) => ({
        ...row,
        fullName: prevByKey[row.key]?.fullName ?? row.fullName,
        email: prevByKey[row.key]?.email ?? row.email,
        phone: prevByKey[row.key]?.phone ?? row.phone,
        customFields: prevByKey[row.key]?.customFields ?? row.customFields,
      }));
    });
  }, [checkoutOpen, orderItems, assignEachTicket]);

  useEffect(() => {
    if (!checkoutOpen || checkoutFields.length < 1) return;
    const count = buildTicketHoldersFromItems(orderItems).length;
    setPerAttendeeCustomFields((prev) =>
      Array.from({ length: count }, (_, index) => prev[index] ?? {})
    );
  }, [checkoutOpen, orderItems, checkoutFields.length]);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId && !slug) return;
      try {
        const eventRes = eventId
          ? await api.get<{ event: Event }>(`/api/events/${eventId}`)
          : await api.get<{ event: Event }>(`/api/events/slug/${slug}`);
        const ticketRes = await api.get<{ tickets: Ticket[] }>(`/api/events/${eventRes.event.id}/tickets`);
        setEvent(eventRes.event);
        setTickets(Array.isArray(ticketRes.tickets) ? ticketRes.tickets : []);
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
    document.title = event.title;
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
      let attendees: {
        ticketId: string;
        fullName: string;
        email: string;
        phone: string;
        customFields?: Record<string, string>;
      }[];

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
          customFields: row.customFields,
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

      if (checkoutFields.length > 0) {
        const fieldSources =
          assignEachTicket && canAssignEachTicket
            ? ticketHolders.map((row) => row.customFields)
            : perAttendeeCustomFields;
        for (let i = 0; i < attendees.length; i += 1) {
          const label =
            assignEachTicket && canAssignEachTicket
              ? ticketHolders[i]?.label
              : buildTicketHoldersFromItems(orderItems)[i]?.label ?? `Ticket ${i + 1}`;
          const fieldErr = validateCustomFieldValues(checkoutFields, fieldSources[i] ?? {}, label);
          if (fieldErr) {
            setPayError(fieldErr);
            setIsPurchasing(false);
            return;
          }
          attendees[i] = { ...attendees[i], customFields: fieldSources[i] ?? {} };
        }
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
          allowSameTabFallback: true,
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
      setPayherePopupOpen(false);
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
    <div style={landingCssVars(event.customization)} className="min-h-dvh transition-[background] duration-700">
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
            className="landing-btn-primary flex w-full items-center justify-center rounded-2xl py-3.5 text-base font-bold disabled:opacity-50"
          >
            {isPurchasing ? 'Processing…' : totalAmount <= 0 ? 'Complete registration' : `Pay ${formatLKRWhole(totalAmount)}`}
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
              Use the secure PayHere window on this page. Your tickets will be confirmed automatically when payment succeeds.
            </p>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <LandingCheckoutModal
          event={event}
          onClose={() => setCheckoutOpen(false)}
          orderLines={orderLines}
          orderItems={orderItems}
          totalAmount={totalAmount}
          totalTicketQuantity={totalTicketQuantity}
          canAssignEachTicket={canAssignEachTicket}
          assignEachTicket={assignEachTicket}
          setAssignEachTicket={setAssignEachTicket}
          buyingForSomeoneElse={buyingForSomeoneElse}
          setBuyingForSomeoneElse={setBuyingForSomeoneElse}
          isAttendeePrefill={user?.role === 'attendee'}
          prefillReady={prefillReady}
          isPurchasing={isPurchasing}
          payError={payError}
          checkoutFields={checkoutFields}
          ticketHolders={ticketHolders}
          setTicketHolders={setTicketHolders}
          perAttendeeCustomFields={perAttendeeCustomFields}
          setPerAttendeeCustomFields={setPerAttendeeCustomFields}
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          buyerPhone={buyerPhone}
          register={register}
          buildTicketHolders={buildTicketHoldersFromItems}
          onSubmit={handleSubmit(submitCheckout)}
        />
      )}

      {hasSelectedTickets && !checkoutOpen ? (
        <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      ) : null}
    </div>
  );
};
