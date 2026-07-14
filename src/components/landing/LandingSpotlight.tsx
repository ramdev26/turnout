import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock3,
  MapPin,
  Navigation,
  Share2,
  Star,
} from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  EventBanner,
  LandingFooter,
  LandingPageShell,
  LandingTopBar,
  TicketsList,
  pad2,
  resolveLandingOrganizerBrand,
  ticketRemaining,
  useCountdown,
} from './LandingShared';
import { formatLKRWhole } from '../../utils/money';
import { resolveEventCategory } from '../../themes/eventCategories';

const DEFAULT_POLICIES = [
  'Tickets are non-refundable once purchased, unless the event is cancelled by the organizer.',
  'Only buy tickets from this official event page to avoid fraudulent listings.',
  'Keep your ticket QR code safe — lost tickets may not be reissued.',
  'Re-entry may not be permitted after you leave the venue.',
  'The organizer may refuse entry for safety or policy reasons.',
];

function lowestAvailablePrice(tickets: EventTicket[]): number | null {
  const available = tickets.filter((t) => ticketRemaining(t) > 0);
  if (available.length === 0) return null;
  return Math.min(...available.map((t) => t.price));
}

function formatFromPrice(tickets: EventTicket[]): string {
  const fromPrice = lowestAvailablePrice(tickets);
  if (fromPrice == null) return 'Registration opens soon';
  if (fromPrice <= 0) return 'Free entry';
  return `${formatLKRWhole(fromPrice)} Upwards`;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function shareEvent(event: Event) {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  try {
    if (navigator.share) await navigator.share({ title: event.title, url });
    else if (navigator.clipboard) await navigator.clipboard.writeText(url);
  } catch {
    /* ignore cancel */
  }
}

function SpotlightBanner({ event }: { event: Event }) {
  if (!event.bannerUrl?.trim()) {
    return (
      <section className="landing-spotlight-banner" aria-hidden>
        <div className="landing-spotlight-banner-inner">
          <div className="landing-spotlight-banner-placeholder" />
        </div>
      </section>
    );
  }
  return (
    <section className="landing-spotlight-banner" aria-label="Event banner">
      <div className="landing-spotlight-banner-inner">
        <EventBanner event={event} overlay="none" imageClassName="landing-spotlight-banner-img" />
      </div>
    </section>
  );
}

function SpotlightTitleBlock({ event }: { event: Event }) {
  const title = event.customization?.heroText?.trim() || event.title;
  const lead = (event.customization?.heroSubtext || '').trim();
  const desc = event.description?.trim() || '';
  const preview = lead || (desc ? desc.slice(0, 160) : '');
  const canSeeMore = !lead && desc.length > 160;

  return (
    <div className="landing-spotlight-title-block">
      <h1 className="landing-spotlight-title">{title}</h1>
      {preview ? (
        <p className="landing-spotlight-lead">
          {preview}
          {canSeeMore ? (
            <>
              {' '}
              <a
                href="#landing-about"
                className="landing-spotlight-see-more"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('landing-about');
                }}
              >
                See more…
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function SpotlightOrganizer({ event, compact = false }: { event: Event; compact?: boolean }) {
  const brand = resolveLandingOrganizerBrand(event);
  return (
    <section className={`landing-spotlight-organizer${compact ? ' is-compact' : ''}`} aria-label="Organizer">
      {!compact ? <p className="landing-spotlight-organizer-label">Organized by</p> : null}
      <div className="landing-spotlight-organizer-card">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="landing-spotlight-organizer-logo" referrerPolicy="no-referrer" />
        ) : (
          <span className="landing-spotlight-organizer-mark">{brand.name.charAt(0).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          {compact ? <p className="landing-spotlight-organizer-label">Organized by</p> : null}
          <p className="landing-spotlight-organizer-name">{brand.name}</p>
        </div>
      </div>
    </section>
  );
}

function SpotlightPolicies() {
  const [open, setOpen] = useState(false);
  return (
    <section className="landing-spotlight-panel landing-spotlight-policies">
      <button
        type="button"
        className="landing-spotlight-accordion-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Event policies</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul className="landing-spotlight-policy-list">
          {DEFAULT_POLICIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SpotlightAbout({ event }: { event: Event }) {
  const desc = event.description?.trim();
  if (!desc) return null;
  return (
    <section id="landing-about" className="landing-spotlight-panel landing-spotlight-about scroll-mt-28">
      <h2 className="landing-spotlight-section-title">About this event</h2>
      <p className="landing-spotlight-about-text">{desc}</p>
    </section>
  );
}

function SpotlightLocation({ event }: { event: Event }) {
  const location = event.location?.trim() || 'Venue to be announced';
  const mapsUrl = event.location?.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;

  return (
    <section id="landing-venue" className="landing-spotlight-panel landing-spotlight-location scroll-mt-28">
      <div className="landing-spotlight-location-head">
        <h2 className="landing-spotlight-section-title">Location</h2>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="landing-spotlight-navigate">
            Navigate
            <Navigation className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      <div className="landing-spotlight-map-card">
        <div className="landing-spotlight-map-visual" aria-hidden>
          <MapPin className="h-6 w-6" />
        </div>
        <div className="landing-spotlight-map-body">
          <p className="landing-spotlight-map-name">{location}</p>
          <p className="landing-spotlight-map-hint">Open in Google Maps for directions</p>
        </div>
      </div>
    </section>
  );
}

function SpotlightBookingCard({
  event,
  tickets,
  onGetTickets,
}: {
  event: Event;
  tickets: EventTicket[];
  onGetTickets: () => void;
}) {
  const tba = !!event.customization?.scheduleTba;
  const eventDate = new Date(event.date);
  const { days, hours, mins, secs, done } = useCountdown(event.date, !tba);
  const category = resolveEventCategory(event.customization?.eventCategory);

  return (
    <aside className="landing-spotlight-booking" aria-label="Book tickets">
      <div className="landing-spotlight-booking-card">
        <div className="landing-spotlight-booking-top">
          <span className="landing-spotlight-featured">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </span>
        </div>

        {!tba && !done ? (
          <div className="landing-spotlight-countdown" aria-live="polite">
            {[
              { lbl: 'Days', val: days },
              { lbl: 'Hrs', val: hours },
              { lbl: 'Min', val: mins },
              { lbl: 'Sec', val: secs },
            ].map((u) => (
              <div key={u.lbl} className="landing-spotlight-countdown-unit">
                <span className="num">{pad2(u.val)}</span>
                <span className="lbl">{u.lbl}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="landing-spotlight-countdown-live">
            {tba ? 'Date to be announced' : 'Doors are open — reserve below.'}
          </p>
        )}

        <div className="landing-spotlight-meta-row">
          <div className="landing-spotlight-meta-pill">
            <Calendar className="h-3.5 w-3.5" />
            <span>{tba ? 'TBA' : format(eventDate, 'd MMM')}</span>
          </div>
          <div className="landing-spotlight-meta-pill">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{tba ? 'Time TBA' : format(eventDate, 'h:mm a')}</span>
          </div>
          {category.name ? <span className="landing-spotlight-category">{category.name}</span> : null}
        </div>

        <div className="landing-spotlight-price-block">
          <p className="landing-spotlight-price-label">Tickets from</p>
          <p className="landing-spotlight-price">{formatFromPrice(tickets)}</p>
        </div>

        <button type="button" className="landing-spotlight-cta" onClick={onGetTickets}>
          Get Tickets
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="landing-spotlight-secondary-actions">
          <button type="button" onClick={() => void shareEvent(event)} className="landing-spotlight-link-btn">
            <Share2 className="h-3.5 w-3.5" />
            Share event
          </button>
        </div>

        <div className="landing-spotlight-booking-organizer">
          <SpotlightOrganizer event={event} compact />
        </div>
      </div>
    </aside>
  );
}

function SpotlightMobileBar({
  event,
  tickets,
  onGetTickets,
}: {
  event: Event;
  tickets: EventTicket[];
  onGetTickets: () => void;
}) {
  const tba = !!event.customization?.scheduleTba;
  const { days, hours, mins, secs, done } = useCountdown(event.date, !tba);

  const countdownLabel = tba
    ? 'Date to be announced'
    : done
      ? 'Event is live'
      : `Starts in ${days}d ${pad2(hours)}h ${pad2(mins)}m ${pad2(secs)}s`;

  return (
    <div className="landing-spotlight-mobile-bar">
      <div className="landing-spotlight-mobile-bar-countdown">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{countdownLabel}</span>
        <button
          type="button"
          className="landing-spotlight-mobile-share"
          onClick={() => void shareEvent(event)}
          aria-label="Share event"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="landing-spotlight-mobile-bar-row">
        <div className="min-w-0">
          <p className="landing-spotlight-mobile-price-label">From</p>
          <p className="landing-spotlight-mobile-price">{formatFromPrice(tickets)}</p>
        </div>
        <button type="button" className="landing-spotlight-cta landing-spotlight-cta--compact" onClick={onGetTickets}>
          Get Tickets
        </button>
      </div>
    </div>
  );
}

export function LandingSpotlightPage({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
}: LandingTemplateProps) {
  const scrollTickets = () => scrollTo('landing-tickets');
  const hasSelection = useMemo(
    () => tickets.some((t) => (selectedTickets[t.id] || 0) > 0),
    [tickets, selectedTickets]
  );

  const handleGetTickets = () => {
    if (hasSelection) onCheckout();
    else scrollTickets();
  };

  return (
    <LandingPageShell event={event} showcase>
      <LandingTopBar event={event} onGetTickets={handleGetTickets} />

      <div className="landing-spotlight">
        <SpotlightBanner event={event} />

        <div className="landing-spotlight-shell">
          <div className="landing-spotlight-layout">
            <main className="landing-spotlight-main">
              <SpotlightTitleBlock event={event} />

              <div className="landing-spotlight-stack">
                <div className="landing-spotlight-organizer-mobile">
                  <SpotlightOrganizer event={event} />
                </div>

                <SpotlightAbout event={event} />
                <SpotlightPolicies />
                <SpotlightLocation event={event} />

                <section id="landing-tickets" className="landing-spotlight-panel landing-spotlight-tickets scroll-mt-28">
                  <div className="landing-spotlight-tickets-head">
                    <h2 className="landing-spotlight-section-title">Select tickets</h2>
                    <p className="landing-spotlight-tickets-sub">Choose your pass. Secure checkout with PayHere.</p>
                  </div>
                  <div className="landing-spotlight-tickets-body">
                    {tickets.length === 0 ? (
                      <div className="landing-spotlight-empty">Registration opens soon.</div>
                    ) : (
                      <TicketsList
                        tickets={tickets}
                        selectedTickets={selectedTickets}
                        onTicketChange={onTicketChange}
                      />
                    )}
                  </div>
                  {hasSelection ? (
                    <button
                      type="button"
                      className="landing-spotlight-cta mt-4"
                      onClick={onCheckout}
                      disabled={isPurchasing}
                    >
                      {isPurchasing
                        ? 'Processing…'
                        : totalAmount <= 0
                          ? 'Complete registration'
                          : `Pay ${formatLKRWhole(totalAmount)}`}
                      {!isPurchasing ? <ArrowRight className="h-4 w-4" /> : null}
                    </button>
                  ) : null}
                </section>
              </div>
            </main>

            <SpotlightBookingCard event={event} tickets={tickets} onGetTickets={handleGetTickets} />
          </div>
        </div>

        <SpotlightMobileBar event={event} tickets={tickets} onGetTickets={handleGetTickets} />
        <div className="landing-spotlight-mobile-spacer" aria-hidden />
      </div>

      <LandingFooter event={event} />
    </LandingPageShell>
  );
}
