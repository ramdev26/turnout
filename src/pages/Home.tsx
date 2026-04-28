import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, Ticket, Layout, BarChart3, ArrowRight, Users, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EventCard } from '../components/ui/EventCard';
import { Event } from '../types';

export const Home: React.FC = () => {
  const { user } = useAuthStore();
  const featuredEvents: Event[] = [
    {
      id: 'f1',
      slug: 'founders-night-colombo',
      organizerId: '0',
      title: 'Founders Night Colombo',
      description: '',
      date: new Date(Date.now() + 5 * 86400000).toISOString(),
      location: 'Cinnamon Lakeside, Colombo',
      bannerUrl: 'https://picsum.photos/seed/founders-night/900/500',
      templateId: 'template-1',
      customization: { primaryColor: '#4f46e5', secondaryColor: '#60a5fa', fontFamily: 'Inter', heroText: '', heroSubtext: '', layout: 'standard' },
      status: 'published',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f2',
      slug: 'design-forward-meetup',
      organizerId: '0',
      title: 'Design Forward Meetup',
      description: '',
      date: new Date(Date.now() + 9 * 86400000).toISOString(),
      location: 'Online',
      bannerUrl: 'https://picsum.photos/seed/design-forward/900/500',
      templateId: 'template-2',
      customization: { primaryColor: '#4f46e5', secondaryColor: '#60a5fa', fontFamily: 'Inter', heroText: '', heroSubtext: '', layout: 'standard' },
      status: 'published',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f3',
      slug: 'product-growth-summit',
      organizerId: '0',
      title: 'Product Growth Summit',
      description: '',
      date: new Date(Date.now() + 15 * 86400000).toISOString(),
      location: 'Shangri-La, Colombo',
      bannerUrl: 'https://picsum.photos/seed/product-growth/900/500',
      templateId: 'template-3',
      customization: { primaryColor: '#4f46e5', secondaryColor: '#60a5fa', fontFamily: 'Inter', heroText: '', heroSubtext: '', layout: 'standard' },
      status: 'published',
      createdAt: new Date().toISOString(),
    },
  ];

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
                12k+ registrations
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#00a95d]" />
                500+ events hosted
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
          <h3 className="text-xl font-bold text-neutral-900">Customizable Templates</h3>
          <p className="text-neutral-600">Choose from pre-built landing page templates and customize them to match your brand.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition-all hover:shadow-[0_14px_28px_rgba(17,24,39,0.1)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#00a95d]">
            <Ticket className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Flexible Ticketing</h3>
          <p className="text-neutral-600">Create multiple ticket types and manage quantities effortlessly.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition-all hover:shadow-[0_14px_28px_rgba(17,24,39,0.1)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#00a95d]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Real-time Analytics</h3>
          <p className="text-neutral-600">Track sales, revenue, and attendee data in real-time with intuitive dashboards.</p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Featured events this week</h2>
          <Link to="/" className="text-sm font-medium text-[#00a95d] hover:text-[#008e4f]">
            Browse all events
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredEvents.map((event, idx) => (
            <EventCard key={event.id} event={event} attendeesText={`${220 + idx * 70} people attending`} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white px-8 py-10 text-center shadow-[0_14px_32px_rgba(17,24,39,0.08)]">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Trusted by modern event teams</h2>
        <p className="mx-auto mt-2 max-w-2xl text-neutral-500">From product launches to community meetups, organizers use Turnout to simplify registration and increase attendance.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-10 text-sm font-semibold tracking-wide text-neutral-400">
          <span>TECHCONF</span>
          <span>MUSICFEST</span>
          <span>ARTEXPO</span>
          <span>STARTUPDAY</span>
          <span>UXCIRCLE</span>
        </div>
      </section>
    </div>
  );
};
