import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Event } from '../types';
import { Plus, Calendar, MapPin, Users, DollarSign, ExternalLink, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../api/client';
import { formatLKR } from '../utils/money';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowCard, FlowStatCard, FlowLinkButton } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

type EventInsights = {
  eventId: string;
  soldTickets: number;
  totalRevenue: number;
  attendeeTotal: number;
  checkedInCount: number;
};

function insightsFromEvent(event: Event): EventInsights {
  const stats = event.stats;
  return {
    eventId: event.id,
    soldTickets: stats?.soldTickets ?? 0,
    totalRevenue: stats?.totalRevenue ?? 0,
    attendeeTotal: stats?.attendeeTotal ?? 0,
    checkedInCount: stats?.checkedInCount ?? 0,
  };
}

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
  const ui = APP_FLOW_UI;

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      try {
        const res = await api.get<{ events: Event[] }>('/api/events');
        setEvents(res.events);
        setInsightsByEvent(
          Object.fromEntries(res.events.map((event) => [event.id, insightsFromEvent(event)]))
        );
        try {
          const earningsRes = await api.get<{
            earnings: { grossRevenue: number; platformFees: number; netEarnings: number; availableBalance: number };
          }>('/api/organizer/earnings');
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
      <OrganizerFlowShell title="Organizer Dashboard" navLinks={organizerMainNav}>
        <FlowPage>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </FlowPage>
      </OrganizerFlowShell>
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
    <OrganizerFlowShell
      title="Organizer Dashboard"
      subtitle="Manage events, monitor performance, and run operations from one place."
      navLinks={organizerMainNav}
    >
      <FlowPage>
        <FlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: ui.text }}>
              Ready to launch something new?
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Create and publish your next event landing page.
            </p>
          </div>
          <FlowLinkButton to="/events/new" primary className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create New Event
          </FlowLinkButton>
        </FlowCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FlowStatCard label="Total Events" value={events.length} icon={<Calendar className="h-5 w-5" />} />
          <FlowStatCard label="Tickets Sold" value={totals.soldTickets} icon={<Users className="h-5 w-5" />} />
          <FlowStatCard label="Total Revenue" value={formatLKR(totals.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} />
          <FlowStatCard
            label="Upcoming Events"
            value={upcomingEvents}
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent={ui.accent}
          />
        </div>

        {earnings && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FlowStatCard label="Gross Revenue" value={formatLKR(earnings.grossRevenue)} />
            <FlowStatCard label="Platform Fees" value={formatLKR(earnings.platformFees)} />
            <FlowStatCard label="Net Earnings" value={formatLKR(earnings.netEarnings)} />
            <FlowStatCard label="Withdrawable" value={formatLKR(earnings.availableBalance)} accent={ui.accent} />
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
            Your Events
          </h2>
          {events.length === 0 ? (
            <EmptyState
              title="No events found"
              description="Start by creating your first event landing page."
              action={
                <FlowLinkButton to="/events/new" primary>
                  Create Event
                </FlowLinkButton>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="group overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ backgroundColor: ui.cardBg, borderColor: ui.borderColor }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={event.bannerUrl || `https://picsum.photos/seed/${event.id}/600/400`}
                      alt={event.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', borderColor: 'transparent' }}
                    >
                      {event.status}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold" style={{ color: ui.text }}>
                      {event.title}
                    </h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border p-3 text-xs" style={cardMutedStyleFor(ui)}>
                      <div>
                        <div className="font-bold" style={{ color: ui.text }}>
                          {insightsByEvent[event.id]?.soldTickets ?? 0}
                        </div>
                        <div style={{ color: ui.textMuted }}>Sold</div>
                      </div>
                      <div>
                        <div className="font-bold" style={{ color: ui.text }}>
                          {formatLKR(insightsByEvent[event.id]?.totalRevenue ?? 0)}
                        </div>
                        <div style={{ color: ui.textMuted }}>Revenue</div>
                      </div>
                      <div>
                        <div className="font-bold" style={{ color: ui.text }}>
                          {(insightsByEvent[event.id]?.checkedInCount ?? 0)}/
                          {insightsByEvent[event.id]?.attendeeTotal ?? 0}
                        </div>
                        <div style={{ color: ui.textMuted }}>Checked-in</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 text-sm" style={{ color: ui.textMuted }}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {format(new Date(event.date), 'PPP p')}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                    <div
                      className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                      style={{ borderColor: ui.borderColor }}
                    >
                      <Link
                        to={`/e/${event.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: ui.accent }}
                      >
                        View Page
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Link
                        to={`/dashboard/events/${event.id}/settings`}
                        className="text-sm font-semibold"
                        style={{ color: ui.text }}
                      >
                        Settings →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FlowPage>
    </OrganizerFlowShell>
  );
};
