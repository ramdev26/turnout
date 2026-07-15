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
  Ticket,
} from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  EventBanner,
  LandingFooter,
  LandingPageShell,
  LandingTopBar,
  pad2,
  resolveLandingOrganizerBrand,
  ticketRemaining,
  useCountdown,
} from './LandingShared';
import { VenueMapEmbed } from './VenueMapEmbed';
import { formatLKRWhole } from '../../utils/money';
import { resolveEventCategory } from '../../themes/eventCategories';

const DEFAULT_POLICIES = [
  'Tickets are non-refundable once purchased, unless the event is cancelled by the organizer.',
  'Purchase only from this official page to avoid fraudulent listings.',
  'Keep your QR code secure — lost tickets may not be reissued.',
  'Re-entry may not be permitted after leaving the venue.',
  'The organizer may refuse entry for safety or policy reasons.',
];

function lowestAvailablePrice(tickets: EventTicket[]): number | null {
  const available = tickets.filter((t) => ticketRemaining(t) > 0);
  if (available.length === 0) return null;
  return Math.min(...available.map((t) => t.price));
}

function formatFromPrice(tickets: EventTicket[]): string {
  const fromPrice = lowestAvailablePrice(tickets);
  if (fromPrice == null) return 'Sold out';
  if (fromPrice <= 0) return 'Free';
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
    /* ignore */
  }
}

function SpotlightHeroBanner({ event }: { event: Event }) {
  return (
    <section className="sp-hero" aria-label="Event banner">
      {event.bannerUrl?.trim() ? (
        <EventBanner event={event} overlay="none" fullWidth imageClassName="sp-hero-img" />
      ) : (
        <div className="sp-hero-fallback" />
      )}
    </section>
  );
}

function SpotlightQuickFacts({ event }: { event: Event }) {
  const tba = !!event.customization?.scheduleTba;
  const eventDate = new Date(event.date);
  const category = resolveEventCategory(event.customization?.eventCategory);

  return (
    <div className="sp-quickfacts">
      <div className="sp-quickfact">
        <Calendar className="h-4 w-4" />
        <div>
          <p className="sp-quickfact-label">Date</p>
          <p className="sp-quickfact-value">{tba ? 'To be announced' : format(eventDate, 'EEE, d MMM yyyy')}</p>
        </div>
      </div>
      <div className="sp-quickfact">
        <Clock3 className="h-4 w-4" />
        <div>
          <p className="sp-quickfact-label">Time</p>
          <p className="sp-quickfact-value">{tba ? 'TBA' : `${format(eventDate, 'h:mm a')} onwards`}</p>
        </div>
      </div>
      <div className="sp-quickfact">
        <MapPin className="h-4 w-4" />
        <div>
          <p className="sp-quickfact-label">Venue</p>
          <p className="sp-quickfact-value">{event.location?.trim() || 'Venue TBA'}</p>
        </div>
      </div>
      {category.name ? (
        <div className="sp-quickfact sp-quickfact--tag">
          <span className="sp-category-chip">{category.name}</span>
        </div>
      ) : null}
    </div>
  );
}

function SpotlightOrganizer({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  return (
    <div className="sp-org">
      <p className="sp-org-label">Organized by</p>
      <div className="sp-org-row">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="sp-org-logo" referrerPolicy="no-referrer" />
        ) : (
          <span className="sp-org-mark">{brand.name.charAt(0).toUpperCase()}</span>
        )}
        <p className="sp-org-name">{brand.name}</p>
      </div>
    </div>
  );
}

function SpotlightPolicies() {
  const [open, setOpen] = useState(false);
  return (
    <section className="sp-block">
      <button type="button" className="sp-accordion" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>Event policies</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul className="sp-policy-list">
          {DEFAULT_POLICIES.map((line) => (
            <li key={line}>{line}</li>
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
    <section id="landing-about" className="sp-block scroll-mt-28">
      <h2 className="sp-h2">About this event</h2>
      <p className="sp-body">{desc}</p>
    </section>
  );
}

function SpotlightLocation({ event }: { event: Event }) {
  const location = event.location?.trim() || 'Venue to be announced';
  const hasLocation = Boolean(event.location?.trim());
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location!.trim())}`
    : null;

  return (
    <section id="landing-venue" className="sp-block scroll-mt-28">
      <div className="sp-location-head">
        <h2 className="sp-h2">Location</h2>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="sp-nav-link">
            Navigate <Navigation className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      <div className="sp-map">
        <VenueMapEmbed
          query={hasLocation ? event.location : null}
          title={`${event.title} venue map`}
          emptyLabel="Venue to be announced"
          className="sp-map-embed"
        />
        <div className="sp-map-caption">
          <p className="sp-map-name">{location}</p>
          <p className="sp-map-hint">
            {hasLocation ? 'Interactive map · open Google Maps for directions' : 'Add a venue address to show the map'}
          </p>
        </div>
      </div>
    </section>
  );
}

function SpotlightTicketRow({
  ticket,
  qty,
  onChange,
}: {
  ticket: EventTicket;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const remaining = ticketRemaining(ticket);
  const soldOut = remaining <= 0;
  const desc = (ticket.description || 'Full event access').split('\n')[0]?.trim() || 'Full event access';

  return (
    <div className={`sp-ticket${qty > 0 ? ' is-active' : ''}${soldOut ? ' is-soldout' : ''}`}>
      <div className="sp-ticket-main">
        <div className="sp-ticket-icon">
          <Ticket className="h-4 w-4" />
        </div>
        <div className="sp-ticket-copy">
          <div className="sp-ticket-title-row">
            <h3 className="sp-ticket-name">{ticket.name}</h3>
            {soldOut ? <span className="sp-badge-sold">Sold out</span> : null}
            {!soldOut && remaining <= 12 ? <span className="sp-badge-low">{remaining} left</span> : null}
          </div>
          <p className="sp-ticket-desc">{desc}</p>
        </div>
        <p className="sp-ticket-price">{ticket.price <= 0 ? 'Free' : formatLKRWhole(ticket.price)}</p>
      </div>
      <div className="sp-ticket-action">
        <div className="sp-stepper">
          <button type="button" disabled={soldOut || qty <= 0} onClick={() => onChange(qty - 1)} aria-label="Decrease">
            −
          </button>
          <span>{qty}</span>
          <button
            type="button"
            disabled={soldOut || qty >= remaining}
            onClick={() => onChange(qty + 1)}
            aria-label="Increase"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="sp-ticket-add"
          disabled={soldOut || qty >= remaining}
          onClick={() => onChange(Math.min(remaining, qty + 1))}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SpotlightBookingRail({
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
    <aside className="sp-rail" aria-label="Booking">
      <div className="sp-rail-card">
        <div className="sp-rail-head">
          <span className="sp-featured">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </span>
          <button type="button" className="sp-icon-btn" onClick={() => void shareEvent(event)} aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {!tba && !done ? (
          <div className="sp-rail-countdown" aria-live="polite">
            {[
              { lbl: 'Days', val: days },
              { lbl: 'Hrs', val: hours },
              { lbl: 'Min', val: mins },
              { lbl: 'Sec', val: secs },
            ].map((u) => (
              <div key={u.lbl} className="sp-rail-count">
                <strong>{pad2(u.val)}</strong>
                <span>{u.lbl}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="sp-rail-live">{tba ? 'Schedule to be announced' : 'Event is live now'}</p>
        )}

        <div className="sp-rail-when">
          <div>
            <p className="sp-rail-day">{tba ? 'TBA' : format(eventDate, 'd MMM')}</p>
            <p className="sp-rail-time">{tba ? 'Time TBA' : format(eventDate, 'h:mm a')}</p>
          </div>
          {category.name ? <span className="sp-category-chip">{category.name}</span> : null}
        </div>

        <div className="sp-rail-price">
          <span>From</span>
          <strong>{formatFromPrice(tickets)}</strong>
        </div>

        <button type="button" className="sp-cta" onClick={onGetTickets}>
          Get Tickets
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="sp-rail-org">
          <SpotlightOrganizer event={event} />
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
  const label = tba
    ? 'Date TBA'
    : done
      ? 'Event live'
      : `Starts in ${days}d ${pad2(hours)}h ${pad2(mins)}m ${pad2(secs)}s`;

  return (
    <div className="sp-mobilebar">
      <div className="sp-mobilebar-top">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <button type="button" className="sp-mobilebar-share" onClick={() => void shareEvent(event)} aria-label="Share">
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="sp-mobilebar-bottom">
        <div>
          <p className="sp-mobilebar-label">From</p>
          <p className="sp-mobilebar-price">{formatFromPrice(tickets)}</p>
        </div>
        <button type="button" className="sp-cta sp-cta--sm" onClick={onGetTickets}>
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
  const title = event.customization?.heroText?.trim() || event.title;
  const lead = (event.customization?.heroSubtext || '').trim();
  const desc = event.description?.trim() || '';
  const teaser = lead || (desc ? desc.slice(0, 140) : '');
  const category = resolveEventCategory(event.customization?.eventCategory);

  const hasSelection = useMemo(
    () => tickets.some((t) => (selectedTickets[t.id] || 0) > 0),
    [tickets, selectedTickets]
  );

  const handleGetTickets = () => {
    if (hasSelection) onCheckout();
    else scrollTo('landing-tickets');
  };

  return (
    <LandingPageShell event={event} showcase>
      <LandingTopBar event={event} onGetTickets={handleGetTickets} />

      <div className="landing-spotlight">
        <SpotlightHeroBanner event={event} />

        <div className="sp-shell">
          <div className="sp-grid">
            <main className="sp-main">
              {category.name ? (
                <p className="sp-breadcrumb">
                  Events <span>/</span> {category.name}
                </p>
              ) : null}

              <h1 className="sp-title">{title}</h1>
              {teaser ? (
                <p className="sp-teaser">
                  {teaser}
                  {!lead && desc.length > 140 ? (
                    <>
                      {' '}
                      <button type="button" className="sp-inline-link" onClick={() => scrollTo('landing-about')}>
                        See more…
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}

              <SpotlightQuickFacts event={event} />

              <div className="sp-org-mobile">
                <SpotlightOrganizer event={event} />
              </div>

              <div className="sp-sections">
                <SpotlightAbout event={event} />
                <SpotlightPolicies />
                <SpotlightLocation event={event} />

                <section id="landing-tickets" className="sp-block scroll-mt-28">
                  <div className="sp-tickets-head">
                    <h2 className="sp-h2">Choose your tickets</h2>
                    <p className="sp-muted">Select seats, then continue to secure checkout.</p>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="sp-empty">Tickets will appear here when registration opens.</div>
                  ) : (
                    <div className="sp-ticket-list">
                      {tickets.map((ticket) => (
                        <SpotlightTicketRow
                          key={ticket.id}
                          ticket={ticket}
                          qty={selectedTickets[ticket.id] || 0}
                          onChange={(q) => onTicketChange(ticket.id, q)}
                        />
                      ))}
                    </div>
                  )}

                  {hasSelection ? (
                    <div className="sp-checkout-strip">
                      <div>
                        <p className="sp-muted">Order total</p>
                        <p className="sp-checkout-total">
                          {totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="sp-cta sp-cta--sm"
                        onClick={onCheckout}
                        disabled={isPurchasing}
                      >
                        {isPurchasing ? 'Processing…' : 'Continue'}
                        {!isPurchasing ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            </main>

            <SpotlightBookingRail event={event} tickets={tickets} onGetTickets={handleGetTickets} />
          </div>
        </div>

        <SpotlightMobileBar event={event} tickets={tickets} onGetTickets={handleGetTickets} />
        <div className="sp-mobilebar-spacer" aria-hidden />
      </div>

      <LandingFooter event={event} />
    </LandingPageShell>
  );
}
