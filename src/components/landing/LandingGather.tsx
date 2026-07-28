import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, MapPin, Minus, Plus, Video } from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  EventGalleryStrip,
  LandingFooter,
  LandingPageShell,
  LandingTopBar,
  resolveLandingOrganizerBrand,
  ticketRemaining,
} from './LandingShared';
import { formatLKRWhole } from '../../utils/money';
import { resolveEventCategory } from '../../themes/eventCategories';
import { isOnlineEvent, onlinePlatformLabel, resolveOnlinePlatform } from '../../utils/eventLocation';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function GatherHeroImage({ event }: { event: Event }) {
  const url = event.bannerUrl?.trim();
  if (!url) {
    return <div className="gt-hero gt-hero--fallback" aria-hidden />;
  }
  return (
    <div className="gt-hero">
      <img src={url} alt="" className="gt-hero-img" referrerPolicy="no-referrer" />
    </div>
  );
}

function GatherHost({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  return (
    <div className="gt-host">
      <p className="gt-host-label">Hosted By</p>
      <div className="gt-host-row">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="gt-host-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="gt-host-mark">{brand.name.charAt(0).toUpperCase()}</span>
        )}
        <p className="gt-host-name">{brand.name}</p>
      </div>
    </div>
  );
}

function GatherHostInline({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  return (
    <div className="gt-host-inline">
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="gt-host-avatar gt-host-avatar--sm" referrerPolicy="no-referrer" />
      ) : (
        <span className="gt-host-mark gt-host-mark--sm">{brand.name.charAt(0).toUpperCase()}</span>
      )}
      <p>
        Hosted by <span>{brand.name}</span>
      </p>
    </div>
  );
}

function GatherDateBadge({ event }: { event: Event }) {
  const tba = !!event.customization?.scheduleTba;
  const d = new Date(event.date);
  if (tba) {
    return (
      <div className="gt-meta-row">
        <span className="gt-date-badge" aria-hidden>
          <CalendarDays className="h-4 w-4" />
        </span>
        <div>
          <p className="gt-meta-title">Date to be announced</p>
          <p className="gt-meta-sub">Schedule coming soon</p>
        </div>
      </div>
    );
  }
  return (
    <div className="gt-meta-row">
      <span className="gt-date-badge" aria-hidden>
        <span className="gt-date-month">{format(d, 'MMM').toUpperCase()}</span>
        <span className="gt-date-day">{format(d, 'd')}</span>
      </span>
      <div>
        <p className="gt-meta-title">{format(d, 'EEEE, MMMM d')}</p>
        <p className="gt-meta-sub">{format(d, 'h:mm a')}</p>
      </div>
    </div>
  );
}

function GatherLocation({ event }: { event: Event }) {
  const location = event.location?.trim() || 'Venue to be announced';
  const online = isOnlineEvent(event.customization, event.location);
  const Icon = online ? Video : MapPin;
  const sub = online
    ? `Online · ${onlinePlatformLabel(resolveOnlinePlatform(event.customization))}`
    : 'In person';
  return (
    <div className="gt-meta-row">
      <span className="gt-loc-badge" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="gt-meta-title">{location}</p>
        <p className="gt-meta-sub">{sub}</p>
      </div>
    </div>
  );
}

function GatherSocialProof({ tickets }: { tickets: EventTicket[] }) {
  const sold = tickets.reduce((sum, t) => sum + Math.max(0, t.sold || 0), 0);
  if (sold <= 0) {
    return (
      <div className="gt-proof">
        <p className="gt-proof-count">Be among the first</p>
        <p className="gt-proof-names">Registration is open — reserve your spot.</p>
      </div>
    );
  }
  const initials = Array.from({ length: Math.min(5, sold) }, (_, i) => String.fromCharCode(65 + (i % 26)));
  return (
    <div className="gt-proof">
      <p className="gt-proof-count">{sold} Went</p>
      <div className="gt-faces" aria-hidden>
        {initials.map((ch, i) => (
          <span key={`${ch}-${i}`} className="gt-face" style={{ zIndex: 10 - i }}>
            {ch}
          </span>
        ))}
      </div>
      <p className="gt-proof-names">
        {sold === 1 ? '1 guest registered' : `${sold} guests registered for this event`}
      </p>
    </div>
  );
}

function GatherRegisterCard({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
}: LandingTemplateProps) {
  const tba = !!event.customization?.scheduleTba;
  const ended = !tba && new Date(event.date).getTime() < Date.now();
  const hasSelection = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);
  const available = tickets.some((t) => ticketRemaining(t) > 0);

  return (
    <div id="landing-tickets" className="gt-register scroll-mt-28">
      <div className="gt-register-status">
        <CalendarDays className="h-3.5 w-3.5" />
        {ended
          ? 'Past event — registration is closed'
          : available
            ? 'Registration open'
            : 'Sold out'}
      </div>

      <div className="gt-register-body">
        <p className="gt-register-lead">
          {ended
            ? 'This event has ended. Check back for future dates from the host.'
            : 'Welcome! Select your tickets below to secure your spot.'}
        </p>

        {!ended && tickets.length > 0 ? (
          <div className="gt-ticket-list">
            {tickets.map((ticket) => {
              const remaining = ticketRemaining(ticket);
              const qty = selectedTickets[ticket.id] || 0;
              const soldOut = remaining <= 0;
              return (
                <div key={ticket.id} className="gt-ticket">
                  <div className="gt-ticket-info">
                    <p className="gt-ticket-name">{ticket.name}</p>
                    <p className="gt-ticket-price">
                      {soldOut ? 'Sold out' : ticket.price <= 0 ? 'Free' : formatLKRWhole(ticket.price)}
                    </p>
                  </div>
                  <div className="gt-qty">
                    <button
                      type="button"
                      className="gt-qty-btn"
                      disabled={soldOut || qty <= 0}
                      onClick={() => onTicketChange(ticket.id, qty - 1)}
                      aria-label={`Decrease ${ticket.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="gt-qty-val">{qty}</span>
                    <button
                      type="button"
                      className="gt-qty-btn"
                      disabled={soldOut || qty >= remaining}
                      onClick={() => onTicketChange(ticket.id, qty + 1)}
                      aria-label={`Increase ${ticket.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {!ended && hasSelection ? (
          <p className="gt-register-total">
            Total <strong>{totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}</strong>
          </p>
        ) : null}

        <button
          type="button"
          className="gt-cta"
          disabled={ended || isPurchasing || !hasSelection}
          onClick={onCheckout}
        >
          {ended
            ? 'Event ended'
            : isPurchasing
              ? 'Processing…'
              : hasSelection
                ? totalAmount <= 0
                  ? 'Register'
                  : 'Get Tickets'
                : available
                  ? 'Select tickets'
                  : 'Sold out'}
        </button>
      </div>
    </div>
  );
}

function GatherAbout({ event }: { event: Event }) {
  const desc = event.description?.trim();
  const lead = (event.customization?.heroSubtext || '').trim();
  if (!desc && !lead) return null;

  return (
    <section id="landing-about" className="gt-about scroll-mt-28">
      <p className="gt-about-eyebrow">About Event</p>
      {lead ? <p className="gt-about-lead">{lead}</p> : null}
      {desc ? <div className="gt-about-body">{desc}</div> : null}
    </section>
  );
}

function GatherSidebarExtras({ event, tickets }: { event: Event; tickets: EventTicket[] }) {
  const category = resolveEventCategory(event.customization?.eventCategory);
  const brand = resolveLandingOrganizerBrand(event);

  return (
    <div className="gt-aside-extras">
      <GatherSocialProof tickets={tickets} />
      <div className="gt-aside-links">
        <a
          className="gt-text-link"
          href={`mailto:?subject=${encodeURIComponent(`About ${event.title}`)}&body=${encodeURIComponent(`Hi ${brand.name},\n\n`)}`}
        >
          Contact the Host
        </a>
      </div>
      {category.name ? <span className="gt-tag"># {category.name}</span> : null}
    </div>
  );
}

export function LandingGatherPage(props: LandingTemplateProps) {
  const { event, tickets } = props;
  const title = event.customization?.heroText?.trim() || event.title;

  const handleGetTickets = () => {
    const hasSelection = tickets.some((t) => (props.selectedTickets[t.id] || 0) > 0);
    if (hasSelection) props.onCheckout();
    else scrollTo('landing-tickets');
  };

  return (
    <LandingPageShell event={event} showcase>
      <LandingTopBar event={event} onGetTickets={handleGetTickets} />

      <div className="landing-gather">
        <div className="gt-shell">
          {/* Desktop: left rail / Mobile: stacked order via CSS */}
          <aside className="gt-aside">
            <GatherHeroImage event={event} />
            <EventGalleryStrip event={event} className="px-3" />
            <div className="gt-aside-desktop-only">
              <GatherHost event={event} />
              <GatherSidebarExtras event={event} tickets={tickets} />
            </div>
          </aside>

          <main className="gt-main">
            <h1 className="gt-title">{title}</h1>
            <div className="gt-mobile-only">
              <GatherHostInline event={event} />
            </div>

            <div className="gt-meta">
              <GatherDateBadge event={event} />
              <GatherLocation event={event} />
            </div>

            <GatherRegisterCard {...props} />
            <GatherAbout event={event} />

            <div className="gt-mobile-only gt-mobile-footer-block">
              <GatherHost event={event} />
              <GatherSidebarExtras event={event} tickets={tickets} />
            </div>
          </main>
        </div>
      </div>

      <LandingFooter event={event} />
    </LandingPageShell>
  );
}
