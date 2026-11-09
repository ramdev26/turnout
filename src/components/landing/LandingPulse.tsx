import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import { LandingFooter, LandingPageShell, ticketRemaining } from './LandingShared';
import { formatLKRWhole } from '../../utils/money';
import { ticketEffectivePrice } from '../../utils/ticketPricing';
import {
  isLocationTba,
  resolveEventLocationLabel,
} from '../../utils/eventLocation';

type PulseRoom = {
  kicker: string;
  title: string;
  body: string;
  tags: string;
  emphasis?: boolean;
};

type PulseScheduleLine = {
  label: string;
  time: string;
};

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stackBrand(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [title.trim() || 'Event'];
  if (words.length === 2) return words;
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function splitHeadlineAccent(text: string): { lead: string; accent: string } {
  const trimmed = text.trim();
  if (!trimmed) return { lead: 'TICKETS OPEN', accent: 'NOW.' };
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return { lead: '', accent: words[0] };
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] };
}

function money(n: number): string {
  if (n <= 0) return 'Free';
  return formatLKRWhole(n);
}

function parseRoomsFromDescription(description: string): PulseRoom[] {
  const chunks = description
    .split(/\n\s*---\s*\n|\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (chunks.length < 2) return [];

  return chunks.slice(0, 2).map((chunk, index) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    const kicker = lines[0] || (index === 0 ? 'ROOM ONE' : 'ROOM TWO');
    const title = lines[1] || (index === 0 ? 'Main room' : 'Second room');
    const tagsLine = lines.find((l, i) => i > 1 && /^[A-Z0-9][A-Z0-9\s|/·•-]+$/.test(l) && l.length < 80);
    const bodyLines = lines.slice(2).filter((l) => l !== tagsLine);
    return {
      kicker,
      title,
      body: bodyLines.join(' ') || 'Details coming soon.',
      tags: (tagsLine || '').replace(/[|/·•]+/g, '  ').replace(/\s+/g, ' ').trim(),
      emphasis: index === 1,
    };
  });
}

function roomsFromTickets(tickets: EventTicket[]): PulseRoom[] {
  const named = tickets.filter((t) => !/both/i.test(t.name));
  const source = (named.length >= 2 ? named : tickets).slice(0, 2);
  if (source.length === 0) return [];
  return source.map((ticket, index) => {
    const lines = (ticket.description || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const tagsLine = lines.find((l) => /^[A-Z0-9][A-Z0-9\s|/·•-]+$/.test(l) && l.length < 80);
    const body = lines.filter((l) => l !== tagsLine).join(' ') || 'Full access for this session.';
    return {
      kicker: index === 0 ? 'ROOM ONE' : 'ROOM TWO',
      title: ticket.name,
      body,
      tags: (tagsLine || '').replace(/[|/·•]+/g, '  ').trim(),
      emphasis: index === 1,
    };
  });
}

function resolveRooms(event: Event, tickets: EventTicket[]): PulseRoom[] {
  const custom = event.customization?.pulseRooms;
  if (Array.isArray(custom) && custom.length > 0) {
    return custom.slice(0, 2).map((room, index) => ({
      kicker: (room.kicker || '').trim() || (index === 0 ? 'ROOM ONE' : 'ROOM TWO'),
      title: (room.title || '').trim() || (index === 0 ? 'Main room' : 'Second room'),
      body: (room.body || '').trim() || 'Details coming soon.',
      tags: (room.tags || '').trim(),
      emphasis: room.emphasis ?? index === 1,
    }));
  }
  const fromDesc = parseRoomsFromDescription(event.description || '');
  if (fromDesc.length >= 2) return fromDesc;
  const fromTickets = roomsFromTickets(tickets);
  if (fromTickets.length >= 2) return fromTickets;
  if (fromTickets.length === 1) {
    return [
      fromTickets[0],
      {
        kicker: 'ROOM TWO',
        title: 'After hours',
        body: 'A second room / late session. Add ticket tiers or description blocks to customize this card.',
        tags: 'LATE  HEAVY  DARK',
        emphasis: true,
      },
    ];
  }
  const title = event.title || 'Main room';
  const body = (event.description || '').trim() || 'Open-floor energy. Full night access.';
  return [
    {
      kicker: 'ROOM ONE',
      title,
      body,
      tags: 'MAIN  FLOOR  LIVE',
      emphasis: false,
    },
    {
      kicker: 'ROOM TWO',
      title: 'After hours',
      body: 'A darker late session. Edit your event description (two blocks separated by a blank line) or ticket copy to replace these rooms.',
      tags: 'LATE  HEAVY  DARK',
      emphasis: true,
    },
  ];
}

function resolveSchedule(event: Event, tickets: EventTicket[]): PulseScheduleLine[] {
  const custom = event.customization?.pulseSchedule;
  if (Array.isArray(custom) && custom.length > 0) {
    return custom.slice(0, 2).map((line) => ({
      label: (line.label || '').trim() || 'Session',
      time: (line.time || '').trim() || 'TBA',
    }));
  }

  const tba = !!event.customization?.scheduleTba;
  if (tba) {
    return [
      { label: event.title || 'Doors', time: 'TBA' },
      { label: 'After hours', time: 'TBA' },
    ];
  }

  const start = new Date(event.date);
  const startLabel = Number.isNaN(start.getTime()) ? 'TBA' : format(start, 'h a');
  const named = tickets.filter((t) => !/both/i.test(t.name)).slice(0, 2);
  if (named.length >= 2) {
    return named.map((t, i) => ({
      label: t.name,
      time: i === 0 ? `${startLabel} onwards` : 'Late',
    }));
  }

  return [
    { label: event.title || 'Main event', time: `${startLabel} onwards` },
    { label: 'Doors', time: startLabel },
  ];
}

function isFeaturedTicket(ticket: EventTicket, index: number, total: number): boolean {
  if (/both|combo|bundle|pair/i.test(ticket.name)) return true;
  return total >= 3 && index === total - 1;
}

function PulseQty({
  qty,
  max,
  onChange,
}: {
  qty: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="pulse-qty" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Decrease" disabled={qty <= 0} onClick={() => onChange(Math.max(0, qty - 1))}>
        −
      </button>
      <span>{qty}</span>
      <button
        type="button"
        aria-label="Increase"
        disabled={qty >= max}
        onClick={() => onChange(Math.min(max, qty + 1))}
      >
        +
      </button>
    </div>
  );
}

export function LandingPulsePage({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
}: LandingTemplateProps) {
  const brandLines = stackBrand(event.title || 'Event');
  const eyebrow =
    (event.customization?.pulseEyebrow || '').trim() ||
    (event.customization?.heroSubtext || '').trim() ||
    'LIVE EVENT';
  const headlineRaw =
    (event.customization?.pulseHeadline || '').trim() ||
    (event.customization?.heroText || '').trim() ||
    'TICKETS OPEN NOW.';
  const { lead, accent } = splitHeadlineAccent(headlineRaw);
  const tagline =
    (event.customization?.pulseTagline || '').trim() ||
    'TWO ROOMS. ONE NIGHT.';

  const tba = !!event.customization?.scheduleTba;
  const eventDate = new Date(event.date);
  const weekday = tba || Number.isNaN(eventDate.getTime()) ? 'DATE TBA' : format(eventDate, 'EEEE').toUpperCase();
  const dateLabel = tba || Number.isNaN(eventDate.getTime()) ? 'TBA' : format(eventDate, 'dd.MM.yy');

  const venueTba = isLocationTba(event.customization, event.location);
  const venueValue = venueTba
    ? (event.customization?.pulseVenueNote || '').trim() || 'Announced to ticket holders'
    : resolveEventLocationLabel(event.customization, event.location);
  const cityLine =
    (event.customization?.pulseCityLine || '').trim() ||
    (venueTba ? 'ONE VENUE' : resolveEventLocationLabel(event.customization, event.location).toUpperCase());

  const rooms = useMemo(() => resolveRooms(event, tickets), [event, tickets]);
  const schedule = useMemo(() => resolveSchedule(event, tickets), [event, tickets]);
  // First release = early bird; Second release = original price.
  // While early bird is on sale, only show the first-release rate (hide original).
  const earlyBirdOnSale = tickets.some((t) => Boolean(t.earlyBird?.active));
  const priceNote =
    (event.customization?.pulsePriceNote || '').trim() ||
    (earlyBirdOnSale
      ? 'First release (early bird) is limited. Original prices apply after this release ends.'
      : 'Select a room pass below, then continue to checkout.');

  const hasSelection = useMemo(
    () => tickets.some((t) => (selectedTickets[t.id] || 0) > 0),
    [tickets, selectedTickets]
  );

  const handleGetTickets = () => {
    if (hasSelection) onCheckout();
    else scrollTo('landing-tickets');
  };

  const bannerUrl = event.bannerUrl?.trim() || '';

  const fromPriceLabel = useMemo(() => {
    const priced = tickets.map((t) => ticketEffectivePrice(t)).filter((n) => Number.isFinite(n));
    if (priced.length === 0) return '—';
    const lowest = Math.min(...priced);
    return lowest <= 0 ? 'Free' : formatLKRWhole(lowest);
  }, [tickets]);

  return (
    <LandingPageShell event={event} showcase>
      <div className="landing-pulse">
        <div className="pulse-shell">
          <header className="pulse-header">
            <h1 className="pulse-brand" aria-label={event.title}>
              {brandLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p className="pulse-eyebrow">{eyebrow}</p>
          </header>

          <section className="pulse-hero" aria-label="Event overview">
            <div className="pulse-hero-poster">
              {bannerUrl ? (
                <div className="pulse-poster" aria-label="Event cover">
                  <img
                    src={bannerUrl}
                    alt=""
                    className="pulse-poster-img"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="pulse-poster pulse-poster--empty" aria-hidden>
                  <p className="pulse-poster-fallback">{event.title || 'Event'}</p>
                </div>
              )}
            </div>

            <div className="pulse-hero-rail">
              <div className="pulse-hero-copy">
                <p className="pulse-headline landing-type-h1">
                  {lead ? (
                    <>
                      {lead}{' '}
                      <span className="pulse-headline-accent">{accent}</span>
                    </>
                  ) : (
                    <span className="pulse-headline-accent">{accent}</span>
                  )}
                </p>
                <p className="pulse-tagline">{tagline}</p>
              </div>

              <div className="pulse-meta">
                <div>
                  <p className="pulse-weekday">{weekday}</p>
                  <p className="pulse-date">
                    {dateLabel}
                    {!tba && dateLabel.includes('.') ? <span className="pulse-date-mark" aria-hidden /> : null}
                  </p>
                </div>

                <hr className="pulse-rule" />

                <div className="pulse-schedule">
                  {schedule.map((line) => (
                    <div key={`${line.label}-${line.time}`}>
                      <p className="pulse-schedule-label">{line.label}</p>
                      <p className="pulse-schedule-time">{line.time}</p>
                    </div>
                  ))}
                </div>

                <hr className="pulse-rule" />

                <div>
                  <p className="pulse-venue-label">Venue</p>
                  <p className="pulse-venue-value">{venueValue}</p>
                </div>

                <p className="pulse-city">{cityLine}</p>
              </div>

              <div className="pulse-hero-actions">
                <button type="button" className="pulse-cta pulse-cta--inline landing-type-button" onClick={handleGetTickets}>
                  Get tickets →
                </button>
                {tickets.length > 0 ? (
                  <p className="pulse-hero-from">
                    From <strong>{fromPriceLabel}</strong>
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="pulse-rooms-wrap" aria-label="Rooms">
            <div className="pulse-rooms">
              {rooms.map((room) => (
                <article
                  key={`${room.kicker}-${room.title}`}
                  className={room.emphasis ? 'pulse-room pulse-room--accent' : 'pulse-room'}
                >
                  <p className="pulse-room-kicker">{room.kicker}</p>
                  <h2 className="pulse-room-title landing-type-h2">{room.title}</h2>
                  <p className="pulse-room-body">{room.body}</p>
                  {room.tags ? (
                    <>
                      <hr className="pulse-room-rule" />
                      <p className="pulse-room-tags">{room.tags}</p>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section id="landing-tickets" className="pulse-prices scroll-mt-24" aria-label="Prices">
            <div className="pulse-prices-head">
              <h2 className="pulse-prices-title">Prices</h2>
              <p className="pulse-prices-currency">LKR · Per person</p>
            </div>

            {tickets.length === 0 ? (
              <div className="pulse-empty">Tickets will appear here when sales open.</div>
            ) : (
              <table className="pulse-table">
                <thead>
                  <tr>
                    <th scope="col">Room</th>
                    {earlyBirdOnSale ? (
                      <th scope="col">
                        <span className="pulse-th-sale">
                          <span className="pulse-onsale">On sale</span>
                          <span>First release</span>
                        </span>
                      </th>
                    ) : (
                      <th scope="col">Price</th>
                    )}
                    <th scope="col">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket, index) => {
                    const qty = selectedTickets[ticket.id] || 0;
                    const remaining = ticketRemaining(ticket);
                    const featured = isFeaturedTicket(ticket, index, tickets.length);
                    const ticketEarlyActive = Boolean(ticket.earlyBird?.active);
                    const displayPrice = ticketEarlyActive
                      ? ticketEffectivePrice(ticket)
                      : ticket.price;
                    const priceLabel = earlyBirdOnSale
                      ? ticketEarlyActive
                        ? 'First release'
                        : 'Price'
                      : 'Price';
                    return (
                      <tr
                        key={ticket.id}
                        className={[
                          featured ? 'pulse-row--featured' : '',
                          qty > 0 ? 'pulse-row--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <td data-label="Room">
                          <div className="pulse-row-name">{ticket.name}</div>
                          {remaining <= 0 ? (
                            <div className="pulse-schedule-time">Sold out</div>
                          ) : null}
                        </td>
                        <td data-label={priceLabel}>
                          <div className="pulse-price-select">
                            <span className="pulse-price">{money(displayPrice)}</span>
                            {earlyBirdOnSale && ticketEarlyActive ? (
                              <span className="pulse-price-hint">Early bird</span>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="Select">
                          {remaining > 0 ? (
                            <PulseQty
                              qty={qty}
                              max={remaining}
                              onChange={(next) => onTicketChange(ticket.id, next)}
                            />
                          ) : (
                            <span className="pulse-schedule-time">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <p className="pulse-prices-note">{priceNote}</p>
          </section>

          <div className="pulse-cta-row pulse-cta-row--desktop">
            <button
              type="button"
              className="pulse-cta landing-type-button"
              onClick={handleGetTickets}
              disabled={isPurchasing}
            >
              {isPurchasing ? 'Processing…' : hasSelection ? 'Checkout →' : 'Get tickets →'}
            </button>
            {hasSelection ? (
              <p className="pulse-total">
                Total <strong>{totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}</strong>
              </p>
            ) : null}
          </div>
        </div>

        <div className="pulse-mobilebar" role="region" aria-label="Ticket checkout">
          <div className="pulse-mobilebar-meta">
            <p className="pulse-mobilebar-label">{hasSelection ? 'Total' : 'From'}</p>
            <p className="pulse-mobilebar-price">
              {hasSelection
                ? totalAmount <= 0
                  ? 'Free'
                  : formatLKRWhole(totalAmount)
                : fromPriceLabel}
            </p>
          </div>
          <button
            type="button"
            className="pulse-cta pulse-cta--bar landing-type-button"
            onClick={handleGetTickets}
            disabled={isPurchasing}
          >
            {isPurchasing ? 'Processing…' : hasSelection ? 'Checkout →' : 'Get tickets →'}
          </button>
        </div>
      </div>
      <LandingFooter event={event} />
      <div className="pulse-mobilebar-spacer" aria-hidden />
    </LandingPageShell>
  );
}
