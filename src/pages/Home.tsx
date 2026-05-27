import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, Ticket, Layout, BarChart3, ArrowRight, Users, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { EventCard } from '../components/ui/EventCard';
import { Event } from '../types';
import { api } from '../api/client';
import { EVENT_THEMES } from '../themes/eventThemes';
import { cardStyleFor } from '../themes/flowUi';

const ui = EVENT_THEMES.minimal.ui;

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
    <div className="flex flex-col gap-16 px-4 py-8 sm:px-6 lg:px-8 md:py-14" style={{ background: ui.pageBg, color: ui.text }}>
      <section
        className="relative overflow-hidden rounded-3xl border px-6 py-12 shadow-sm sm:px-10 sm:py-16"
        style={{ ...cardStyleFor(ui) }}
      >
        <div
          className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: ui.accentSoft, opacity: 0.7 }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: ui.accentSoft, color: ui.accent }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Turnout event platform
            </span>
            <h1
              className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: ui.text }}
            >
              Create beautiful event pages that convert in minutes
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 sm:text-lg" style={{ color: ui.textMuted }}>
              Sell tickets, manage attendees, and run operations from one clean workspace. Designed for speed, clarity,
              and conversion.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={user ? '/dashboard' : '/events/themes'}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                style={{ backgroundColor: ui.accent }}
              >
                {user ? 'Open Dashboard' : 'Create Event'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/attendee/signup"
                className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition"
                style={{ ...cardStyleFor(ui), color: ui.text }}
              >
                Join as attendee
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm" style={{ color: ui.textMuted }}>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" style={{ color: ui.accent }} />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" style={{ color: ui.accent }} />
                Live event pages
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border shadow-sm" style={cardStyleFor(ui)}>
            <img
              src="https://picsum.photos/seed/event-dashboard/1200/760"
              alt="Event dashboard preview"
              className="h-full min-h-[240px] w-full rounded-2xl object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: <Layout className="h-6 w-6" />, title: 'Theme-based pages', desc: 'Pick a visual theme for create flow and public landing pages that match your brand.' },
          { icon: <Ticket className="h-6 w-6" />, title: 'Flexible ticketing', desc: 'Free or paid multi-tier tickets with inventory limits and PayHere checkout.' },
          { icon: <BarChart3 className="h-6 w-6" />, title: 'Organizer operations', desc: 'Dashboard, check-in, agenda, runbook, and earnings in one place.' },
          { icon: <Users className="h-6 w-6" />, title: 'Attendee portal', desc: 'Ticket wallet, QR passes, calendar export, and in-app reminders.' },
        ].map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-4 rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={cardStyleFor(ui)}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: ui.accentSoft, color: ui.accent }}
            >
              {f.icon}
            </div>
            <h3 className="text-base font-semibold" style={{ color: ui.text }}>
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: ui.textMuted }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: ui.text }}>
            Live events
          </h2>
          {!eventsLoading && featuredEvents.length > 0 ? (
            <span className="text-sm" style={{ color: ui.textMuted }}>
              {featuredEvents.length} published
            </span>
          ) : null}
        </div>
        {eventsLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border"
                style={{ borderColor: ui.borderColor, backgroundColor: ui.fieldBg }}
              />
            ))}
          </div>
        ) : featuredEvents.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {featuredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-dashed px-6 py-12 text-center"
            style={{ borderColor: ui.borderColor, background: ui.fieldBg }}
          >
            <p className="text-sm" style={{ color: ui.textMuted }}>
              No published events yet.
            </p>
            <Link
              to="/events/themes"
              className="mt-4 inline-block text-sm font-semibold"
              style={{ color: ui.accent }}
            >
              Create the first event
            </Link>
          </div>
        )}
      </section>

      <section
        className="rounded-3xl border px-8 py-12 text-center shadow-sm"
        style={cardStyleFor(ui)}
      >
        <h2 className="text-3xl font-semibold tracking-tight" style={{ color: ui.text }}>
          Ready to launch your next event?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base" style={{ color: ui.textMuted }}>
          Publish a themed landing page, sell tickets, and manage attendees from your organizer dashboard.
        </p>
        <Link
          to={user ? '/events/new' : '/signup'}
          className="mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
          style={{ backgroundColor: ui.accent }}
        >
          {user ? 'Create event now' : 'Get started free'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
};
