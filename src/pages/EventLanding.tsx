import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Ticket, OrderItem } from '../types';
import { api } from '../api/client';
import { getLandingTemplateForEvent } from '../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../themes/eventThemes';
import { loadLandingFont } from '../themes/landingFonts';
import { formatLKRWhole } from '../utils/money';
import { ticketRemaining } from '../components/landing/LandingShared';
import { EventCheckoutForm } from '../components/landing/EventCheckoutForm';
import { saveCheckoutCart } from '../utils/checkoutCart';
import { trackEventPageVisit } from '../utils/eventVisitTracking';

export const EventLanding: React.FC = () => {
  const { eventId, slug } = useParams<{ eventId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
    document.title = event.title;
    loadLandingFont(normalizeLandingCustomization(event.customization, event.templateId).fontFamily);
  }, [event]);

  useEffect(() => {
    if (!event || event.status !== 'published') return;
    trackEventPageVisit(event.id);
  }, [event]);

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

  const handlePurchase = () => {
    if (!event || !hasSelectedTickets) return;

    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      saveCheckoutCart({
        eventId: event.id,
        selectedTickets,
        savedAt: Date.now(),
      });
      const checkoutPath = eventId
        ? `/events/${eventId}/checkout`
        : `/e/${slug}/checkout`;
      navigate(checkoutPath, { state: { selectedTickets } });
      return;
    }

    setCheckoutOpen(true);
  };

  const themeVars = event
    ? landingCssVars(event.customization, event.templateId)
    : landingCssVars(undefined);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-[var(--primary)]" />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
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
            className="turnout-btn-accent mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-semibold"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-on)' }}
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (event.status !== 'published') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ ...landingCssVars(event.customization, event.templateId), background: 'var(--landing-page-bg)' }}>
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
    <div style={landingCssVars(event.customization, event.templateId)} className="min-h-dvh transition-[background] duration-700">
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

      {checkoutOpen && (
        <EventCheckoutForm
          key={`checkout-${event.id}-${orderItems.map((i) => `${i.ticketId}:${i.quantity}`).join('|')}`}
          event={event}
          orderItems={orderItems}
          totalAmount={totalAmount}
          layout="modal"
          onClose={() => setCheckoutOpen(false)}
          onPurchasingChange={setIsPurchasing}
        />
      )}

      {hasSelectedTickets && !checkoutOpen ? (
        <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      ) : null}
    </div>
  );
};
