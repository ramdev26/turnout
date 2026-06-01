import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Event } from '../../types';
import { cn } from '../../utils/cn';

type Props = {
  event: Event;
  attendeesText?: string;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
};

export const EventCard: React.FC<Props> = ({ event, attendeesText, ctaLabel = 'View event', ctaTo, className }) => {
  return (
    <article
      className={cn(
        'turnout-surface group overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-0.5',
        className
      )}
    >
      <img
        src={event.bannerUrl || `https://picsum.photos/seed/${event.id}/800/420`}
        alt={event.title}
        className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        referrerPolicy="no-referrer"
      />
      <div className="space-y-3 p-5">
        <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-[var(--text)]">{event.title}</h3>
        <div className="space-y-1.5 text-sm text-[var(--text-muted)]">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            {format(new Date(event.date), 'PPP p')}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--primary)]" />
            {event.location}
          </p>
          {attendeesText ? (
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--primary)]" />
              {attendeesText}
            </p>
          ) : null}
        </div>
        <Link
          to={ctaTo || `/e/${event.slug}`}
          className="inline-flex rounded-lg border px-3.5 py-2 text-sm font-medium transition hover:bg-[var(--primary-hover)]"
          style={{
            borderColor: 'color-mix(in srgb, var(--primary) 35%, transparent)',
            background: 'var(--primary)',
            color: 'var(--primary-on)',
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
};
