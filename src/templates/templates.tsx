import React, { useEffect, useMemo, useState } from 'react';
import { CanvasElement, CanvasDesign, Event, SectionBlock, SectionDesign, Ticket } from '../types';
import { Calendar, MapPin, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { formatLKR } from '../utils/money';
import { api } from '../api/client';
import type { Speaker, Session } from '../types';

export type TemplateId = 'template-1' | 'template-2' | 'template-3' | 'template-4' | 'template-canvas';

export type LandingTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  previewSeed: string;
  render: (props: LandingTemplateProps) => React.ReactElement;
};

export type LandingTemplateProps = {
  event: Event;
  tickets: Ticket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (ticketId: string, quantity: number) => void;
  totalAmount: number;
  onCheckout: () => void;
  isPurchasing: boolean;
};

function cssVars(customization: Event['customization']): React.CSSProperties {
  return {
    ['--primary' as any]: customization?.primaryColor || '#39FF14',
    ['--secondary' as any]: customization?.secondaryColor || '#9BEBAF',
  };
}

function safeCanvas(design: CanvasDesign | undefined, event: Event): CanvasDesign | null {
  if (!design || design.version !== 1 || !design.canvas || !Array.isArray(design.elements)) return null;
  // Basic guardrails
  const width = Math.max(600, Math.min(1600, design.canvas.width || 1100));
  const height = Math.max(600, Math.min(2400, design.canvas.height || 900));
  return {
    version: 1,
    canvas: { width, height, background: design.canvas.background || '#111714' },
    elements: design.elements.filter((e) => e && typeof e.id === 'string' && typeof e.type === 'string') as any,
  };
}

function safeSections(design: SectionDesign | undefined): SectionDesign | null {
  if (!design || design.version !== 1 || !design.theme || !Array.isArray(design.blocks)) return null;
  return {
    version: 1,
    theme: {
      contentBackground: design.theme.contentBackground || '#111714',
      border: design.theme.border || 'rgba(57, 255, 20, 0.2)',
    },
    blocks: design.blocks.filter((b) => b && typeof b.id === 'string' && typeof b.type === 'string') as any,
  };
}

function SectionsRenderer({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
  design,
}: LandingTemplateProps & { design: SectionDesign }) {
  const primary = event.customization?.primaryColor || '#4f46e5';
  const secondary = event.customization?.secondaryColor || '#10b981';

  const [speakers, setSpeakers] = useState<Speaker[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sp, se] = await Promise.all([
          api.get<{ speakers: Speaker[] }>(`/api/public/events/${event.id}/speakers`),
          api.get<{ sessions: Session[] }>(`/api/public/events/${event.id}/sessions`),
        ]);
        if (!cancelled) {
          setSpeakers(sp.speakers);
          setSessions(se.sessions);
        }
      } catch {
        if (!cancelled) {
          setSpeakers([]);
          setSessions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const speakerById = useMemo(() => {
    const list = speakers || [];
    return Object.fromEntries(list.map((s) => [s.id, s]));
  }, [speakers]);

  const sponsors = useMemo(() => {
    const block = design.blocks.find((b) => b.type === 'sponsors');
    const text = (block?.props as any)?.itemsText as string | undefined;
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, logoUrl, linkUrl] = line.split('|').map((x) => (x || '').trim());
        return { name, logoUrl, linkUrl };
      })
      .filter((x) => x.name || x.logoUrl);
  }, [design.blocks]);

  const renderBlock = (b: SectionBlock) => {
    if (b.type === 'divider') return <div className="h-px w-full" style={{ background: b.props?.color || '#e5e5e5' }} />;

    if (b.type === 'hero') {
      const align = b.props?.align === 'center' ? 'text-center items-center' : 'text-left items-start';
      return (
        <div className={`flex flex-col gap-4 ${align}`}>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">{b.props?.eyebrow || 'INTRODUCING'}</div>
          <div className="text-4xl font-black tracking-tight text-neutral-900">{b.props?.title || event.title}</div>
          <div className="text-sm leading-relaxed text-neutral-600">{b.props?.subtitle || event.description}</div>
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <img
              src={b.props?.imageUrl || event.bannerUrl}
              alt={event.title}
              referrerPolicy="no-referrer"
              className="h-56 w-full object-cover"
            />
          </div>
        </div>
      );
    }

    if (b.type === 'richText') {
      return (
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.props?.title || 'Section title'}</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">{b.props?.text || ''}</div>
        </div>
      );
    }

    if (b.type === 'image') {
      return (
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <img src={b.props?.imageUrl} alt="" referrerPolicy="no-referrer" className="h-72 w-full object-cover" />
        </div>
      );
    }

    if (b.type === 'countdown') {
      const now = Date.now();
      const target = new Date(event.date).getTime();
      const diff = Math.max(0, target - now);
      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      return (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">{b.props?.title || 'Starts in'}</div>
          <div className="mt-2 text-3xl font-black text-neutral-900">
            {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
          </div>
        </div>
      );
    }

    if (b.type === 'tickets') {
      const hasSelection = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);
      return (
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.props?.title || 'Tickets'}</div>
          <div className="mt-6 flex flex-col gap-4">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5">
                <div>
                  <div className="text-sm font-bold text-neutral-900">{t.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">{formatLKR(t.price)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onTicketChange(t.id, (selectedTickets[t.id] || 0) - 1)}
                    className="h-10 w-10 rounded-full border border-neutral-200 bg-white text-lg font-black"
                  >
                    -
                  </button>
                  <div className="w-8 text-center text-sm font-extrabold">{selectedTickets[t.id] || 0}</div>
                  <button
                    type="button"
                    onClick={() => onTicketChange(t.id, (selectedTickets[t.id] || 0) + 1)}
                    className="h-10 w-10 rounded-full border border-neutral-200 bg-white text-lg font-black"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-extrabold text-neutral-700">Total</div>
            <div className="text-xl font-black" style={{ color: primary }}>
              {formatLKR(totalAmount)}
            </div>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={!hasSelection || isPurchasing}
            className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: primary }}
          >
            {isPurchasing ? 'Processing...' : 'Checkout'}
          </button>
          <div className="mt-3 text-center text-xs text-neutral-400">English • LKR</div>
        </div>
      );
    }

    if (b.type === 'speakers') {
      const list = speakers;
      return (
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.props?.title || 'Speakers'}</div>
          {b.props?.subtitle ? <div className="mt-2 text-sm text-neutral-600">{b.props.subtitle}</div> : null}

          {list === null ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="h-12 w-12 rounded-full bg-neutral-100" />
                  <div className="mt-4 h-4 w-40 rounded bg-neutral-100" />
                  <div className="mt-2 h-3 w-24 rounded bg-neutral-100" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
              Speakers will appear here once the organizer adds them.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  {s.avatarUrl ? (
                    <img
                      src={s.avatarUrl}
                      alt={s.name}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-sm font-black text-neutral-500">
                      {s.name?.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="mt-4 text-base font-extrabold text-neutral-900">{s.name}</div>
                  <div className="mt-1 text-sm text-neutral-600">{[s.title, s.company].filter(Boolean).join(' • ')}</div>
                  {s.bio ? <div className="mt-3 text-sm leading-relaxed text-neutral-600">{s.bio}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (b.type === 'agenda') {
      const list = sessions;
      return (
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.props?.title || 'Agenda'}</div>
          {b.props?.subtitle ? <div className="mt-2 text-sm text-neutral-600">{b.props.subtitle}</div> : null}

          {list === null ? (
            <div className="mt-6 flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="h-3 w-24 rounded bg-neutral-100" />
                  <div className="mt-3 h-4 w-72 rounded bg-neutral-100" />
                  <div className="mt-2 h-3 w-40 rounded bg-neutral-100" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
              Sessions will appear here once the organizer adds them.
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              {list.map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="text-xs font-extrabold text-neutral-500">
                    {new Date(s.startsAt).toLocaleString()} → {new Date(s.endsAt).toLocaleString()}
                    {s.location ? ` • ${s.location}` : ''}
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-neutral-900">{s.title}</div>
                  {s.description ? <div className="mt-2 text-sm text-neutral-600">{s.description}</div> : null}
                  {s.speakerIds?.length ? (
                    <div className="mt-3 text-sm font-semibold text-neutral-700">
                      Speakers: {s.speakerIds.map((id) => speakerById[id]?.name || 'Unknown').join(', ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (b.type === 'sponsors') {
      return (
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.props?.title || 'Sponsors'}</div>
          {b.props?.subtitle ? <div className="mt-2 text-sm text-neutral-600">{b.props.subtitle}</div> : null}
          {sponsors.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
              Add sponsor logos in the website builder (Sponsors block).
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sponsors.map((sp, idx) => {
                const Card = (
                  <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4">
                    {sp.logoUrl ? (
                      <img src={sp.logoUrl} alt={sp.name || 'Sponsor'} referrerPolicy="no-referrer" className="h-14 object-contain" />
                    ) : (
                      <div className="text-sm font-extrabold text-neutral-600">{sp.name}</div>
                    )}
                  </div>
                );
                return sp.linkUrl ? (
                  <a key={idx} href={sp.linkUrl} target="_blank" rel="noreferrer" className="hover:opacity-95">
                    {Card}
                  </a>
                ) : (
                  <div key={idx}>{Card}</div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (b.type === 'button') {
      const variant = b.props?.variant || 'primary';
      const style =
        variant === 'outline'
          ? { background: 'transparent', color: '#0a0a0a', border: '1px solid rgba(0,0,0,0.25)' }
          : variant === 'secondary'
            ? { background: secondary, color: '#ffffff' }
            : { background: primary, color: '#ffffff' };
      return (
        <button type="button" className="w-full rounded-2xl px-5 py-4 text-sm font-extrabold" style={style as any}>
          {b.props?.text || 'Get Tickets'}
        </button>
      );
    }

    return null;
  };

  return (
    <div style={cssVars(event.customization)}>
      <div className="mx-auto w-full max-w-7xl px-6">
        <div
          className="overflow-hidden rounded-3xl border shadow-sm"
          style={{ background: design.theme.contentBackground, borderColor: design.theme.border }}
        >
          <div className="flex flex-col">
            {design.blocks.map((b) => (
              <div key={b.id} className="border-b p-10 last:border-b-0" style={{ borderColor: design.theme.border }}>
                {renderBlock(b)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasRenderer({
  event,
  tickets,
  selectedTickets,
  onTicketChange,
  totalAmount,
  onCheckout,
  isPurchasing,
}: LandingTemplateProps) {
  const design = safeCanvas(event.customization?.canvas, event);
  if (!design) {
    // Fallback to template-1 if canvas is missing
    return Template1.render({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing });
  }

  const renderEl = (el: CanvasElement) => {
    const base: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.w,
      height: el.h,
    };

    if (el.type === 'divider') {
      return (
        <div key={el.id} style={{ ...base, display: 'flex', alignItems: 'center' }}>
          <div style={{ height: 2, width: '100%', background: el.props?.color || '#e5e5e5' }} />
        </div>
      );
    }

    if (el.type === 'image') {
      return (
        <div key={el.id} style={base}>
          <img
            src={el.props?.url || event.bannerUrl}
            alt=""
            referrerPolicy="no-referrer"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: el.props?.radius ?? 24,
            }}
          />
        </div>
      );
    }

    if (el.type === 'badge') {
      return (
        <div key={el.id} style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              borderRadius: 9999,
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'rgba(79,70,229,0.12)',
              color: 'var(--primary)',
              width: 'max-content',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {el.props?.text || 'BADGE'}
          </div>
        </div>
      );
    }

    if (el.type === 'button') {
      return (
        <div key={el.id} style={base}>
          <button
            type="button"
            onClick={onCheckout}
            disabled={isPurchasing}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: el.props?.radius ?? 16,
              background: el.props?.bg || 'var(--primary)',
              color: el.props?.color || '#ffffff',
              fontWeight: 900,
              border: 'none',
            }}
          >
            {isPurchasing ? 'Processing...' : el.props?.text || 'Get Tickets'}
          </button>
        </div>
      );
    }

    if (el.type === 'ticketsEmbed') {
      return (
        <div
          key={el.id}
          style={{
            ...base,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 14px 34px rgba(0,0,0,0.12)',
            padding: 14,
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">{el.props?.title || 'Tickets'}</div>
            <div className="text-xs font-bold text-neutral-400">LKR</div>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{t.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">{formatLKR(t.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTicketChange(t.id, (selectedTickets[t.id] || 0) - 1)}
                      className="h-8 w-8 rounded-full border border-neutral-200 bg-white font-bold"
                    >
                      -
                    </button>
                    <div className="w-6 text-center text-sm font-extrabold">{selectedTickets[t.id] || 0}</div>
                    <button
                      type="button"
                      onClick={() => onTicketChange(t.id, (selectedTickets[t.id] || 0) + 1)}
                      className="h-8 w-8 rounded-full border border-neutral-200 bg-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (el.type === 'countdown') {
      const now = Date.now();
      const target = new Date(event.date).getTime();
      const diff = Math.max(0, target - now);
      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      return (
        <div
          key={el.id}
          style={{
            ...base,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.98)',
            padding: 14,
          }}
        >
          <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">{el.props?.title || 'Starts in'}</div>
          <div className="mt-2 text-2xl font-black text-neutral-900">
            {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
          </div>
        </div>
      );
    }

    // text (default)
    return (
      <div
        key={el.id}
        style={{
          ...base,
          whiteSpace: 'pre-wrap',
          fontSize: Math.max(10, Math.min(96, el.props?.size ?? 20)),
          fontWeight: Math.max(100, Math.min(900, el.props?.weight ?? 800)),
          color: el.props?.color || '#0a0a0a',
          lineHeight: 1.1,
        }}
      >
        {el.props?.text || ''}
      </div>
    );
  };

  return (
    <div style={cssVars(event.customization)}>
      <div className="mx-auto w-full max-w-7xl px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"
          style={{ width: design.canvas.width, height: design.canvas.height, background: design.canvas.background || '#fff' }}
        >
          {design.elements.map(renderEl)}
        </div>
      </div>
    </div>
  );
}

function CheckoutPanel({
  tickets,
  selectedTickets,
  totalAmount,
  onCheckout,
  isPurchasing,
  footerText,
}: {
  tickets: Ticket[];
  selectedTickets: Record<string, number>;
  totalAmount: number;
  onCheckout: () => void;
  isPurchasing: boolean;
  footerText?: string;
}) {
  const hasSelection = tickets.some((t) => (selectedTickets[t.id] || 0) > 0);
  return (
    <div className="sticky top-24 rounded-3xl border border-indigo-100 bg-white/95 p-7 shadow-[0_14px_40px_rgba(79,70,229,0.12)]">
      <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Order summary</h3>
      <div className="mt-6 flex flex-col gap-4">
        {tickets
          .filter((t) => (selectedTickets[t.id] || 0) > 0)
          .map((t) => (
            <div key={t.id} className="flex justify-between text-sm text-neutral-700">
              <span>
                {t.name} x {selectedTickets[t.id]}
              </span>
              <span className="font-bold">{formatLKR(t.price * selectedTickets[t.id])}</span>
            </div>
          ))}
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <div className="flex justify-between text-xl font-semibold tracking-tight">
            <span>Total</span>
            <span style={{ color: 'var(--primary)' }}>{formatLKR(totalAmount)}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onCheckout}
        disabled={!hasSelection || isPurchasing}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <ShoppingCart className="h-5 w-5" />
        {isPurchasing ? 'Processing...' : 'Checkout Now'}
      </button>
      <p className="mt-4 text-center text-xs text-neutral-500">{footerText || 'Secure checkout (MVP demo).'}</p>
    </div>
  );
}

function TicketsList({
  tickets,
  selectedTickets,
  onTicketChange,
  accent = 'var(--primary)',
}: {
  tickets: Ticket[];
  selectedTickets: Record<string, number>;
  onTicketChange: (ticketId: string, quantity: number) => void;
  accent?: string;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="flex items-center justify-between rounded-2xl border border-indigo-100/70 bg-gradient-to-b from-white to-indigo-50/30 p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-200"
        >
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{ticket.name}</h3>
            <p className="text-sm text-neutral-500">{ticket.description || 'Standard entry ticket'}</p>
            <p className="mt-2 text-xl font-bold" style={{ color: accent }}>
              {formatLKR(ticket.price)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onTicketChange(ticket.id, (selectedTickets[ticket.id] || 0) - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-bold hover:bg-neutral-50"
            >
              -
            </button>
            <span className="w-8 text-center text-lg font-bold">{selectedTickets[ticket.id] || 0}</span>
            <button
              onClick={() => onTicketChange(ticket.id, (selectedTickets[ticket.id] || 0) + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-bold hover:bg-neutral-50"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventMeta({ event, tone = 'dark' }: { event: Event; tone?: 'dark' | 'light' }) {
  const textClass = tone === 'dark' ? 'text-white/90' : 'text-neutral-600';
  const iconClass = tone === 'dark' ? 'text-white/80' : 'text-neutral-500';
  return (
    <div className={`mt-6 flex flex-wrap gap-6 text-lg font-medium ${textClass}`}>
      <div className="flex items-center gap-2">
        <Calendar className={`h-5 w-5 ${iconClass}`} />
        {format(new Date(event.date), 'PPPP p')}
      </div>
      <div className="flex items-center gap-2">
        <MapPin className={`h-5 w-5 ${iconClass}`} />
        {event.location}
      </div>
    </div>
  );
}

const Template1: LandingTemplate = {
  id: 'template-1',
  name: 'Cinematic Hero',
  description: 'Big banner + gradient overlay + sticky checkout.',
  previewSeed: 'cinematic-hero',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={cssVars(event.customization)}>
      <div className="w-full bg-white">
        <div className="relative h-[420px] w-full">
          <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <h1 className="text-5xl font-extrabold tracking-tight">{event.customization?.heroText || event.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-white/85">
              {event.customization?.heroSubtext || event.description}
            </p>
            <EventMeta event={event} tone="dark" />
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 p-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section>
              <h2 className="text-2xl font-bold text-neutral-900">About this event</h2>
              <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-neutral-600">{event.description}</p>
            </section>
            <section className="mt-12">
              <h2 className="text-2xl font-bold text-neutral-900">Tickets</h2>
              <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
            </section>
          </div>
          <CheckoutPanel
            tickets={tickets}
            selectedTickets={selectedTickets}
            totalAmount={totalAmount}
            onCheckout={onCheckout}
            isPurchasing={isPurchasing}
          />
        </div>
      </div>
    </div>
  ),
};

const Template2: LandingTemplate = {
  id: 'template-2',
  name: 'Centered Minimal',
  description: 'Clean centered layout, bright and airy.',
  previewSeed: 'centered-minimal',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={cssVars(event.customization)}>
      <div className="w-full bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 p-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600">
                {event.status === 'published' ? 'Live event' : event.status}
              </div>
              <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-neutral-900">
                {event.customization?.heroText || event.title}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-neutral-600">
                {event.customization?.heroSubtext || event.description}
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
                <img src={event.bannerUrl} alt={event.title} className="h-56 w-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <EventMeta event={event} tone="light" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Tickets</h2>
              <TicketsList
                tickets={tickets}
                selectedTickets={selectedTickets}
                onTicketChange={onTicketChange}
                accent={'var(--secondary)'}
              />
              <div className="mt-10">
                <CheckoutPanel
                  tickets={tickets}
                  selectedTickets={selectedTickets}
                  totalAmount={totalAmount}
                  onCheckout={onCheckout}
                  isPurchasing={isPurchasing}
                  footerText="Checkout is a demo flow (no real payment yet)."
                />
              </div>
            </div>
        </div>
      </div>
    </div>
  ),
};

const Template3: LandingTemplate = {
  id: 'template-3',
  name: 'Split Gradient',
  description: 'Left gradient hero + right checkout, modern SaaS feel.',
  previewSeed: 'split-gradient',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={cssVars(event.customization)}>
      <div className="w-full bg-white">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="relative p-12">
            <div
              className="absolute inset-0 opacity-90"
              style={{
                background: `radial-gradient(800px circle at 0% 0%, var(--primary), transparent 60%), radial-gradient(700px circle at 100% 0%, var(--secondary), transparent 55%)`,
              }}
            />
            <div className="relative">
              <h1 className="text-5xl font-extrabold tracking-tight text-neutral-900">{event.customization?.heroText || event.title}</h1>
              <p className="mt-5 text-lg leading-relaxed text-neutral-700">
                {event.customization?.heroSubtext || event.description}
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/50 bg-white/60 backdrop-blur">
                <img src={event.bannerUrl} alt={event.title} className="h-64 w-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="mt-8 rounded-2xl border border-white/60 bg-white/60 p-6 backdrop-blur">
                <EventMeta event={event} tone="light" />
              </div>
            </div>
          </div>

          <div className="p-12">
            <h2 className="text-2xl font-bold text-neutral-900">Tickets</h2>
            <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
            <div className="mt-10">
              <CheckoutPanel
                tickets={tickets}
                selectedTickets={selectedTickets}
                totalAmount={totalAmount}
                onCheckout={onCheckout}
                isPurchasing={isPurchasing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

const Template4: LandingTemplate = {
  id: 'template-4',
  name: 'Dark Poster',
  description: 'High-contrast “poster” style with bold typography.',
  previewSeed: 'dark-poster',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={cssVars(event.customization)}>
      <div className="w-full bg-neutral-950 text-white">
        <div className="relative">
          <img src={event.bannerUrl} alt={event.title} className="h-[360px] w-full object-cover opacity-70" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-neutral-950" />
          <div className="absolute inset-x-0 bottom-0 p-12">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80">
              {event.templateId}
            </div>
            <h1 className="mt-6 text-5xl font-extrabold tracking-tight">{event.customization?.heroText || event.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-white/80">{event.customization?.heroSubtext || event.description}</p>
            <EventMeta event={event} tone="dark" />
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 p-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section>
              <h2 className="text-2xl font-bold">About</h2>
              <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-white/80">{event.description}</p>
            </section>
            <section className="mt-12">
              <h2 className="text-2xl font-bold">Tickets</h2>
              <div className="mt-6 flex flex-col gap-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10"
                  >
                    <div>
                      <h3 className="text-lg font-bold">{ticket.name}</h3>
                      <p className="text-sm text-white/60">{ticket.description || 'Standard entry ticket'}</p>
                      <p className="mt-2 text-xl font-bold" style={{ color: 'var(--secondary)' }}>
                        {formatLKR(ticket.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => onTicketChange(ticket.id, (selectedTickets[ticket.id] || 0) - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xl font-bold hover:bg-white/10"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-lg font-bold">{selectedTickets[ticket.id] || 0}</span>
                      <button
                        onClick={() => onTicketChange(ticket.id, (selectedTickets[ticket.id] || 0) + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xl font-bold hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div>
            <CheckoutPanel
              tickets={tickets}
              selectedTickets={selectedTickets}
              totalAmount={totalAmount}
              onCheckout={onCheckout}
              isPurchasing={isPurchasing}
              footerText="MVP demo checkout."
            />
          </div>
        </div>
      </div>
    </div>
  ),
};

export const landingTemplates: LandingTemplate[] = [Template1, Template2, Template3, Template4];

export function getLandingTemplate(id: string | undefined): LandingTemplate {
  return landingTemplates.find((t) => t.id === id) || Template1;
}

const CanvasTemplate: LandingTemplate = {
  id: 'template-canvas',
  name: 'Blank Canvas (Designer)',
  description: 'Section-based drag/drop builder designed by organizer.',
  previewSeed: 'blank-canvas',
  render: (props) => {
    const sections = safeSections(props.event.customization?.sections);
    if (sections) return <SectionsRenderer {...props} design={sections} />;
    return <CanvasRenderer {...props} />;
  },
};

export const landingTemplatesAll: LandingTemplate[] = [Template1, Template2, Template3, Template4, CanvasTemplate];

export function getLandingTemplateAll(id: string | undefined): LandingTemplate {
  return landingTemplatesAll.find((t) => t.id === id) || Template1;
}

