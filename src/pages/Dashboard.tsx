import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Attendee, Event, Ticket } from '../types';
import { Plus, Calendar, MapPin, Users, DollarSign, ExternalLink, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../api/client';
import { formatLKR } from '../utils/money';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { Card } from '../components/ui/Card';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

type EventInsights = {
  eventId: string;
  soldTickets: number;
  totalRevenue: number;
  totalCapacity: number;
  checkedInCount: number;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [insightsByEvent, setInsightsByEvent] = useState<Record<string, EventInsights>>({});
  const [earnings, setEarnings] = useState<{
    grossRevenue: number;
    platformFees: number;
    netEarnings: number;
    availableBalance: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      try {
        const res = await api.get<{ events: Event[] }>('/api/events');
        setEvents(res.events);

        const insightPairs = await Promise.all(
          res.events.map(async (event) => {
            const [ticketsRes, attendeesRes] = await Promise.all([
              api.get<{ tickets: Ticket[] }>(`/api/events/${event.id}/tickets`),
              api.get<{ attendees: Attendee[] }>(`/api/events/${event.id}/attendees?limit=1000`),
            ]);

            const soldTickets = ticketsRes.tickets.reduce((sum, t) => sum + t.sold, 0);
            const totalRevenue = ticketsRes.tickets.reduce((sum, t) => sum + t.sold * t.price, 0);
            const totalCapacity = ticketsRes.tickets.reduce((sum, t) => sum + t.quantity, 0);
            const checkedInCount = attendeesRes.attendees.filter((a) => !!a.checkedInAt).length;

            return [
              event.id,
              {
                eventId: event.id,
                soldTickets,
                totalRevenue,
                totalCapacity,
                checkedInCount,
              } as EventInsights,
            ] as const;
          })
        );
        setInsightsByEvent(Object.fromEntries(insightPairs));
        try {
          const earningsRes = await api.get<{ earnings: { grossRevenue: number; platformFees: number; netEarnings: number; availableBalance: number } }>(
            '/api/organizer/earnings'
          );
          setEarnings(earningsRes.earnings);
        } catch {
          setEarnings(null);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const totals = events.reduce(
    (acc, event) => {
      const eventInsight = insightsByEvent[event.id];
      if (!eventInsight) return acc;
      acc.soldTickets += eventInsight.soldTickets;
      acc.totalRevenue += eventInsight.totalRevenue;
      acc.checkedInCount += eventInsight.checkedInCount;
      return acc;
    },
    { soldTickets: 0, totalRevenue: 0, checkedInCount: 0 }
  );
  const now = Date.now();
  const upcomingEvents = events.filter((e) => new Date(e.date).getTime() > now).length;

  return (
    <OrganizerShell title="Organizer Dashboard" subtitle="Manage events, monitor performance, and run operations from one place.">
      <div className="flex flex-col gap-8">
        <Card className="rounded-3xl border-indigo-100/80 p-6">
          <div className="flex flex-wrap items-center justify-end gap-4">
            <Link
              to="/events/themes"
              className="inline-flex items-center"
            >
              <Button>
                <Plus className="h-4 w-4" />
                Create New Event
              </Button>
            </Link>
          </div>
        </Card>

      {/* Stats Summary */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-sm font-medium">Total Events</span>
            <Calendar className="h-5 w-5" />
          </div>
          <p className="mt-2 text-3xl font-bold">{events.length}</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-sm font-medium">Total Tickets Sold</span>
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-2 text-3xl font-bold">{totals.soldTickets}</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-sm font-medium">Total Revenue</span>
            <DollarSign className="h-5 w-5" />
          </div>
          <p className="mt-2 text-3xl font-bold">{formatLKR(totals.totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-sm font-medium">Upcoming Events</span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="mt-2 text-3xl font-bold">{upcomingEvents}</p>
        </div>
      </div>

      {earnings && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-neutral-500">Gross Revenue</div>
            <p className="mt-2 text-2xl font-bold">{formatLKR(earnings.grossRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-neutral-500">Platform Fees</div>
            <p className="mt-2 text-2xl font-bold">{formatLKR(earnings.platformFees)}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-neutral-500">Net Earnings</div>
            <p className="mt-2 text-2xl font-bold">{formatLKR(earnings.netEarnings)}</p>
          </div>
          <div className="rounded-2xl border border-[#00E676]/30 bg-[#ecfdf3] p-6 shadow-sm">
            <div className="text-sm font-medium text-neutral-500">Withdrawable Balance</div>
            <p className="mt-2 text-2xl font-bold">{formatLKR(earnings.availableBalance)}</p>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-bold">Your Events</h2>
        {events.length === 0 ? (
          <EmptyState
            title="No events found"
            description="Start by creating your first event landing page."
            action={
              <Link to="/events/themes">
                <Button>Create Event</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="group overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative h-48">
                  <img
                    src={event.bannerUrl || `https://picsum.photos/seed/${event.id}/600/400`}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    {event.status}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-neutral-900">{event.title}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3 text-xs">
                    <div>
                      <div className="font-bold text-neutral-900">{insightsByEvent[event.id]?.soldTickets ?? 0}</div>
                      <div className="text-neutral-500">Sold</div>
                    </div>
                    <div>
                      <div className="font-bold text-neutral-900">{formatLKR(insightsByEvent[event.id]?.totalRevenue ?? 0)}</div>
                      <div className="text-neutral-500">Revenue</div>
                    </div>
                    <div>
                      <div className="font-bold text-neutral-900">
                        {(insightsByEvent[event.id]?.checkedInCount ?? 0)}/{insightsByEvent[event.id]?.soldTickets ?? 0}
                      </div>
                      <div className="text-neutral-500">Checked-in</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 text-sm text-neutral-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(event.date), 'PPP p')}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                    <Link
                      to={`/e/${event.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View Page
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                      to={`/dashboard/events/${event.id}/settings`}
                      className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </OrganizerShell>
  );
};
