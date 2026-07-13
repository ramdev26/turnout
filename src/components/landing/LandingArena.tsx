import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  MapPin,
  Navigation,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import { landingCssVars, landingToneIsDark } from '../../themes/eventThemes';
import {
  landingShellStyle,
  pad2,
  resolveLandingOrganizerBrand,
  ticketRemaining,
  useCountdown,
} from './LandingShared';
import { formatLKRWhole } from '../../utils/money';
import { resolveEventCategory } from '../../themes/eventCategories';
import { resolveArenaCarouselSlides } from './arenaGallery';

function ticketIcon(ticket: EventTicket) {
  const name = ticket.name.toLowerCase();
  if (name.includes('vip') || name.includes('private') || name.includes('premium')) return Crown;
  if (name.includes('table') || name.includes('pax') || name.includes('group')) return Users;
  return Ticket;
}

function popularTicketId(tickets: EventTicket[]): string | null {
  const available = tickets.filter((t) => ticketRemaining(t) > 0);
  if (available.length < 2) return null;
  const sorted = [...available].sort((a, b) => b.sold - a.sold);
  if (sorted[0].sold <= 0 && sorted[1].sold <= 0) return available[1]?.id ?? null;
  return sorted[0]?.id ?? null;
}

function ArenaHeader({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  const shortName = brand.name.split(/\s+/)[0]?.toUpperCase() || 'EVENT';

  return (
    <header className="landing-arena-header">
      <div className="landing-arena-header-inner">
        <div className="landing-arena-header-brand">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="landing-arena-header-logo" referrerPolicy="no-referrer" />
          ) : (
            <span className="landing-arena-header-mark">{shortName.slice(0, 3)}</span>
          )}
          <span className="landing-arena-header-divider" aria-hidden />
          <span className="landing-arena-header-label">Tickets</span>
        </div>
      </div>
    </header>
  );
}

function ArenaCarousel({ event }: { event: Event }) {
  const slides = useMemo(() => resolveArenaCarouselSlides(event), [event.bannerUrl, event.customization?.arenaGalleryImages]);
  const [index, setIndex] = useState(0);
  const hasMultiple = slides.length > 1;
  const current = slides[index] ?? null;

  useEffect(() => {
    setIndex((i) => (slides.length === 0 ? 0 : Math.min(i, slides.length - 1)));
  }, [slides.length]);

  const go = (dir: -1 | 1) => {
    if (!hasMultiple) return;
    setIndex((i) => (i + dir + slides.length) % slides.length);
  };

  return (
    <section className="landing-arena-carousel" aria-label="Venue preview">
      <div className="landing-arena-carousel-stage">
        {current ? (
          <img src={current} alt="" className="landing-arena-carousel-img" referrerPolicy="no-referrer" />
        ) : (
          <div className="landing-arena-carousel-placeholder" />
        )}
        {hasMultiple ? (
          <>
            <button type="button" className="landing-arena-carousel-nav landing-arena-carousel-nav--prev" onClick={() => go(-1)} aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" className="landing-arena-carousel-nav landing-arena-carousel-nav--next" onClick={() => go(1)} aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="landing-arena-carousel-dots">
              {slides.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className={`landing-arena-carousel-dot${i === index ? ' is-active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {hasMultiple ? (
        <div className="landing-arena-carousel-thumbs">
          {slides.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`landing-arena-carousel-thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={url} alt="" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ArenaEventIntro({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  const title = event.customization?.heroText?.trim() || event.title;
  const lead = (event.customization?.heroSubtext || '').trim();

  return (
    <div className="landing-arena-intro">
      <p className="landing-arena-organizer">{brand.name.toUpperCase()}</p>
      <h1 className="landing-arena-title">{title}</h1>
      {lead ? <p className="landing-arena-lead">{lead}</p> : null}
    </div>
  );
}

const ARENA_ABOUT_READ_MORE_MIN = 160;

function ArenaAbout({ event }: { event: Event }) {
  const desc = event.description?.trim();
  const [expanded, setExpanded] = useState(false);
  if (!desc) return null;

  const canExpand = desc.length > ARENA_ABOUT_READ_MORE_MIN;

  return (
    <section className="landing-arena-about" id="landing-about">
      <h2 className="landing-arena-about-title">About this event</h2>
      <div className="landing-arena-about-card">
        <p
          className={`landing-arena-about-text${canExpand && !expanded ? ' is-clamped' : ''}`}
        >
          {desc}
        </p>
        {canExpand ? (
          <button
            type="button"
            className="landing-arena-about-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ArenaEventDetailsCard({ event }: { event: Event }) {
  const tba = !!event.customization?.scheduleTba;
  const eventDate = new Date(event.date);
  const { days, hours, mins, secs, done } = useCountdown(event.date, !tba);
  const category = resolveEventCategory(event.customization?.eventCategory);

  const mapsUrl = event.location?.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;

  return (
    <div className="landing-arena-event-card">
      <div className="landing-arena-date-row">
        <div>
          {tba ? (
            <p className="landing-arena-date-day">TBA</p>
          ) : (
            <div className="landing-arena-date-block">
              <span className="landing-arena-date-day">{format(eventDate, 'd')}</span>
              <span className="landing-arena-date-month">{format(eventDate, 'MMM').toUpperCase()}</span>
            </div>
          )}
          <p className="landing-arena-date-sub">
            {tba ? 'Date to be announced' : `${format(eventDate, 'EEEE')} · ${format(eventDate, 'h:mm a')} onwards`}
          </p>
        </div>
      </div>

      <div className="landing-arena-location-row">
        <div className="landing-arena-location-text">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--arena-muted)' }} />
          <span>{event.location || 'Venue to be announced'}</span>
        </div>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="landing-arena-navigate-btn">
            <Navigation className="h-3.5 w-3.5" />
            Navigate
          </a>
        ) : null}
      </div>

      {category.name ? (
        <div className="landing-arena-tags">
          <span className="landing-arena-tag">{category.name}</span>
          <span className="landing-arena-tag">Live event</span>
        </div>
      ) : null}

      {!tba && !done ? (
        <div className="landing-arena-countdown">
          <p className="landing-arena-countdown-label">Doors in</p>
          <div className="landing-arena-countdown-grid">
            {[
              { lbl: 'Days', val: days },
              { lbl: 'Hrs', val: hours },
              { lbl: 'Min', val: mins },
              { lbl: 'Sec', val: secs },
            ].map((u) => (
              <div key={u.lbl} className="landing-arena-countdown-unit">
                <span className="num">{pad2(u.val)}</span>
                <span className="lbl">{u.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArenaTicketCard({
  ticket,
  qty,
  popular,
  onChange,
}: {
  ticket: EventTicket;
  qty: number;
  popular: boolean;
  onChange: (qty: number) => void;
}) {
  const remaining = ticketRemaining(ticket);
  const soldOut = remaining <= 0;
  const Icon = ticketIcon(ticket);
  const desc = (ticket.description || 'Full event access').split('\n')[0]?.trim() || 'Full event access';

  const addOne = () => {
    if (soldOut || qty >= remaining) return;
    onChange(qty + 1);
  };

  return (
    <div className={`landing-arena-ticket${popular ? ' is-popular' : ''}`}>
      {popular ? <span className="landing-arena-popular-badge">Most popular</span> : null}
      <div className="landing-arena-ticket-top">
        <div className="landing-arena-ticket-icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="landing-arena-ticket-body">
          <h3 className="landing-arena-ticket-name">{ticket.name}</h3>
          <p className="landing-arena-ticket-desc">{desc}</p>
          <p className="landing-arena-ticket-price">
            {ticket.price <= 0 ? 'Complimentary' : formatLKRWhole(ticket.price)}
          </p>
        </div>
      </div>
      <div className="landing-arena-ticket-bar">
        <button type="button" className="landing-arena-qty-btn" disabled={soldOut || qty <= 0} onClick={() => onChange(qty - 1)} aria-label="Decrease">
          −
        </button>
        <span className="landing-arena-qty-value">{qty}</span>
        <button type="button" className="landing-arena-qty-btn" disabled={soldOut || qty >= remaining} onClick={() => onChange(qty + 1)} aria-label="Increase">
          +
        </button>
        <button type="button" className="landing-arena-add-btn" disabled={soldOut || qty >= remaining} onClick={addOne}>
          Add
        </button>
      </div>
    </div>
  );
}

function ArenaSummary({
  tickets,
  selectedTickets,
  totalAmount,
  onCheckout,
  isPurchasing,
}: {
  tickets: EventTicket[];
  selectedTickets: Record<string, number>;
  totalAmount: number;
  onCheckout: () => void;
  isPurchasing: boolean;
}) {
  const hasSelection = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);
  const lines = tickets.filter((t) => (selectedTickets[t.id] || 0) > 0);

  if (!hasSelection) return null;

  return (
    <div className="landing-arena-summary">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--arena-muted)' }}>
        Your order
      </p>
      <div className="mt-2 space-y-1.5">
        {lines.map((t) => (
          <div key={t.id} className="flex justify-between gap-2 text-sm">
            <span style={{ color: 'var(--arena-muted)' }}>
              {t.name} ×{selectedTickets[t.id]}
            </span>
            <span className="font-bold tabular-nums">{formatLKRWhole(t.price * selectedTickets[t.id])}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: 'var(--arena-border)' }}>
        <span className="font-bold">Total</span>
        <span className="text-lg font-extrabold tabular-nums">{totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}</span>
      </div>
      <button type="button" className="landing-arena-checkout-btn" onClick={onCheckout} disabled={isPurchasing}>
        {isPurchasing ? 'Processing…' : totalAmount <= 0 ? 'Complete registration' : 'Proceed to payment'}
        {!isPurchasing ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </div>
  );
}

function ArenaTrust() {
  return (
    <section className="landing-arena-trust">
      <div className="landing-arena-payment-row">
        <span>VISA</span>
        <span>MASTERCARD</span>
        <span>AMEX</span>
        <span>PAYHERE</span>
      </div>
      <p className="landing-arena-trust-msg">
        <ShieldCheck className="h-4 w-4" />
        Secure payment, encrypted &amp; processed by PayHere.
      </p>
      <p className="landing-arena-trust-note">
        Your QR code will be available in your confirmation email after checkout.
      </p>
      <div className="landing-arena-help-links">
        <a href="#landing-tickets">Already bought? View my tickets</a>
        <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
          Need support? Text us on WhatsApp
        </a>
      </div>
    </section>
  );
}

function ArenaFooter({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  const year = new Date().getFullYear();

  return (
    <footer className="landing-arena-footer">
      <p className="landing-arena-footer-brand">Powered by {brand.name}</p>
      <p className="landing-arena-footer-copy">
        © {year} {brand.name}. All rights reserved.
      </p>
      <p className="landing-arena-footer-links">
        <a href="/terms">Terms &amp; Conditions</a>
        {' · '}
        <a href="/privacy">Privacy Policy</a>
        {' · '}
        <a href="/refunds">Refund Policy</a>
      </p>
    </footer>
  );
}

export function LandingArenaPage({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
}: LandingTemplateProps) {
  const popularId = useMemo(() => popularTicketId(tickets), [tickets]);
  const tone = landingToneIsDark(event.customization) ? 'dark' : 'light';

  return (
    <div
      className="landing-page landing-showcase landing-arena relative isolate"
      data-landing-tone={tone}
      style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}
    >
      <ArenaHeader event={event} />

      <div className="landing-arena-shell">
        <div className="landing-arena-layout">
          <div className="landing-arena-gallery-col">
            <ArenaCarousel event={event} />
          </div>

          <main className="landing-arena-content-col" id="landing-tickets">
            <ArenaEventIntro event={event} />
            <ArenaEventDetailsCard event={event} />
            <ArenaAbout event={event} />

            <div className="landing-arena-section-head">
              <h2 className="landing-arena-section-title">Select seating</h2>
              <span className="landing-arena-currency">Pay in LKR</span>
            </div>

            {tickets.length === 0 ? (
              <div className="landing-arena-ticket">
                <p className="text-sm" style={{ color: 'var(--arena-muted)' }}>
                  Registration opens soon.
                </p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <ArenaTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  qty={selectedTickets[ticket.id] || 0}
                  popular={ticket.id === popularId}
                  onChange={(q) => onTicketChange(ticket.id, q)}
                />
              ))
            )}

            <ArenaSummary
              tickets={tickets}
              selectedTickets={selectedTickets}
              totalAmount={totalAmount}
              onCheckout={onCheckout}
              isPurchasing={isPurchasing}
            />
          </main>
        </div>

        <div className="landing-arena-bottom">
          <ArenaTrust />
          <ArenaFooter event={event} />
        </div>
      </div>
    </div>
  );
}
