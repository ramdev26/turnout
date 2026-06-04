import React, { useMemo } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Calendar,
  Check,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  Lock,
} from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  LandingPageShell,
  pad2,
  resolveLandingOrganizerBrand,
  ticketRemaining,
  useCountdown,
} from './LandingShared';
import { formatLKRWhole } from '../../utils/money';

function splitHeroTitle(title: string): { accent: string; main: string } {
  const trimmed = title.trim();
  const colon = trimmed.indexOf(':');
  if (colon > 0 && colon < trimmed.length - 1) {
    return {
      accent: trimmed.slice(0, colon).trim(),
      main: trimmed.slice(colon + 1).trim(),
    };
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= 2) return { accent: trimmed, main: '' };
  const accentWords = Math.min(2, Math.ceil(words.length / 3));
  return {
    accent: words.slice(0, accentWords).join(' '),
    main: words.slice(accentWords).join(' '),
  };
}

function ticketCopy(ticket: EventTicket): { summary: string; perks: string[] } {
  const raw = (ticket.description || 'Full event access').trim();
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { summary: lines[0] || 'Full event access', perks: [] };
  return { summary: lines[0], perks: lines.slice(1) };
}

function sellingFast(tickets: EventTicket[]): boolean {
  return tickets.some((t) => {
    const r = ticketRemaining(t);
    return r > 0 && r <= 24;
  });
}

function ShowcaseHeader({ event, onTickets }: { event: Event; onTickets: () => void }) {
  const brand = resolveLandingOrganizerBrand(event);
  const scroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="landing-showcase-header sticky top-0 z-40">
      <div className="landing-showcase-header-inner mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" referrerPolicy="no-referrer" />
          ) : (
            <span className="landing-showcase-mark">{brand.name.charAt(0).toUpperCase()}</span>
          )}
          <div className="min-w-0 text-left leading-tight">
            <p className="truncate text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--landing-text)' }}>
              {brand.name}
            </p>
            <p className="truncate text-[10px] font-medium" style={{ color: 'var(--landing-text-muted)' }}>
              {event.title}
            </p>
          </div>
        </div>

        <nav className="landing-showcase-nav" aria-label="Event sections">
          <a href="#landing-tickets" className="is-active" onClick={(e) => { e.preventDefault(); scroll('landing-tickets'); }}>
            <Ticket className="h-3.5 w-3.5" />
            Reserve passes
          </a>
          <a href="#landing-about" onClick={(e) => { e.preventDefault(); scroll('landing-about'); }}>
            <Sparkles className="h-3.5 w-3.5" />
            Experience
          </a>
          <a href="#landing-venue" onClick={(e) => { e.preventDefault(); scroll('landing-venue'); }}>
            <MapPin className="h-3.5 w-3.5" />
            Venue
          </a>
        </nav>

        <button type="button" onClick={onTickets} className="landing-showcase-btn-cta shrink-0">
          Get tickets
        </button>
      </div>
    </header>
  );
}

function ShowcaseHero({ event }: { event: Event }) {
  const heroText = event.customization?.heroText?.trim() || event.title;
  const { accent, main } = splitHeroTitle(heroText);
  const subtitle =
    (event.customization?.heroSubtext || event.description || '').trim().slice(0, 320) ||
    'Join us for an unforgettable live experience. Reserve your passes online.';
  const dateStr = event.customization?.scheduleTba
    ? 'Date to be announced'
    : format(new Date(event.date), 'EEEE, MMMM d · h:mm a');
  const hasBanner = !!event.bannerUrl?.trim();

  return (
    <section className="landing-showcase-hero px-4 sm:px-6">
      <span className="landing-showcase-hero-badge">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--showcase-accent)' }} />
        {event.status === 'published' ? 'Now booking passes online' : event.status}
      </span>

      {accent ? <p className="landing-showcase-hero-accent mt-6">{accent}</p> : null}
      <h1 className={`landing-showcase-hero-title ${accent ? 'mt-1' : 'mt-6'}`}>{main || heroText}</h1>
      <p className="landing-showcase-hero-lead">{subtitle}</p>

      <div id="landing-venue" className="landing-showcase-info-grid scroll-mt-28">
        <div className="landing-showcase-info-card">
          <Calendar className="mb-2 h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
          <p className="label">Event date &amp; time</p>
          <p className="value">{dateStr}</p>
        </div>
        <div className="landing-showcase-info-card">
          <MapPin className="mb-2 h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
          <p className="label">Venue</p>
          <p className="value">{event.location || 'Venue to be announced'}</p>
        </div>
      </div>

      {hasBanner ? (
        <div className="landing-showcase-poster landing-poster-frame landing-poster-frame--hero mx-auto w-fit max-w-full">
          <img
            src={event.bannerUrl}
            alt=""
            className="landing-poster-img block rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
    </section>
  );
}

function ShowcaseCountdown({ event, urgent }: { event: Event; urgent?: boolean }) {
  const tba = !!event.customization?.scheduleTba;
  const { days, hours, mins, secs, done } = useCountdown(event.date, !tba);

  if (tba) return null;

  return (
    <div className="landing-showcase-card p-5 sm:p-6">
      <div className="landing-showcase-countdown-head">
        <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
          Countdown to opening
        </p>
        {!done && urgent ? <span className="landing-showcase-urgency">● Selling fast</span> : null}
      </div>
      {done ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
          The event is live — reserve your passes below.
        </p>
      ) : (
        <div className="landing-showcase-countdown-grid">
          {[
            { label: 'Days', value: days },
            { label: 'Hours', value: hours },
            { label: 'Mins', value: mins },
            { label: 'Secs', value: secs },
          ].map((u) => (
            <div key={u.label} className="landing-showcase-countdown-cell">
              <div className="num">{pad2(u.value)}</div>
              <div className="unit">{u.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShowcaseAbout({ event }: { event: Event }) {
  const desc = event.description?.trim();
  if (!desc) return null;

  const tags = [
    event.location ? { icon: MapPin, text: event.location } : null,
    event.customization?.scheduleTba
      ? { icon: Calendar, text: 'Date to be announced' }
      : { icon: Calendar, text: format(new Date(event.date), 'MMM d, yyyy') },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <section id="landing-about" className="scroll-mt-28">
      <h2 className="landing-showcase-section-title">The experience</h2>
      <div className="landing-showcase-card mt-5 p-5 sm:p-7">
        <p className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base" style={{ color: 'var(--landing-text-muted)' }}>
          {desc}
        </p>
        {tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t.text}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--showcase-border)', color: 'var(--landing-text)' }}
              >
                <t.icon className="h-3.5 w-3.5" style={{ color: 'var(--showcase-accent)' }} />
                {t.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ShowcaseTickets({
  tickets,
  selectedTickets,
  onTicketChange,
}: {
  tickets: EventTicket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (id: string, qty: number) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="landing-showcase-card p-8 text-center text-sm" style={{ color: 'var(--landing-text-muted)' }}>
        Registration opens soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tickets.map((ticket) => {
        const remaining = ticketRemaining(ticket);
        const soldOut = remaining <= 0;
        const qty = selectedTickets[ticket.id] || 0;
        const selected = qty > 0;
        const { summary, perks } = ticketCopy(ticket);

        return (
          <div key={ticket.id} className={`landing-showcase-ticket ${selected ? 'is-selected' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: 'var(--showcase-accent-soft)',
                    color: 'var(--showcase-accent)',
                  }}
                >
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold sm:text-base" style={{ color: 'var(--landing-text)' }}>
                      {ticket.name}
                    </h3>
                    {soldOut ? (
                      <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Sold out
                      </span>
                    ) : remaining <= 12 ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: 'var(--showcase-card-muted)', color: 'var(--landing-text-muted)' }}
                      >
                        {remaining} left
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                    {summary}
                  </p>
                  <p className="landing-display mt-2 text-lg sm:text-xl" style={{ color: 'var(--showcase-accent)' }}>
                    {ticket.price <= 0 ? 'Complimentary' : formatLKRWhole(ticket.price)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 sm:pt-1">
                <QtyButton disabled={soldOut || qty <= 0} onClick={() => onTicketChange(ticket.id, qty - 1)}>
                  −
                </QtyButton>
                <span className="w-8 text-center text-lg font-bold tabular-nums" style={{ color: 'var(--landing-text)' }}>
                  {qty}
                </span>
                <QtyButton disabled={soldOut || qty >= remaining} onClick={() => onTicketChange(ticket.id, qty + 1)}>
                  +
                </QtyButton>
              </div>
            </div>
            {perks.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: 'var(--showcase-border)' }}>
                {perks.map((p) => (
                  <li key={p} className="landing-showcase-ticket-perk">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--showcase-accent)' }} />
                    {p}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function QtyButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-bold transition disabled:opacity-35"
      style={{ borderColor: 'var(--showcase-border)', background: 'var(--showcase-card-muted)', color: 'var(--landing-text)' }}
    >
      {children}
    </button>
  );
}

function ShowcaseCheckout({
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

  return (
    <div className="landing-showcase-card overflow-hidden">
      <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--showcase-accent), var(--secondary))' }} />
      <div className="p-5 sm:p-6">
        <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
          Your order
        </p>
        <h3 className="landing-display mt-1 text-2xl" style={{ color: 'var(--landing-text)' }}>
          Summary
        </h3>

        {!hasSelection ? (
          <div className="landing-showcase-cart-empty">
            <Ticket className="mx-auto h-9 w-9 opacity-35" style={{ color: 'var(--landing-text-muted)' }} />
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
              Your cart is empty. Select one or more pass levels below to see your total.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            {lines.map((t) => (
              <div key={t.id} className="flex justify-between gap-3 text-sm">
                <span style={{ color: 'var(--landing-text-muted)' }}>
                  {t.name} ×{selectedTickets[t.id]}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--landing-text)' }}>
                  {formatLKRWhole(t.price * selectedTickets[t.id])}
                </span>
              </div>
            ))}
            <div className="landing-divider-glow my-3" />
            <div className="flex justify-between items-baseline">
              <span className="font-semibold" style={{ color: 'var(--landing-text)' }}>
                Total
              </span>
              <span className="landing-display text-2xl" style={{ color: 'var(--showcase-accent)' }}>
                {totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onCheckout}
          disabled={!hasSelection || isPurchasing}
          className="landing-showcase-btn-cta mt-6 flex w-full min-h-[48px] items-center justify-center gap-2 disabled:opacity-45"
        >
          {isPurchasing ? 'Processing…' : hasSelection ? (totalAmount <= 0 ? 'Complete registration' : 'Proceed to payment') : 'Select passes'}
          {hasSelection && !isPurchasing ? <ArrowRight className="h-4 w-4" /> : null}
        </button>

        <div className="mt-5 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--showcase-border)' }}>
          <p className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--landing-text-muted)' }}>
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
            Verified secure checkout
          </p>
          <p className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--landing-text-muted)' }}>
            <Lock className="h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
            PayHere · LKR · Instant confirmation
          </p>
        </div>
      </div>
    </div>
  );
}

function ShowcasePromo({ event }: { event: Event }) {
  const scrollAbout = () => document.getElementById('landing-about')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div className="landing-showcase-promo">
      <p className="text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
        Plan your visit to {event.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
        Read the full experience details, venue information, and what to expect on the day.
      </p>
      <button
        type="button"
        onClick={scrollAbout}
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold"
        style={{ color: 'var(--showcase-accent)' }}
      >
        View experience
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ShowcaseFooter({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  const year = new Date().getFullYear();
  const scroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="landing-showcase-footer relative z-10">
      <div className="landing-showcase-footer-inner">
        <p className="text-xs sm:text-sm" style={{ color: 'var(--landing-text-muted)' }}>
          Powered by{' '}
          <span className="font-semibold" style={{ color: 'var(--showcase-accent)' }}>
            {brand.name}
          </span>{' '}
          © {year}
        </p>
        <nav className="landing-showcase-footer-links" aria-label="Footer">
          <a href="#landing-tickets" onClick={(e) => { e.preventDefault(); scroll('landing-tickets'); }}>
            Passes
          </a>
          <a href="#landing-about" onClick={(e) => { e.preventDefault(); scroll('landing-about'); }}>
            Experience
          </a>
          <a href="#landing-venue" onClick={(e) => { e.preventDefault(); scroll('landing-venue'); }}>
            Venue
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function LandingShowcasePage(props: LandingTemplateProps) {
  const { event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing } = props;
  const fast = useMemo(() => sellingFast(tickets), [tickets]);
  const scrollTickets = () => document.getElementById('landing-tickets')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <LandingPageShell event={event} showcase>
      <ShowcaseHeader event={event} onTickets={scrollTickets} />
      <ShowcaseHero event={event} />

      <div className="landing-showcase-grid">
        <div className="flex flex-col gap-8 sm:gap-10">
          <ShowcaseCountdown event={event} urgent={fast} />
          <ShowcaseAbout event={event} />
          <section id="landing-tickets" className="scroll-mt-28">
            <h2 className="landing-showcase-section-title">Passes &amp; registration</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              Choose your pass level. Secure checkout powered by PayHere.
            </p>
            <div className="mt-5">
              <ShowcaseTickets tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
            </div>
          </section>
        </div>

        <aside className="landing-showcase-sidebar-sticky">
          <ShowcaseCheckout
            tickets={tickets}
            selectedTickets={selectedTickets}
            totalAmount={totalAmount}
            onCheckout={onCheckout}
            isPurchasing={isPurchasing}
          />
          <ShowcasePromo event={event} />
        </aside>
      </div>

      <ShowcaseFooter event={event} />
    </LandingPageShell>
  );
}
