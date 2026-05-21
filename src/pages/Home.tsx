import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, Ticket, Layout, BarChart3, ArrowRight, Users, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EventCard } from '../components/ui/EventCard';
import { Event } from '../types';
import { api } from '../api/client';

export const Home: React.FC = () => {
  const { user } = useAuthStore();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ events: Event[] }>('/api/public/events?limit=6');
        if (!cancelled) setFeaturedEvents(res.events || []);
      } catch {
        if (!cancelled) setFeaturedEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-20 py-8 md:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white px-6 py-12 shadow-[0_18px_38px_rgba(17,24,39,0.08)] sm:px-10">
        <div className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-[#00E676]/12 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#00a95d]">
              <Sparkles className="h-3.5 w-3.5" />
              Turnout event platform
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
              Create beautiful event pages that convert in minutes
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
              Sell tickets, manage attendees, and run operations from one clean workspace. Designed for speed, clarity, and conversion.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={user ? '/dashboard' : '/events/themes'}>
                <Button size="lg">
                  {user ? 'Open Dashboard' : 'Create Event'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/attendee/signup">
                <Button variant="secondary" size="lg">
                  Join as attendee
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#00a95d]" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#00a95d]" />
                Live event pages
              </span>
            </div>
          </div>
          <Card className="overflow-hidden p-3">
            <img
              src="https://picsum.photos/seed/event-dashboard/1200/760"
              alt="Event dashboard preview"
              className="h-full min-h-[260px] w-full rounded-2xl object-cover"
              referrerPolicy="no-referrer"
            />
          </Card>
        </motion.div>
      </section>

      <section className="grid gap-12 md:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(17,24,39,0.1)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#00a95d]">
            <Layout className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Theme-based pages</h3>
          <p className="text-neutral-600">Pick a visual theme for create flow and public landing pages that match your brand.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition-all hover:shadow-[0_14px_28px_rgba(17,24,39,0.1)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#00a95d]">
            <Ticket className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Flexible ticketing</h3>
          <p className="text-neutral-600">Free or paid multi-tier tickets with inventory limits and PayHere checkout.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition-all hover:shadow-[0_14px_28px_rgba(17,24,39,0.1)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#00a95d]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Organizer operations</h3>
          <p className="text-neutral-600">Dashboard, check-in, agenda, runbook, and earnings in one place.</p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Live events</h2>
          {!eventsLoading && featuredEvents.length > 0 ? (
            <span className="text-sm text-neutral-500">{featuredEvents.length} published</span>
          ) : null}
        </div>
        {eventsLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100" />
            ))}
          </div>
        ) : featuredEvents.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <p className="text-neutral-600">No published events yet.</p>
            <Link to="/events/themes" className="mt-4 inline-block text-sm font-semibold text-[#00a95d] hover:text-[#008e4f]">
              Create the first event
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white px-8 py-10 text-center shadow-[0_14px_32px_rgba(17,24,39,0.08)]">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Ready to launch your next event?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-neutral-500">
          Publish a themed landing page, sell tickets, and manage attendees from your organizer dashboard.
        </p>
        <Link to={user ? '/events/new' : '/signup'} className="mt-6 inline-block">
          <Button size="lg">{user ? 'Create event now' : 'Get started free'}</Button>
        </Link>
      </section>
    </div>
  );
};
