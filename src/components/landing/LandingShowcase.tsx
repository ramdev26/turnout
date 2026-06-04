import React, { useMemo } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  Flame,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  Lock,
  TrendingUp,
} from 'lucide-react';
import type { Event, Ticket as EventTicket } from '../../types';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  formatLandingEventDate,
  isLandingScheduleTba,
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

type TicketPulse = {
  totalCapacity: number;
  totalSold: number;
  totalRemaining: number;
  soldOutCount: number;
  soldOutNames: string[];
  lowStock: { name: string; remaining: number }[];
  percentSold: number;
  allSoldOut: boolean;
  hasTickets: boolean;
};

function computeTicketPulse(tickets: EventTicket[] | null | undefined): TicketPulse {
  const list = Array.isArray(tickets) ? tickets : [];
  let totalCapacity = 0;
  let totalSold = 0;
  const soldOutNames: string[] = [];
  const lowStock: { name: string; remaining: number }[] = [];

  for (const t of list) {
    const cap = Math.max(0, t.quantity);
    const sold = Math.min(cap, Math.max(0, t.sold));
    totalCapacity += cap;
    totalSold += sold;
    const remaining = Math.max(0, cap - sold);
    if (cap > 0 && remaining <= 0) soldOutNames.push(t.name);
    else if (remaining > 0 && remaining <= 15) lowStock.push({ name: t.name, remaining });
  }

  const totalRemaining = Math.max(0, totalCapacity - totalSold);

  return {
    totalCapacity,
    totalSold,
    totalRemaining,
    soldOutCount: soldOutNames.length,
    soldOutNames,
    lowStock: lowStock.sort((a, b) => a.remaining - b.remaining).slice(0, 3),
    percentSold: totalCapacity > 0 ? Math.min(100, Math.round((totalSold / totalCapacity) * 100)) : 0,
    allSoldOut: totalCapacity > 0 && totalRemaining <= 0,
    hasTickets: list.length > 0,
  };
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
  const dateStr = isLandingScheduleTba(event)
    ? 'Date to be announced'
    : formatLandingEventDate(event.date, 'EEEE, MMMM d · h:mm a');
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
  const tba = isLandingScheduleTba(event);
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
    isLandingScheduleTba(event)
      ? { icon: Calendar, text: 'Date to be announced' }
      : { icon: Calendar, text: formatLandingEventDate(event.date, 'MMM d, yyyy') },
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
    <div className="landing-showcase-ticket-list flex flex-col gap-2 sm:gap-3">
      {tickets.map((ticket) => {
        const remaining = ticketRemaining(ticket);
        const soldOut = remaining <= 0;
        const qty = selectedTickets[ticket.id] || 0;
        const selected = qty > 0;
        const { summary, perks } = ticketCopy(ticket);

        return (
          <div key={ticket.id} className={`landing-showcase-ticket ${selected ? 'is-selected' : ''}`}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="landing-showcase-ticket-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10"
                style={{
                  background: 'var(--showcase-accent-soft)',
                  color: 'var(--showcase-accent)',
                }}
              >
                <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-sm font-bold leading-tight sm:text-base" style={{ color: 'var(--landing-text)' }}>
                    {ticket.name}
                  </h3>
                  <p className="landing-display text-sm font-semibold leading-tight sm:text-lg" style={{ color: 'var(--showcase-accent)' }}>
                    {ticket.price <= 0 ? 'Free' : formatLKRWhole(ticket.price)}
                  </p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="line-clamp-1 text-[11px] leading-snug sm:text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                    {summary}
                  </p>
                  {soldOut ? (
                    <span className="rounded-full bg-neutral-900 px-1.5 py-px text-[9px] font-bold uppercase text-white sm:px-2 sm:py-0.5 sm:text-[10px]">
                      Sold out
                    </span>
                  ) : remaining <= 12 ? (
                    <span
                      className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase sm:px-2 sm:py-0.5 sm:text-[10px]"
                      style={{ background: 'var(--showcase-card-muted)', color: 'var(--landing-text-muted)' }}
                    >
                      {remaining} left
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <QtyButton disabled={soldOut || qty <= 0} onClick={() => onTicketChange(ticket.id, qty - 1)}>
                  −
                </QtyButton>
                <span
                  className="w-6 text-center text-base font-bold tabular-nums sm:w-8 sm:text-lg"
                  style={{ color: 'var(--landing-text)' }}
                >
                  {qty}
                </span>
                <QtyButton disabled={soldOut || qty >= remaining} onClick={() => onTicketChange(ticket.id, qty + 1)}>
                  +
                </QtyButton>
              </div>
            </div>
            {perks.length > 0 ? (
              <ul className="landing-showcase-ticket-perks mt-2 space-y-0.5 border-t pt-2 sm:mt-3 sm:space-y-1 sm:pt-3" style={{ borderColor: 'var(--showcase-border)' }}>
                {perks.map((p) => (
                  <li key={p} className="landing-showcase-ticket-perk">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" style={{ color: 'var(--showcase-accent)' }} />
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
      className="flex h-8 w-8 items-center justify-center rounded-lg border text-base font-bold transition disabled:opacity-35 sm:h-9 sm:w-9 sm:text-lg"
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

function ShowcaseTicketPulse({ tickets, onReserve }: { tickets: EventTicket[]; onReserve: () => void }) {
  const pulse = useMemo(() => computeTicketPulse(tickets), [tickets]);

  if (!pulse.hasTickets) {
    return (
      <div className="landing-showcase-promo">
        <p className="text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
          Passes opening soon
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
          Ticket tiers are not on sale yet. Check back shortly.
        </p>
      </div>
    );
  }

  if (pulse.allSoldOut) {
    return (
      <div className="landing-showcase-promo landing-showcase-promo--soldout">
        <span className="landing-showcase-promo-badge">Fully booked</span>
        <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
          Every pass tier has sold out
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
          {pulse.totalSold.toLocaleString()} passes were claimed for this event.
        </p>
      </div>
    );
  }

  const headline =
    pulse.soldOutCount > 0
      ? `${pulse.soldOutCount} tier${pulse.soldOutCount === 1 ? '' : 's'} already sold out`
      : pulse.percentSold >= 60
        ? 'Selling faster than expected'
        : 'Passes are going quickly';

  return (
    <div className="landing-showcase-promo">
      <div className="flex items-start justify-between gap-2">
        <span className="landing-showcase-promo-badge">
          <Flame className="h-3 w-3" />
          Live availability
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--showcase-accent)' }}>
          {pulse.percentSold}% claimed
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-snug" style={{ color: 'var(--landing-text)' }}>
        {headline}
      </p>

      <div className="landing-showcase-promo-meter mt-3" aria-hidden>
        <div className="landing-showcase-promo-meter-fill" style={{ width: `${pulse.percentSold}%` }} />
      </div>

      <div className="landing-showcase-promo-stats mt-4">
        <div className="landing-showcase-promo-stat">
          <span className="num tabular-nums">{pulse.totalSold.toLocaleString()}</span>
          <span className="lbl">Sold</span>
        </div>
        <div className="landing-showcase-promo-stat">
          <span className="num tabular-nums">{pulse.totalRemaining.toLocaleString()}</span>
          <span className="lbl">Left</span>
        </div>
        <div className="landing-showcase-promo-stat">
          <span className="num tabular-nums">{pulse.soldOutCount}</span>
          <span className="lbl">Sold out</span>
        </div>
      </div>

      {pulse.soldOutNames.length > 0 ? (
        <div className="mt-4">
          <p className="landing-eyebrow mb-1.5" style={{ color: 'var(--landing-text-muted)' }}>
            No longer available
          </p>
          <ul className="space-y-1">
            {pulse.soldOutNames.slice(0, 4).map((name) => (
              <li key={name} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--landing-text-muted)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-red-500/80" />
                <span className="line-through opacity-80">{name}</span>
              </li>
            ))}
            {pulse.soldOutNames.length > 4 ? (
              <li className="text-[11px]" style={{ color: 'var(--landing-text-muted)' }}>
                +{pulse.soldOutNames.length - 4} more sold out
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {pulse.lowStock.length > 0 ? (
        <div className="mt-4 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--showcase-border)', background: 'var(--showcase-card-muted)' }}>
          <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--showcase-accent)' }}>
            <TrendingUp className="h-3.5 w-3.5" />
            Almost gone
          </p>
          <ul className="mt-2 space-y-1">
            {pulse.lowStock.map((t) => (
              <li key={t.name} className="flex justify-between gap-2 text-xs" style={{ color: 'var(--landing-text)' }}>
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 font-bold tabular-nums">{t.remaining} left</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
        {pulse.totalRemaining <= 30
          ? `Only ${pulse.totalRemaining} passes remain across all tiers — secure yours before they're gone.`
          : pulse.soldOutCount > 0
            ? 'Popular tiers sell out first. Grab your pass while your preferred level is still available.'
            : `${pulse.totalRemaining.toLocaleString()} passes still available — don't wait until the best seats are taken.`}
      </p>

      <button
        type="button"
        onClick={onReserve}
        className="landing-showcase-btn-cta mt-4 flex w-full items-center justify-center gap-1.5 py-2.5 text-[11px]"
      >
        Reserve your passes
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
            <div className="mt-4 sm:mt-5">
              <ShowcaseTickets tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
            </div>
          </section>
        </div>

        <aside className="landing-showcase-sidebar" aria-label="Order summary">
          <ShowcaseCheckout
            tickets={tickets}
            selectedTickets={selectedTickets}
            totalAmount={totalAmount}
            onCheckout={onCheckout}
            isPurchasing={isPurchasing}
          />
          <ShowcaseTicketPulse tickets={tickets} onReserve={scrollTickets} />
        </aside>
      </div>

      <ShowcaseFooter event={event} />
    </LandingPageShell>
  );
}
