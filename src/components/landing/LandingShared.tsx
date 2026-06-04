import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Lock,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { Event, Ticket as EventTicket } from '../../types';
import { formatLKRWhole } from '../../utils/money';
import { landingCssVars, resolveEventTheme } from '../../themes/eventThemes';
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

export function LandingPageShell({
  event,
  children,
}: {
  event: Event;
  children: React.ReactNode;
}) {
  return (
    <div className="landing-page relative isolate" style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <AmbientMesh />
      {children}
      <LandingFooter event={event} />
    </div>
  );
}

function AmbientMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="landing-orb absolute -left-[20%] top-[10%] h-[min(70vw,520px)] w-[min(70vw,520px)] rounded-full opacity-50"
        style={{ background: 'var(--primary)' }}
      />
      <div
        className="landing-orb landing-orb-delay absolute -right-[15%] top-[35%] h-[min(55vw,420px)] w-[min(55vw,420px)] rounded-full opacity-40"
        style={{ background: 'var(--secondary)' }}
      />
      <div
        className="landing-orb absolute bottom-0 left-[30%] h-[min(50vw,380px)] w-[min(50vw,380px)] rounded-full opacity-25"
        style={{ background: 'var(--primary)' }}
      />
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

  return (
    <header className="landing-fade-in sticky top-0 z-40 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="landing-glass mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-2xl px-4 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base" style={{ color: 'var(--landing-text)' }}>
          {event.title}
        </p>
        <button
          type="button"
          onClick={scrollToTickets}
          className="landing-btn-primary shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white sm:text-sm"
        >
          Get tickets
        </button>
      </div>
    </header>
  );
}

export function PremiumBadge({ children, tone = 'glass' }: { children: React.ReactNode; tone?: 'glass' | 'solid' | 'hero' }) {
  if (tone === 'solid') {
    return (
      <span
        className="landing-eyebrow inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
        style={{ background: 'var(--primary)', color: 'var(--landing-on-primary, #fff)' }}
      >
        <Sparkles className="h-3 w-3" />
        {children}
      </span>
    );
  }
  if (tone === 'hero') {
    return (
      <span
        className="landing-eyebrow inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 backdrop-blur-md"
        style={{ borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        {children}
      </span>
    );
  }
  return (
    <span className="landing-eyebrow landing-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5" style={{ color: 'var(--landing-text-muted)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--landing-accent-readable, var(--primary))' }} />
      {children}
    </span>
  );
}

type BannerProps = {
  event: Event;
  className?: string;
  overlay?: 'cinematic' | 'light' | 'none';
  /** Max height for the banner image (full width, never cropped). */
  maxHeightClass?: string;
};

export function EventBanner({
  event,
  className = '',
  overlay = 'cinematic',
  maxHeightClass = 'max-h-[min(72vh,720px)]',
}: BannerProps) {
  const hasBanner = !!event.bannerUrl?.trim();

  return (
    <div
      className={`landing-grain relative flex w-full items-center justify-center overflow-hidden ${className}`}
      style={hasBanner ? { background: 'var(--landing-surface-muted)' } : undefined}
    >
      {hasBanner ? (
        <img
          src={event.bannerUrl}
          alt=""
          className={`mx-auto block h-auto w-full object-contain object-center ${maxHeightClass}`}
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

export function HeroTitle({ children, className = '', light = false }: { children: React.ReactNode; className?: string; light?: boolean }) {
  return (
    <h1
      className={`landing-display landing-fade-in landing-fade-in-delay-1 max-w-4xl text-[clamp(2.25rem,6vw,4.25rem)] ${className}`}
      style={{ color: light ? '#fff' : 'var(--landing-text)' }}
    >
      {children}
    </h1>
  );
}

export function HeroSubtitle({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className="landing-fade-in landing-fade-in-delay-2 mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
      style={{ color: light ? 'rgba(255,255,255,0.82)' : 'var(--landing-text-muted)' }}
    >
      {children}
    </p>
  );
}

export function HeroCTA({ onGetTickets: _onGetTickets, light = false }: { onGetTickets: () => void; light?: boolean }) {
  const scrollTickets = () => {
    document.getElementById('landing-tickets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing-fade-in landing-fade-in-delay-3 mt-8 flex flex-wrap items-center gap-4">
      <button type="button" onClick={scrollTickets} className="landing-btn-primary inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white">
        Reserve your spot
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => document.getElementById('landing-about')?.scrollIntoView({ behavior: 'smooth' })}
        className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-80"
        style={{
          color: light ? 'rgba(255,255,255,0.9)' : 'var(--landing-text)',
          border: light ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--landing-border)',
          background: light ? 'rgba(255,255,255,0.08)' : 'var(--landing-surface-muted)',
        }}
      >
        Learn more
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EventMeta({ event, tone = 'dark' }: { event: Event; tone?: 'dark' | 'light' }) {
  const dateStr = event.customization?.scheduleTba
    ? 'Date to be announced'
    : format(new Date(event.date), 'EEEE, MMMM d · h:mm a');
  const chipStyle =
    tone === 'dark'
      ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.95)' }
      : undefined;

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <MetaChip icon={<Calendar className="h-4 w-4" />} label={dateStr} style={chipStyle} />
      <MetaChip icon={<MapPin className="h-4 w-4" />} label={event.location} style={chipStyle} />
    </div>
  );
}

function MetaChip({
  icon,
  label,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="landing-glass inline-flex max-w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium"
      style={style ?? { color: 'var(--landing-text)' }}
    >
      <span style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>{icon}</span>
      <span className="truncate">{label}</span>
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
      <div className={`landing-card-premium rounded-3xl ${compact ? 'p-5' : 'p-7'}`}>
        <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
          When
        </p>
        <div className="landing-display mt-2 text-2xl sm:text-3xl" style={{ color: 'var(--landing-text)' }}>
          Date to be announced
        </div>
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
    <div className={`landing-card-premium rounded-3xl ${compact ? 'p-5' : 'p-7'}`}>
      <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
        {done ? 'Now live' : title}
      </p>
      {!done && (
        <div className={`mt-4 grid grid-cols-4 gap-2 sm:gap-3 ${compact ? '' : 'sm:mt-5'}`}>
          {units.map((u) => (
            <div key={u.label} className="landing-countdown-unit rounded-2xl border px-2 py-4 text-center" style={{ borderColor: 'var(--landing-border)' }}>
              <div
                className={`landing-display tabular-nums ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}
                style={{ color: 'var(--landing-accent-readable, var(--primary))' }}
              >
                {pad2(u.value)}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--landing-text-muted)' }}>
                {u.label}
              </div>
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
    <div id={id} className="mb-8 scroll-mt-28">
      <div className="landing-divider-glow mb-5 w-16" />
      <p className="landing-eyebrow mb-2" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
        Experience
      </p>
      <h2 className="landing-display text-3xl sm:text-4xl" style={{ color: 'var(--landing-text)' }}>
        {children}
      </h2>
      {subtitle ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
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
      <div className="landing-card-premium rounded-2xl p-6 sm:rounded-3xl sm:p-10">
        <p
          className={`whitespace-pre-wrap text-base leading-[1.75] sm:text-lg ${
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
  accent = 'var(--primary)',
  variant = 'default',
}: {
  tickets: EventTicket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (ticketId: string, quantity: number) => void;
  accent?: string;
  variant?: 'default' | 'dark';
}) {
  if (tickets.length === 0) {
    return (
      <div className="landing-card-premium rounded-3xl p-10 text-center">
        <Ticket className="mx-auto h-10 w-10 opacity-40" style={{ color: 'var(--landing-text-muted)' }} />
        <p className="mt-4 text-sm font-medium" style={{ color: 'var(--landing-text-muted)' }}>
          Registration opens soon.
        </p>
      </div>
    );
  }

  const isDark = variant === 'dark';

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      {tickets.map((ticket, index) => {
        const remaining = ticketRemaining(ticket);
        const soldOut = remaining <= 0;
        const qty = selectedTickets[ticket.id] || 0;
        const selected = qty > 0;

        return (
          <div
            key={ticket.id}
            className={`landing-card-premium group relative overflow-hidden rounded-xl p-3.5 sm:rounded-2xl sm:p-4 ${selected ? 'landing-ticket-selected' : ''}`}
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined,
              background: isDark ? 'rgba(255,255,255,0.04)' : undefined,
              color: isDark ? '#fff' : 'var(--landing-text)',
              opacity: soldOut ? 0.55 : 1,
              animationDelay: `${index * 0.06}s`,
            }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-35"
              style={{ background: accent }}
            />
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 gap-3">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl"
                  style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }}
                >
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-base font-bold tracking-tight">{ticket.name}</h3>
                    {soldOut ? (
                      <span className="landing-eyebrow rounded-full bg-neutral-900 px-2 py-0.5 text-white">Sold out</span>
                    ) : remaining <= 12 ? (
                      <span className="landing-eyebrow rounded-full px-2 py-0.5" style={{ background: 'var(--landing-surface-muted)', color: 'var(--landing-text-muted)' }}>
                        {remaining} remaining
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug sm:text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--landing-text-muted)' }}>
                    {ticket.description || 'Full event access'}
                  </p>
                  <p className="landing-display mt-1.5 hidden text-xl sm:block" style={{ color: accent }}>
                    {ticket.price <= 0 ? 'Complimentary' : formatLKRWhole(ticket.price)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
                <p className="landing-display shrink-0 text-xl sm:hidden" style={{ color: accent }}>
                  {ticket.price <= 0 ? 'Complimentary' : formatLKRWhole(ticket.price)}
                </p>
                <QuantityStepper
                  qty={qty}
                  soldOut={soldOut}
                  max={remaining}
                  isDark={isDark}
                  onDec={() => onTicketChange(ticket.id, qty - 1)}
                  onInc={() => onTicketChange(ticket.id, qty + 1)}
                  name={ticket.name}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuantityStepper({
  qty,
  soldOut,
  max,
  isDark,
  onDec,
  onInc,
  name,
}: {
  qty: number;
  soldOut: boolean;
  max: number;
  isDark: boolean;
  onDec: () => void;
  onInc: () => void;
  name: string;
}) {
  const btnClass = 'flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-35 sm:h-10 sm:w-10';
  const btnStyle = isDark
    ? { borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)' }
    : { borderColor: 'var(--landing-border)', background: 'var(--landing-surface)' };

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={soldOut || qty <= 0} onClick={onDec} className={btnClass} style={btnStyle} aria-label={`Decrease ${name}`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-lg font-bold tabular-nums">{qty}</span>
      <button type="button" disabled={soldOut || qty >= max} onClick={onInc} className={btnClass} style={btnStyle} aria-label={`Increase ${name}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
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
    <div className="landing-card-premium relative overflow-hidden rounded-2xl p-5 sm:rounded-3xl sm:p-7 lg:sticky lg:top-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
      />
      <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
        Your order
      </p>
      <h3 className="landing-display mt-1 text-2xl">Summary</h3>

      {!hasSelection ? (
        <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
          Select one or more ticket types to see your total and continue.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {lines.map((t) => (
            <div key={t.id} className="flex justify-between gap-3 text-sm">
              <span style={{ color: 'var(--landing-text-muted)' }}>
                {t.name} <span className="opacity-70">×{selectedTickets[t.id]}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatLKRWhole(t.price * selectedTickets[t.id])}</span>
            </div>
          ))}
          <div className="landing-divider-glow my-4" />
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="landing-display text-2xl" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
              {totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onCheckout}
        disabled={!hasSelection || isPurchasing}
        className="landing-btn-primary mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-45"
      >
        {isPurchasing ? 'Processing…' : hasSelection ? (totalAmount <= 0 ? 'Complete registration' : 'Proceed to payment') : 'Select tickets'}
        {hasSelection && !isPurchasing ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      <div className="mt-6 flex flex-col gap-2 border-t pt-5" style={{ borderColor: 'var(--landing-border)' }}>
        <TrustRow icon={<ShieldCheck className="h-4 w-4" />} text="Verified secure checkout" />
        <TrustRow icon={<Lock className="h-4 w-4" />} text="PayHere · LKR · Instant confirmation" />
      </div>
    </div>
  );
}

function TrustRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--landing-text-muted)' }}>
      <span style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>{icon}</span>
      {text}
    </div>
  );
}

export function LandingFooter({ event }: { event: Event }) {
  return (
    <footer className="relative z-10 border-t px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10" style={{ borderColor: 'var(--landing-border)' }}>
      <div className="mx-auto max-w-7xl text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--landing-text-muted)' }}>
          {event.title}
        </p>
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
    <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:gap-12 sm:px-6 sm:py-14 lg:grid-cols-[1fr_380px] lg:gap-16 lg:px-8 lg:py-20">
      <div className="min-w-0">{main}</div>
      <div className="min-w-0 max-lg:order-last lg:sticky lg:top-24 lg:self-start">{aside}</div>
    </div>
  );
}
