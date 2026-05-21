import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, MapPin, Minus, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { Event, Ticket } from '../../types';
import { formatLKR } from '../../utils/money';
import { resolveEventTheme } from '../../themes/eventThemes';

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

export function ticketRemaining(ticket: Ticket): number {
  return Math.max(0, ticket.quantity - ticket.sold);
}

export function isTicketSoldOut(ticket: Ticket): boolean {
  return ticketRemaining(ticket) <= 0;
}

type BannerProps = {
  event: Event;
  className?: string;
  overlay?: 'dark' | 'light' | 'none';
  heightClass?: string;
};

export function EventBanner({ event, className = '', overlay = 'dark', heightClass = 'h-[min(52vh,480px)]' }: BannerProps) {
  const hasBanner = !!event.bannerUrl?.trim();
  const theme = resolveEventTheme(event.customization);

  return (
    <div className={`relative w-full overflow-hidden ${heightClass} ${className}`}>
      {hasBanner ? (
        <img
          src={event.bannerUrl}
          alt={event.title}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: `linear-gradient(135deg, var(--primary) 0%, var(--secondary) 55%, var(--landing-page-bg) 100%)`,
          }}
        />
      )}
      {overlay === 'dark' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      )}
      {overlay === 'light' && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, transparent 40%, var(--landing-surface) 100%)' }}
        />
      )}
      {!hasBanner && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Sparkles className="h-24 w-24" style={{ color: theme.primary }} />
        </div>
      )}
    </div>
  );
}

export function EventMeta({ event, tone = 'dark' }: { event: Event; tone?: 'dark' | 'light' }) {
  const dateStr = format(new Date(event.date), 'EEE, d MMM yyyy · h:mm a');
  const textStyle = tone === 'dark' ? { color: 'rgba(255,255,255,0.92)' } : { color: 'var(--landing-text-muted)' };
  const iconStyle = tone === 'dark' ? { color: 'rgba(255,255,255,0.75)' } : { color: 'var(--landing-text-muted)' };

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
      <div className="flex items-center gap-2.5 text-sm font-medium sm:text-base" style={textStyle}>
        <Calendar className="h-5 w-5 shrink-0" style={iconStyle} />
        <span>{dateStr}</span>
      </div>
      <div className="flex items-center gap-2.5 text-sm font-medium sm:text-base" style={textStyle}>
        <MapPin className="h-5 w-5 shrink-0" style={iconStyle} />
        <span>{event.location}</span>
      </div>
    </div>
  );
}

export function CountdownDisplay({
  targetIso,
  title = 'Event starts in',
  compact = false,
}: {
  targetIso: string;
  title?: string;
  compact?: boolean;
}) {
  const { days, hours, mins, secs, done } = useCountdown(targetIso);

  const units = [
    { label: 'Days', value: days },
    { label: 'Hrs', value: hours },
    { label: 'Min', value: mins },
    { label: 'Sec', value: secs },
  ];

  return (
    <div
      className={compact ? 'rounded-2xl border p-4' : 'rounded-2xl border p-6'}
      style={{
        borderColor: 'var(--landing-border)',
        background: 'var(--landing-surface-muted)',
        color: 'var(--landing-text)',
      }}
    >
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--landing-text-muted)' }}>
        {done ? 'Event has started' : title}
      </p>
      {!done && (
        <div className={`mt-3 grid grid-cols-4 gap-2 ${compact ? '' : 'sm:gap-3'}`}>
          {units.map((u) => (
            <div
              key={u.label}
              className="rounded-xl border px-2 py-3 text-center"
              style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface)' }}
            >
              <div className={`font-bold tabular-nums ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`} style={{ color: 'var(--primary)' }}>
                {pad2(u.value)}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                {u.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TicketsList({
  tickets,
  selectedTickets,
  onTicketChange,
  accent = 'var(--primary)',
  variant = 'default',
}: {
  tickets: Ticket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (ticketId: string, quantity: number) => void;
  accent?: string;
  variant?: 'default' | 'dark';
}) {
  if (tickets.length === 0) {
    return (
      <div
        className="rounded-2xl border p-6 text-center text-sm"
        style={{ borderColor: 'var(--landing-border)', color: 'var(--landing-text-muted)' }}
      >
        Tickets are not available yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tickets.map((ticket) => {
        const remaining = ticketRemaining(ticket);
        const soldOut = remaining <= 0;
        const qty = selectedTickets[ticket.id] || 0;
        const isDark = variant === 'dark';

        return (
          <div
            key={ticket.id}
            className="flex flex-col gap-4 rounded-2xl border p-5 transition-all sm:flex-row sm:items-center sm:justify-between sm:p-6"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'var(--landing-border)',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'var(--landing-surface-muted)',
              color: isDark ? '#fff' : 'var(--landing-text)',
              opacity: soldOut ? 0.65 : 1,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{ticket.name}</h3>
                {soldOut && (
                  <span className="rounded-full bg-neutral-900/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Sold out
                  </span>
                )}
                {!soldOut && remaining <= 10 && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--landing-surface)', color: 'var(--landing-text-muted)' }}
                  >
                    {remaining} left
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'var(--landing-text-muted)' }}>
                {ticket.description || 'Standard entry'}
              </p>
              <p className="mt-2 text-xl font-bold" style={{ color: accent }}>
                {ticket.price <= 0 ? 'Free' : formatLKR(ticket.price)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={soldOut || qty <= 0}
                  onClick={() => onTicketChange(ticket.id, qty - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold transition disabled:opacity-40"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'var(--landing-border)',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--landing-surface)',
                  }}
                  aria-label={`Decrease ${ticket.name}`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-lg font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  disabled={soldOut || qty >= remaining}
                  onClick={() => onTicketChange(ticket.id, qty + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold transition disabled:opacity-40"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'var(--landing-border)',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--landing-surface)',
                  }}
                  aria-label={`Increase ${ticket.name}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
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
  tickets: Ticket[];
  selectedTickets: Record<string, number>;
  totalAmount: number;
  onCheckout: () => void;
  isPurchasing: boolean;
}) {
  const hasSelection = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);
  const lines = tickets.filter((t) => (selectedTickets[t.id] || 0) > 0);

  return (
    <div
      className="rounded-3xl border p-6 backdrop-blur-sm lg:sticky lg:top-6"
      style={{
        borderColor: 'var(--landing-border)',
        background: 'var(--landing-surface)',
        boxShadow: 'var(--landing-shadow)',
        color: 'var(--landing-text)',
      }}
    >
      <h3 className="text-xl font-semibold tracking-tight">Order summary</h3>
      {!hasSelection ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
          Select tickets to continue.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {lines.map((t) => (
            <div key={t.id} className="flex justify-between gap-4 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              <span>
                {t.name} × {selectedTickets[t.id]}
              </span>
              <span className="shrink-0 font-semibold" style={{ color: 'var(--landing-text)' }}>
                {formatLKR(t.price * selectedTickets[t.id])}
              </span>
            </div>
          ))}
          <div className="mt-2 border-t pt-4" style={{ borderColor: 'var(--landing-border)' }}>
            <div className="flex justify-between text-xl font-semibold">
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{totalAmount <= 0 ? 'Free' : formatLKR(totalAmount)}</span>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onCheckout}
        disabled={!hasSelection || isPurchasing}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <ShoppingCart className="h-5 w-5" />
        {isPurchasing ? 'Processing…' : hasSelection ? (totalAmount <= 0 ? 'Register free' : 'Continue to checkout') : 'Select tickets'}
      </button>
      <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
        Secure checkout · PayHere · LKR
      </p>
    </div>
  );
}

export function LandingTopBar({ event }: { event: Event }) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--landing-border)',
        background: 'color-mix(in srgb, var(--landing-surface) 88%, transparent)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <LinkBrand />
        <span
          className="max-w-[50%] truncate text-xs font-semibold uppercase tracking-wide sm:max-w-none sm:text-sm"
          style={{ color: 'var(--landing-text-muted)' }}
        >
          {event.title}
        </span>
      </div>
    </header>
  );
}

function LinkBrand() {
  return (
    <a href="/" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
      <span
        className="grid h-8 w-8 place-items-center rounded-xl border text-xs font-bold"
        style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)', color: 'var(--primary)' }}
      >
        T
      </span>
      <span className="hidden sm:inline">Turnout</span>
    </a>
  );
}

export const landingShellStyle = (): React.CSSProperties => ({
  background: 'var(--landing-page-bg)',
  minHeight: '100vh',
  color: 'var(--landing-text)',
});

export function SectionHeading({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--landing-text)' }}>
        {children}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
