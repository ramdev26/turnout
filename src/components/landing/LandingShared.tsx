import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Calendar,
  Lock,
  MapPin,
  ShieldCheck,
  Ticket,
  Video,
} from 'lucide-react';
import { Event, Ticket as EventTicket } from '../../types';
import { toApiUrl } from '../../api/client';
import { formatLKRWhole } from '../../utils/money';
import { landingCssVars, landingToneIsDark, resolveEventTheme } from '../../themes/eventThemes';
import { EventPolicyLink } from './EventPolicyViewer';
import { isOnlineEvent } from '../../utils/eventLocation';
import { resolveArenaCarouselSlides } from './arenaGallery';

export function resolveLandingOrganizerBrand(event: Event): { name: string; logoUrl: string | null } {
  const name = event.organizerName?.trim() || 'Organizer';
  const raw = event.organizerLogoUrl?.trim() || '';
  const logoUrl =
    raw === ''
      ? null
      : raw.startsWith('http') || raw.startsWith('/api/')
        ? raw
        : toApiUrl(raw);
  return { name, logoUrl };
}
export function useCountdown(targetIso: string, active = true) {
  const [parts, setParts] = useState({ days: 0, hours: 0, mins: 0, secs: 0, done: false });

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
      if (diff <= 0) {
        setParts({ days: 0, hours: 0, mins: 0, secs: 0, done: true });
        return;
      }
      setParts({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        mins: Math.floor((diff % 3_600_000) / 60_000),
        secs: Math.floor((diff % 60_000) / 1000),
        done: false,
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, targetIso]);

  return parts;
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function themeDisplayName(event: Event): string {
  return resolveEventTheme(event.customization).name;
}

export function ticketRemaining(ticket: EventTicket): number {
  return Math.max(0, ticket.quantity - ticket.sold);
}

export function isTicketSoldOut(ticket: EventTicket): boolean {
  return ticketRemaining(ticket) <= 0;
}

export const landingShellStyle = (): React.CSSProperties => ({
  background: 'var(--landing-page-bg)',
  minHeight: '100vh',
  color: 'var(--landing-text)',
});

/** Full-width event banner at the very top of the landing page (before nav/header). */
export function LandingTopBanner({ event, className = '' }: { event: Event; className?: string }) {
  if (!event.bannerUrl?.trim()) return null;
  return (
    <div className={`landing-top-banner ${className}`.trim()}>
      <img
        src={event.bannerUrl}
        alt=""
        className="landing-top-banner-img"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export function LandingPageShell({
  event,
  children,
  showcase = false,
}: {
  event: Event;
  children: React.ReactNode;
  /** Premium showcase layout (custom header/footer, no default top bar). */
  showcase?: boolean;
}) {
  const tone = landingToneIsDark(event.customization) ? 'dark' : 'light';

  return (
    <div
      className={`landing-page landing-showcase relative isolate`}
      data-landing-tone={tone}
      style={{ ...landingCssVars(event.customization, event.templateId), ...landingShellStyle() }}
    >
      {children}
      {!showcase ? <LandingFooter event={event} /> : null}
    </div>
  );
}

export function LandingTopBar({
  event,
  onGetTickets,
}: {
  event: Event;
  onGetTickets?: () => void;
}) {
  const scrollToTickets = () => {
    if (onGetTickets) {
      onGetTickets();
      return;
    }
    document.getElementById('landing-tickets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const brand = resolveLandingOrganizerBrand(event);

  return (
    <header className="landing-showcase-header sticky top-0 z-40">
      <div className="landing-showcase-header-inner mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt=""
              className="h-9 w-9 rounded-lg object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="landing-showcase-mark">{brand.name.charAt(0).toUpperCase()}</span>
          )}
          <div className="min-w-0 text-left leading-tight">
            <p className="truncate text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--landing-text)' }}>
              {brand.name}
            </p>
          </div>
        </div>
        <button type="button" onClick={scrollToTickets} className="landing-showcase-btn-cta shrink-0">
          Get tickets
        </button>
      </div>
    </header>
  );
}

export function PremiumBadge({
  children,
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'glass' | 'solid' | 'hero';
  className?: string;
}) {
  return (
    <span className={`landing-showcase-hero-badge ${className}`.trim()}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--showcase-accent)' }} />
      {children}
    </span>
  );
}

type BannerProps = {
  event: Event;
  className?: string;
  overlay?: 'cinematic' | 'light' | 'none';
  /** Max height for the banner image (never cropped). Ignored when imageClassName is set. */
  maxHeightClass?: string;
  /** Optional extra classes on the <img> (e.g. landing-poster-img for responsive hero sizing). */
  imageClassName?: string;
  /** Full-bleed width; default false so the frame hugs the image (portrait posters, etc.). */
  fullWidth?: boolean;
};

export function EventBanner({
  event,
  className = '',
  overlay = 'cinematic',
  maxHeightClass = 'max-h-[min(72vh,720px)]',
  imageClassName = '',
  fullWidth = false,
}: BannerProps) {
  const hasBanner = !!event.bannerUrl?.trim();
  const widthClass = fullWidth || !hasBanner ? 'w-full' : 'mx-auto w-fit max-w-full';

  return (
    <div className={`landing-grain relative flex items-center justify-center overflow-hidden ${widthClass} ${className}`}>
      {hasBanner ? (
        <img
          src={event.bannerUrl}
          alt=""
          className={
            imageClassName
              ? `block object-center ${imageClassName}`
              : `block h-auto object-contain object-center ${maxHeightClass} ${
                  fullWidth ? 'mx-auto w-full' : 'w-auto max-w-full'
                }`
          }
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="min-h-[240px] w-full h-[min(50vh,420px)]"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary) 0%, transparent 55%), linear-gradient(160deg, var(--secondary) 0%, var(--landing-page-bg) 70%)`,
          }}
        />
      )}
      {overlay === 'cinematic' && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>
      )}
      {overlay === 'light' && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--landing-page-bg)] via-transparent to-transparent"
          aria-hidden
        />
      )}
    </div>
  );
}

export function EventGalleryStrip({ event, className = '' }: { event: Event; className?: string }) {
  const extras = resolveArenaCarouselSlides(event).slice(1, 8);
  if (extras.length === 0) return null;

  return (
    <section className={`mt-4 ${className}`.trim()} aria-label="Event gallery">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {extras.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--showcase-border)' }}
          >
            <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HeroTitle({ children, className = '' }: { children: React.ReactNode; className?: string; light?: boolean }) {
  return (
    <h1 className={`landing-showcase-hero-title landing-fade-in landing-fade-in-delay-1 ${className}`.trim()}>
      {children}
    </h1>
  );
}

export function HeroSubtitle({ children, className = '' }: { children: React.ReactNode; className?: string; light?: boolean }) {
  return (
    <p className={`landing-showcase-hero-lead landing-fade-in landing-fade-in-delay-2 ${className}`.trim()}>
      {children}
    </p>
  );
}

export function EventMeta({
  event,
  className = '',
}: {
  event: Event;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const dateStr = event.customization?.scheduleTba
    ? 'Date to be announced'
    : format(new Date(event.date), 'EEEE, MMMM d · h:mm a');

  return (
    <div id="landing-venue" className={`landing-showcase-info-grid scroll-mt-28 ${className}`.trim()}>
      <div className="landing-showcase-info-card">
        <Calendar className="mb-2 h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
        <p className="label">Event date &amp; time</p>
        <p className="value">{dateStr}</p>
      </div>
      <div className="landing-showcase-info-card">
        {isOnlineEvent(event.customization, event.location) ? (
          <Video className="mb-2 h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
        ) : (
          <MapPin className="mb-2 h-4 w-4" style={{ color: 'var(--showcase-accent)' }} />
        )}
        <p className="label">{isOnlineEvent(event.customization, event.location) ? 'Online' : 'Venue'}</p>
        <p className="value">{event.location || 'Venue to be announced'}</p>
      </div>
    </div>
  );
}

export function CountdownDisplay({
  targetIso,
  title = 'Countdown to opening',
  compact = false,
  tba = false,
}: {
  targetIso: string;
  title?: string;
  compact?: boolean;
  tba?: boolean;
}) {
  const { days, hours, mins, secs, done } = useCountdown(targetIso, !tba);

  if (tba) {
    return (
      <div className={`landing-showcase-card ${compact ? 'p-5' : 'p-6 sm:p-7'}`}>
        <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
          When
        </p>
        <div className="landing-showcase-hero-title mt-2 text-2xl sm:text-3xl">Date to be announced</div>
        <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
          Reserve your spot now — we’ll share the date &amp; time soon.
        </p>
      </div>
    );
  }

  const units = [
    { label: 'Days', value: days },
    { label: 'Hours', value: hours },
    { label: 'Min', value: mins },
    { label: 'Sec', value: secs },
  ];

  return (
    <div className={`landing-showcase-card ${compact ? 'p-5' : 'p-5 sm:p-6'}`}>
      <div className="landing-showcase-countdown-head">
        <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
          {done ? 'Now live' : title}
        </p>
      </div>
      {done ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
          The event is live — reserve your passes below.
        </p>
      ) : (
        <div className="landing-showcase-countdown-grid">
          {units.map((u) => (
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

export function SectionHeading({
  children,
  subtitle,
  id,
}: {
  children: React.ReactNode;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div id={id} className="mb-7 scroll-mt-28 sm:mb-8">
      <h2 className="landing-showcase-section-title">{children}</h2>
      {subtitle ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

const ABOUT_READ_MORE_MIN_CHARS = 160;

export function AboutBlock({ event }: { event: Event }) {
  const desc = event.description?.trim();
  const [expanded, setExpanded] = useState(false);
  if (!desc) return null;

  const canExpand = desc.length > ABOUT_READ_MORE_MIN_CHARS;

  return (
    <section id="landing-about" className="scroll-mt-28">
      <SectionHeading subtitle="Curated details for your visit.">The experience</SectionHeading>
      <div className="landing-showcase-card mt-5 p-5 sm:p-7">
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed sm:text-base ${
            canExpand && !expanded ? 'line-clamp-4 sm:line-clamp-none' : ''
          }`}
          style={{ color: 'var(--landing-text-muted)' }}
        >
          {desc}
        </p>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 text-sm font-semibold underline-offset-2 hover:underline sm:hidden"
            style={{ color: 'var(--landing-accent-readable, var(--primary))' }}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function TicketsSection({
  children,
  subtitle = 'Choose your pass. Secure checkout powered by PayHere.',
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <section id="landing-tickets" className="scroll-mt-28">
      <SectionHeading subtitle={subtitle}>Tickets &amp; registration</SectionHeading>
      {children}
    </section>
  );
}

export function TicketsList({
  tickets,
  selectedTickets,
  onTicketChange,
}: {
  tickets: EventTicket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (ticketId: string, quantity: number) => void;
  accent?: string;
  variant?: 'default' | 'dark';
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
                    {ticket.description || 'Full event access'}
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

export function CheckoutPanel({
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
            <div className="flex items-baseline justify-between">
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
          <TrustRow icon={<ShieldCheck className="h-4 w-4" />} text="Verified secure checkout" />
          <TrustRow icon={<Lock className="h-4 w-4" />} text="PayHere · LKR · Instant confirmation" />
        </div>
      </div>
    </div>
  );
}

function TrustRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--landing-text-muted)' }}>
      <span style={{ color: 'var(--showcase-accent)' }}>{icon}</span>
      {text}
    </p>
  );
}

export function LandingFooter({ event }: { event: Event }) {
  const brand = resolveLandingOrganizerBrand(event);
  const year = new Date().getFullYear();

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
        <nav className="landing-showcase-footer-links" aria-label="Event links">
          <EventPolicyLink html={event.customization?.eventPolicyHtml} className="text-xs font-semibold underline-offset-2 hover:underline sm:text-sm" />
        </nav>
      </div>
    </footer>
  );
}

/** Two-column content + sticky checkout layout used by most templates */
export function LandingContentGrid({
  main,
  aside,
}: {
  main: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="landing-content-grid relative z-10 mx-auto max-w-[80rem] gap-10 px-4 py-12 sm:gap-12 sm:px-6 sm:py-16 lg:gap-14 lg:px-8 lg:py-20">
      <div className="min-w-0">{main}</div>
      <div className="landing-content-aside min-w-0 max-lg:order-last">{aside}</div>
    </div>
  );
}
