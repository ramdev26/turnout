import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Event, OrderItem, Ticket } from '../types';
import { api } from '../api/client';
import { landingCssVars, normalizeLandingCustomization } from '../themes/eventThemes';
import { loadLandingFont } from '../themes/landingFonts';
import { EventCheckoutForm } from '../components/landing/EventCheckoutForm';
import { loadCheckoutCart, clearCheckoutCart } from '../utils/checkoutCart';

type LocationState = {
  selectedTickets?: Record<string, number>;
};

export const EventCheckout: React.FC = () => {
  const { eventId, slug } = useParams<{ eventId?: string; slug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LocationState | null) ?? null;

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const backHref = eventId ? `/events/${eventId}` : slug ? `/e/${slug}` : '/';

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

        const fromState = locationState?.selectedTickets;
        const fromCart = loadCheckoutCart(eventRes.event.id)?.selectedTickets;
        const selected = fromState && Object.keys(fromState).length > 0 ? fromState : fromCart ?? null;

        if (!selected || !Object.values(selected).some((qty) => qty > 0)) {
          navigate(eventId ? `/events/${eventId}` : `/e/${slug}`, { replace: true });
          return;
        }

        setSelectedTickets(selected);
      } catch (error) {
        console.error('Error fetching event for checkout:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchEventData();
    // Intentionally run once per route params; location.state is read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, slug]);

  useEffect(() => {
    if (!event) return;
    document.title = `Checkout · ${event.title}`;
    loadLandingFont(normalizeLandingCustomization(event.customization, event.templateId).fontFamily);
  }, [event]);

  const orderItems = useMemo<OrderItem[]>(() => {
    if (!selectedTickets) return [];
    return tickets
      .filter((t) => (selectedTickets[t.id] || 0) > 0)
      .map((t) => ({
        ticketId: t.id,
        name: t.name,
        quantity: selectedTickets[t.id],
        price: t.price,
      }));
  }, [selectedTickets, tickets]);

  const totalAmount = useMemo(
    () => orderItems.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [orderItems]
  );

  const themeVars = event
    ? landingCssVars(event.customization, event.templateId)
    : landingCssVars(undefined);

  if (loading || (event && selectedTickets === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-11 w-11 animate-spin rounded-full border-2 border-zinc-200 border-t-[var(--primary)]"
            style={themeVars}
          />
          <p className="text-sm font-medium text-zinc-500">Loading checkout…</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-900">
          <h2 className="text-2xl font-semibold tracking-tight">Event not found</h2>
          <p className="mt-2 text-sm text-zinc-500">This event may have been removed or the link is incorrect.</p>
          <Link to="/" className="mt-6 inline-flex text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (event.status !== 'published') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-900">
          <h2 className="text-2xl font-semibold tracking-tight">{event.title}</h2>
          <p className="mt-2 text-sm text-zinc-500">This event is not published yet. Check back when tickets go live.</p>
          <Link to={backHref} className="mt-6 inline-flex text-sm font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--primary)', ...landingCssVars(event.customization, event.templateId) }}>
            Back to event
          </Link>
        </div>
      </div>
    );
  }

  if (orderItems.length < 1) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-white" style={landingCssVars(event.customization, event.templateId)}>
      <EventCheckoutForm
        event={event}
        orderItems={orderItems}
        totalAmount={totalAmount}
        layout="page"
        backHref={backHref}
        onClose={() => {
          clearCheckoutCart(event.id);
          navigate(backHref);
        }}
      />
    </div>
  );
};
