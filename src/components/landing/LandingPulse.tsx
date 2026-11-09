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

function isClubCtrlCopy(text: string): boolean {
  return /club\s*ctrl/i.test(text);
}

function isTakeMyBassCopy(text: string): boolean {
  return /take\s*my\s*bass/i.test(text);
}

function isCtrlTemplate(event: Event): boolean {
  return event.templateId === 'template-12';
}

/** Pulse (TMB) hides Club Ctrl room copy; Ctrl theme hides Take My Bass room copy. */
function shouldHideSiblingBrand(event: Event, text: string): boolean {
  return isCtrlTemplate(event) ? isTakeMyBassCopy(text) : isClubCtrlCopy(text);
}

function isPreferredRoomTicket(event: Event, ticket: EventTicket): boolean {
  if (/both|combo|bundle/i.test(ticket.name)) return false;
  if (isCtrlTemplate(event)) {
    return isClubCtrlCopy(ticket.name);
  }
  return isTakeMyBassCopy(ticket.name);
}

function roomsFromTickets(event: Event, tickets: EventTicket[]): PulseRoom[] {
  const named = tickets.filter(
    (t) => !/both|combo|bundle/i.test(t.name) && !shouldHideSiblingBrand(event, t.name)
  );
  const preferred = named.filter((t) => isPreferredRoomTicket(event, t));
  const source = (preferred.length > 0 ? preferred : named).slice(0, 1);
  if (source.length === 0) return [];
  return source.map((ticket) => {
    const lines = (ticket.description || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const tagsLine = lines.find((l) => /^[A-Z0-9][A-Z0-9\s|/·•-]+$/.test(l) && l.length < 80);
    const body =
      lines.filter((l) => l !== tagsLine).join(' ') ||
      (event.customization?.heroSubtext || '').trim() ||
      (event.description || '').trim() ||
      'Details coming soon.';
    return {
      kicker: formatSessionKicker(event),
      title: ticket.name,
      body,
      tags: (tagsLine || '').replace(/[|/·•]+/g, '  ').trim(),
      emphasis: true,
    };
  });
}

function ensureSentenceEnd(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function formatSessionKicker(event: Event): string {
  if (event.customization?.scheduleTba) return 'TIME TBA';
  const d = new Date(event.date);
  if (Number.isNaN(d.getTime())) return 'SESSION';
  return format(d, 'h a').replace(/\s+/g, ' ').toUpperCase();
}

function formatScheduleTime(event: Event): string {
  if (event.customization?.scheduleTba) return 'TBA';
  const d = new Date(event.date);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return format(d, 'h:mm a').replace(':00', '').toUpperCase();
}

function resolveRooms(event: Event, tickets: EventTicket[]): PulseRoom[] {
  const custom = event.customization?.pulseRooms;
  if (Array.isArray(custom) && custom.length > 0) {
    const cleaned = custom
      .filter(
        (room) => !shouldHideSiblingBrand(event, `${room.kicker || ''} ${room.title || ''} ${room.body || ''}`)
      )
      .slice(0, 1)
      .map((room) => ({
        kicker: (room.kicker || '').trim() || formatSessionKicker(event),
        title: (room.title || '').trim() || event.title || 'Room',
        body:
          (room.body || '').trim() ||
          (event.customization?.heroSubtext || '').trim() ||
          (event.description || '').trim() ||
          'Details coming soon.',
        tags: (room.tags || '').trim(),
        emphasis: true,
      }));
    if (cleaned.length > 0) return cleaned;
  }

  const fromDesc = parseRoomsFromDescription(event.description || '').filter(
    (room) => !shouldHideSiblingBrand(event, `${room.kicker} ${room.title} ${room.body}`)
  );
  if (fromDesc.length > 0) return [fromDesc[0]];

  const fromTickets = roomsFromTickets(event, tickets);
  if (fromTickets.length > 0) return fromTickets;

  const title = event.title || 'Room';
  return [
    {
      kicker: formatSessionKicker(event),
      title,
      body:
        (event.description || '').trim() ||
        (event.customization?.heroSubtext || '').trim() ||
        'Details coming soon.',
      tags: '',
      emphasis: true,
    },
  ];
}

function resolveSchedule(event: Event, _tickets: EventTicket[]): PulseScheduleLine[] {
  const custom = event.customization?.pulseSchedule;
  if (Array.isArray(custom) && custom.length > 0) {
    return custom
      .filter((line) => !shouldHideSiblingBrand(event, `${line.label || ''} ${line.time || ''}`))
      .slice(0, 2)
      .map((line) => ({
        label: (line.label || '').trim() || 'Session',
        time: (line.time || '').trim() || 'TBA',
      }));
  }

  const tba = !!event.customization?.scheduleTba;
  const title = event.title || 'Doors';
  if (tba) {
    return [{ label: title, time: 'TBA' }];
  }

  return [{ label: title, time: formatScheduleTime(event) }];
}

function resolveStory(event: Event): { kicker: string; title: string; body: string } {
  const short = (event.customization?.heroSubtext || '').trim();
  const desc = (event.description || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !shouldHideSiblingBrand(event, l))
    .join(' ')
    .trim();
  return {
    kicker: 'THE STORY',
    // Prefer short description from settings; else event title — never invent theme copy.
    title: ensureSentenceEnd(short || event.title || 'The night'),
    body: desc || short || 'More details coming soon.',
  };
}

type PulseBeat = { time: string; label: string; detail: string };

function resolveNightBeats(event: Event): PulseBeat[] {
  const custom = event.customization?.pulseSchedule;
  if (Array.isArray(custom) && custom.length >= 2) {
    return custom
      .filter((line) => !shouldHideSiblingBrand(event, `${line.label || ''} ${line.time || ''}`))
      .slice(0, 4)
      .map((line) => ({
        time: (line.time || '').trim() || 'TBA',
        label: (line.label || '').trim() || 'Session',
        detail: 'On the floor',
      }));
  }
  return [
    { time: '6 PM', label: 'Doors', detail: 'Floor opens. Warm-up begins.' },
    { time: '7–11 PM', label: 'Peak hours', detail: 'Groovy · bouncy · bassy' },
    { time: 'Till 1 AM', label: 'Last stretch', detail: 'Hands in the air. Stay on the floor.' },
  ];
}

const SAFE_SPACE_RULES = [
  'Everyone is welcome. Make someone feel unwelcome and you’re not.',
  'No violence. Start something and the night ends for you.',
  'Consent is the only vibe. Not a clear yes? It’s a no.',
  'Crew with arm bands on the floor. Find one any time.',
  'Ask the bar for Pine Apple. Staff help, no questions asked.',
];

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
  const ctrlTheme = isCtrlTemplate(event);
  const brandLines = stackBrand(event.title || 'Event');
  const headerLinkLabel =
    (event.customization?.pulseHeaderLinkLabel || '').trim() ||
    (event.customization?.pulseEyebrow || '').trim() ||
    (ctrlTheme ? 'Access Take My Bass' : 'Access Club Ctrl');
  const headerLinkUrl = (event.customization?.pulseHeaderLink || '').trim();
  const storedHeadline = (event.customization?.pulseHeadline || '').trim();
  // Prefer event title over the old template default “TICKETS OPEN NOW.”
  const headlineRaw =
    (storedHeadline && storedHeadline.toUpperCase() !== 'TICKETS OPEN NOW.'
      ? storedHeadline
      : '') ||
    (event.title || '').trim() ||
    'TICKETS OPEN NOW.';
  const { lead, accent } = splitHeadlineAccent(headlineRaw);
  const shortDescription = (event.customization?.heroSubtext || '').trim();
  const storedTagline = (event.customization?.pulseTagline || '').trim();
  // Prefer short description from Event Settings over stale template defaults.
  const templateTaglineDefaults = new Set(['TWO ROOMS. ONE NIGHT.', 'GROOVY. BOUNCY. BASSY.']);
  const tagline =
    (storedTagline && !templateTaglineDefaults.has(storedTagline.toUpperCase())
      ? storedTagline
      : '') ||
    shortDescription ||
    storedTagline ||
    'TICKETS ON SALE.';

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
    (venueTba ? 'COLOMBO' : resolveEventLocationLabel(event.customization, event.location).toUpperCase());

  const rooms = useMemo(() => resolveRooms(event, tickets), [event, tickets]);
  const schedule = useMemo(() => resolveSchedule(event, tickets), [event, tickets]);
  const story = useMemo(() => resolveStory(event), [event]);
  const nightBeats = useMemo(() => resolveNightBeats(event), [event]);
  // First release = early bird; Second release = original price.
  // While early bird is on sale, only show the first-release rate (hide original).
  const earlyBirdOnSale = tickets.some((t) => Boolean(t.earlyBird?.active));
  const priceNote =
    (event.customization?.pulsePriceNote || '').trim() ||
    (earlyBirdOnSale
      ? 'First release is limited. Original prices apply after this release ends.'
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
      <div className={ctrlTheme ? 'landing-pulse landing-pulse--ctrl' : 'landing-pulse'}>
        <div className="pulse-shell">
          <header className="pulse-header">
            <h1 className="pulse-brand" aria-label={event.title}>
              {brandLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            {headerLinkUrl ? (
              <a
                className="pulse-eyebrow pulse-eyebrow-link"
                href={headerLinkUrl}
                target={/^https?:\/\//i.test(headerLinkUrl) ? '_blank' : undefined}
                rel={/^https?:\/\//i.test(headerLinkUrl) ? 'noopener noreferrer' : undefined}
              >
                <span>{headerLinkLabel}</span>
                <span className="pulse-eyebrow-arrow" aria-hidden>
                  →
                </span>
              </a>
            ) : (
              <p className="pulse-eyebrow pulse-eyebrow-link">
                <span>{headerLinkLabel}</span>
                <span className="pulse-eyebrow-arrow" aria-hidden>
                  →
                </span>
              </p>
            )}
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

          <section className="pulse-story" aria-label="About the night">
            <p className="pulse-story-kicker">{story.kicker}</p>
            <h2 className="pulse-story-title landing-type-h2">{story.title}</h2>
            <p className="pulse-story-body">{story.body}</p>
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
                          <div className="pulse-row-name-block">
                            <div className="pulse-row-heading">
                              <div className="pulse-row-name">{ticket.name}</div>
                              {featured ? <span className="pulse-best-value">Best value</span> : null}
                            </div>
                            {featured ? (
                              <div className="pulse-row-sub">
                                {ctrlTheme ? '(Club Ctrl + Take My Bass)' : '(Take My Bass + Club Ctrl)'}
                              </div>
                            ) : null}
                          </div>
                          {remaining <= 0 ? (
                            <div className="pulse-schedule-time">Sold out</div>
                          ) : null}
                        </td>
                        <td data-label={priceLabel}>
                          <span className="pulse-price">{money(displayPrice)}</span>
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

          <section className="pulse-night" aria-label="How the night runs">
            <div className="pulse-night-head">
              <h2 className="pulse-night-title">How the night runs</h2>
              <p className="pulse-night-sub">
                {tba ? 'Schedule TBA' : `${formatScheduleTime(event)} start`}
              </p>
            </div>
            <ol className="pulse-beats">
              {nightBeats.map((beat) => (
                <li key={`${beat.time}-${beat.label}`} className="pulse-beat">
                  <p className="pulse-beat-time">{beat.time}</p>
                  <div>
                    <p className="pulse-beat-label">{beat.label}</p>
                    <p className="pulse-beat-detail">{beat.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="pulse-rooms-wrap" aria-label="The session">
            <div className="pulse-rooms pulse-rooms--single">
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

          <section className="pulse-safe" aria-label="Safe space">
            <div className="pulse-safe-head">
              <p className="pulse-safe-kicker">Safe space</p>
              <h2 className="pulse-safe-title landing-type-h2">Everyone is welcome.</h2>
              <p className="pulse-safe-lead">Zero tolerance for harassment. Look after each other on the floor.</p>
            </div>
            <ol className="pulse-safe-list">
              {SAFE_SPACE_RULES.map((rule, index) => (
                <li key={rule} className="pulse-safe-item">
                  <span className="pulse-safe-num">{index + 1}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="pulse-close" aria-label="Closing">
            <p className="pulse-close-kicker">The night</p>
            <h2 className="pulse-close-title landing-type-h2">
              Hands in the air. <span className="pulse-headline-accent">Stay on the floor.</span>
            </h2>
            <p className="pulse-close-body">
              First release is limited. Grab your pass and we’ll see you on the dancefloor.
            </p>
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
