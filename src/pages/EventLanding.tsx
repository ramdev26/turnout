import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Event, Ticket, OrderItem, AttendeeProfile } from '../types';
import { api } from '../api/client';
import { getLandingTemplateAll } from '../templates/templates';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';

declare global {
  interface Window {
    payhere?: {
      onCompleted: (orderId: string) => void;
      onDismissed: () => void;
      onError: (error: string) => void;
      startPayment: (payment: Record<string, any>) => void;
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

    fetchEventData();
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
    prefillCheckout();
  }, [reset, user]);

  const handleTicketChange = (ticketId: string, quantity: number) => {
    setSelectedTickets(prev => ({
      ...prev,
      [ticketId]: Math.max(0, quantity),
    }));
  };

  const totalAmount = tickets.reduce((sum, ticket) => {
    return sum + (ticket.price * (selectedTickets[ticket.id] || 0));
  }, 0);

  const hasSelectedTickets = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);

  const handlePurchase = async () => {
    if (!event || !hasSelectedTickets) return;
    setCheckoutOpen(true);
  };

  const submitCheckout = async (values: { buyerName: string; buyerEmail: string; buyerPhone: string }) => {
    if (!event || !hasSelectedTickets) return;
    setIsPurchasing(true);
    try {
      const orderItems: OrderItem[] = tickets
        .filter((t) => selectedTickets[t.id] > 0)
        .map((t) => ({
          ticketId: t.id,
          name: t.name,
          quantity: selectedTickets[t.id],
          price: t.price,
        }));

      // Simple attendee list: one attendee per ticket qty, using buyer details (MVP)
      const attendees = orderItems.flatMap((it) =>
        Array.from({ length: it.quantity }).map(() => ({
          ticketId: it.ticketId,
          fullName: values.buyerName || 'Attendee',
          email: values.buyerEmail,
          phone: values.buyerPhone,
        }))
      );

      if (totalAmount <= 0) {
        const res = await api.post<{ orderId: string }>('/api/orders', {
          eventId: event.id,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerPhone: values.buyerPhone,
          tickets: orderItems,
          attendees,
        });
        setCheckoutOpen(false);
        navigate(`/orders/${res.orderId}/success`);
      } else {
        const res = await api.post<{ sdkPayment: Record<string, any> }>('/api/payhere/initiate', {
          eventId: event.id,
          buyerName: values.buyerName,
          buyerEmail: values.buyerEmail,
          buyerPhone: values.buyerPhone,
          tickets: orderItems,
          attendees,
        });
        setPayError(null);

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
          setPayError('Payment popup dismissed. You can try again.');
        };
        window.payhere.onError = (error: string) => {
          setPayError(error || 'PayHere error');
        };
        window.payhere.startPayment(res.sdkPayment);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setPayError('Could not start payment. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Event not found</h2>
        <p className="mt-2 text-neutral-500">The event you are looking for does not exist or has been removed.</p>
        <Button onClick={() => navigate('/')} className="mt-6">
          Go back home
        </Button>
      </div>
    );
  }

  const template = getLandingTemplateAll(event.templateId);
  return (
    <>
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
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl border border-indigo-100 bg-white/95 p-2 shadow-xl backdrop-blur md:bottom-6">
          <Button onClick={handlePurchase} disabled={isPurchasing} className="h-11 rounded-xl px-5">
            {isPurchasing ? 'Processing…' : `Checkout ${totalAmount.toFixed(2)} LKR`}
          </Button>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-indigo-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold tracking-tight text-neutral-900">Complete your registration</div>
                <div className="mt-1 text-sm text-neutral-500">Secure checkout in LKR.</div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCheckoutOpen(false)}>
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit(submitCheckout)} className="mt-6 flex flex-col gap-4">
              {user?.role === 'attendee' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-800">
                  Checkout is pre-filled from your attendee profile.
                </div>
              )}
              <Input label="Full name" {...register('buyerName')} required />
              <Input label="Email" type="email" {...register('buyerEmail')} required />
              <Input label="Phone (optional)" {...register('buyerPhone')} />
              <Button type="submit" disabled={isPurchasing || !prefillReady} className="mt-2 h-11 rounded-xl">
                {isPurchasing ? 'Processing…' : 'Confirm & Get Tickets'}
              </Button>
              {payError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {payError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};
