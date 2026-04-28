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
        'group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(17,24,39,0.12)]',
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
        <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-neutral-900">{event.title}</h3>
        <div className="space-y-1.5 text-sm text-neutral-600">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#00a95d]" />
            {format(new Date(event.date), 'PPP p')}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#00a95d]" />
            {event.location}
          </p>
          {attendeesText ? (
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#00a95d]" />
              {attendeesText}
            </p>
          ) : null}
        </div>
        <Link
          to={ctaTo || `/e/${event.slug}`}
          className="inline-flex rounded-lg border border-[#00E676]/20 bg-[#00E676] px-3.5 py-2 text-sm font-medium text-[#062013] transition hover:bg-[#00C765]"
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
};

