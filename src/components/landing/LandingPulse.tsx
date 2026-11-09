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

function ensureSentenceEnd(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** Tickets shown on this landing — hide the sibling room’s solo pass. */
function ticketsForTheme(event: Event, tickets: EventTicket[]): EventTicket[] {
  return tickets.filter((t) => {
    if (/both|combo|bundle|pair/i.test(t.name)) return true;
    return !shouldHideSiblingBrand(event, t.name);
  });
}

function roomsFromTickets(event: Event, tickets: EventTicket[]): PulseRoom[] {
  const ctrl = isCtrlTemplate(event);
  const named = tickets.filter(
    (t) => !/both|combo|bundle/i.test(t.name) && !shouldHideSiblingBrand(event, t.name)
  );
  const preferred = named.filter((t) => isPreferredRoomTicket(event, t));
  const source = (preferred.length > 0 ? preferred : named).slice(0, 1);
  if (source.length === 0) return [];
  return source.map((ticket) => {
    const lines = (ticket.description || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const tagsLine = lines.find((l) => /^[A-Z0-9][A-Z0-9\s|/·•-]+$/.test(l) && l.length < 80);
    if (ctrl) {
      const body =
        lines.filter((l) => l !== tagsLine).join(' ') ||
        (event.customization?.heroSubtext || '').trim() ||
        (event.description || '').trim() ||
        'Darker, harder and heavier — late-night club energy until close.';
      return {
        kicker: '11 PM TILL VERY LATE',
        title: ticket.name,
        body,
        tags: (tagsLine || 'DARK  INDUSTRIAL  HEAVY').replace(/[|/·•]+/g, '  ').trim(),
        emphasis: true,
      };
    }
    const body =
      lines.filter((l) => l !== tagsLine).join(' ') ||
      'Groovy, bouncy, bassy — tech house, house and indie dance from 6 PM to 1 AM.';
    return {
      kicker: 'ROOM ONE · 6 PM – 1 AM',
      title: ticket.name,
      body,
      tags: (tagsLine || 'TECH HOUSE  HOUSE  INDIE DANCE').replace(/[|/·•]+/g, '  ').trim(),
      emphasis: true,
    };
  });
}

function resolveRooms(event: Event, tickets: EventTicket[]): PulseRoom[] {
  const ctrl = isCtrlTemplate(event);
  const custom = event.customization?.pulseRooms;
  if (Array.isArray(custom) && custom.length > 0) {
    const cleaned = custom
      .filter(
        (room) => !shouldHideSiblingBrand(event, `${room.kicker || ''} ${room.title || ''} ${room.body || ''}`)
      )
      .slice(0, 1)
      .map((room) => ({
        kicker:
          (room.kicker || '').trim() ||
          (ctrl ? '11 PM TILL VERY LATE' : 'ROOM ONE · 6 PM – 1 AM'),
        title: (room.title || '').trim() || event.title || (ctrl ? 'Club Ctrl' : 'Take My Bass'),
        body: (room.body || '').trim() || 'Details coming soon.',
        tags:
          (room.tags || '').trim() ||
          (ctrl ? 'DARK  INDUSTRIAL  HEAVY' : 'TECH HOUSE  HOUSE  INDIE DANCE'),
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

  if (ctrl) {
    return [
      {
        kicker: '11 PM TILL VERY LATE',
        title: event.title || 'Club Ctrl',
        body:
          (event.description || '').trim() ||
          (event.customization?.heroSubtext || '').trim() ||
          'Darker, harder and heavier — a dedicated late room until close.',
        tags: 'DARK  INDUSTRIAL  HEAVY',
        emphasis: true,
      },
    ];
  }

  return [
    {
      kicker: 'ROOM ONE · 6 PM – 1 AM',
      title: event.title || 'Take My Bass',
      body:
        (event.description || '').trim() ||
        'Our open-air club night energy — tech house, house and indie dance across one dancefloor. Built to move.',
      tags: 'TECH HOUSE  HOUSE  INDIE DANCE',
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

  // Pulse (TMB) keeps the fixed open-air window; Ctrl is the late room.
  if (isCtrlTemplate(event)) {
    return [{ label: title, time: '11 PM till very late' }];
  }
  return [{ label: title, time: '6 PM – 1 AM' }];
}

function resolveStory(event: Event): { kicker: string; title: string; body: string } {
  const short = (event.customization?.heroSubtext || '').trim();
  const desc = (event.description || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !shouldHideSiblingBrand(event, l))
    .join(' ')
    .trim();

  if (isCtrlTemplate(event)) {
    return {
      kicker: 'THE STORY',
      title: ensureSentenceEnd(short || event.title || 'Club Ctrl'),
      body: desc || short || 'More details coming soon.',
    };
  }

  // Pulse / Take My Bass — keep the proven poster story.
  return {
    kicker: 'THE STORY',
    title: 'Back in Colombo.',
    body:
      desc ||
      'From 6 PM. Groovy, bouncy, bassy, hands in the air. Take My Bass returns for a full night of tech house, house and indie dance — built for the floor.',
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

  if (isCtrlTemplate(event)) {
    return [
      { time: '11 PM', label: 'Doors', detail: 'Bunker opens. Dark room online.' },
      { time: '12–2 AM', label: 'Peak hours', detail: 'Dark · industrial · heavy' },
      { time: 'Till late', label: 'Last stretch', detail: 'Stay in the bunker. Hands in the air.' },
    ];
  }

  return [
    { time: '6 PM', label: 'Doors', detail: 'Floor opens. Warm-up begins.' },
    { time: '7–11 PM', label: 'Peak hours', detail: 'Groovy · bouncy · bassy' },
    { time: 'Till 1 AM', label: 'Last stretch', detail: 'Hands in the air. Stay on the floor.' },
  ];
}

function resolveNightSub(event: Event): string {
  if (event.customization?.scheduleTba) return 'Schedule TBA';
  if (isCtrlTemplate(event)) return '11 PM till very late';
  return '6 PM to 1 AM · one floor';
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
  // Pulse keeps its poster tagline; Ctrl uses short description from settings.
  const tagline = ctrlTheme
    ? shortDescription ||
      (storedTagline &&
      !['TWO ROOMS. ONE NIGHT.', 'GROOVY. BOUNCY. BASSY.'].includes(storedTagline.toUpperCase())
        ? storedTagline
        : '') ||
      'DARK. INDUSTRIAL. HEAVY.'
    : storedTagline || 'GROOVY. BOUNCY. BASSY.';

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

  const visibleTickets = useMemo(() => ticketsForTheme(event, tickets), [event, tickets]);
  const rooms = useMemo(() => resolveRooms(event, visibleTickets), [event, visibleTickets]);
  const schedule = useMemo(() => resolveSchedule(event, visibleTickets), [event, visibleTickets]);
  const story = useMemo(() => resolveStory(event), [event]);
  const nightBeats = useMemo(() => resolveNightBeats(event), [event]);
  const nightSub = useMemo(() => resolveNightSub(event), [event]);
  // First release = early bird; Second release = original price.
  // While early bird is on sale, only show the first-release rate (hide original).
  const earlyBirdOnSale = visibleTickets.some((t) => Boolean(t.earlyBird?.active));
  const priceNote =
    (event.customization?.pulsePriceNote || '').trim() ||
    (earlyBirdOnSale
      ? 'First release is limited. Original prices apply after this release ends.'
      : 'Select a room pass below, then continue to checkout.');

  const hasSelection = useMemo(
    () => visibleTickets.some((t) => (selectedTickets[t.id] || 0) > 0),
    [visibleTickets, selectedTickets]
  );

  const handleGetTickets = () => {
    if (hasSelection) onCheckout();
    else scrollTo('landing-tickets');
  };

  const bannerUrl = event.bannerUrl?.trim() || '';

  const fromPriceLabel = useMemo(() => {
    const priced = visibleTickets.map((t) => ticketEffectivePrice(t)).filter((n) => Number.isFinite(n));
    if (priced.length === 0) return '—';
    const lowest = Math.min(...priced);
    return lowest <= 0 ? 'Free' : formatLKRWhole(lowest);
  }, [visibleTickets]);

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
                {visibleTickets.length > 0 ? (
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

            {visibleTickets.length === 0 ? (
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
                  {visibleTickets.map((ticket, index) => {
                    const qty = selectedTickets[ticket.id] || 0;
                    const remaining = ticketRemaining(ticket);
                    const featured = isFeaturedTicket(ticket, index, visibleTickets.length);
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
              <p className="pulse-night-sub">{nightSub}</p>
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
