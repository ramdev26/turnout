import React, { useEffect, useMemo, useState } from 'react';
import { CanvasElement, CanvasDesign, Event, SectionBlock, SectionDesign, Ticket } from '../types';
import { api } from '../api/client';
import type { Speaker, Session } from '../types';
import { landingCssVars, resolveTemplateId } from '../themes/eventThemes';
import {
  CheckoutPanel,
  CountdownDisplay,
  EventBanner,
  EventMeta,
  LandingTopBar,
  SectionHeading,
  TicketsList,
  landingShellStyle,
  themeDisplayName,
} from '../components/landing/LandingShared';

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

function safeCanvas(design: CanvasDesign | undefined): CanvasDesign | null {
  if (!design || design.version !== 1 || !design.canvas || !Array.isArray(design.elements)) return null;
  const width = Math.max(600, Math.min(1600, design.canvas.width || 1100));
  const height = Math.max(600, Math.min(2400, design.canvas.height || 900));
  return {
    version: 1,
    canvas: { width, height, background: design.canvas.background || '#111714' },
    elements: design.elements.filter((e) => e && typeof e.id === 'string' && typeof e.type === 'string') as CanvasElement[],
  };
}

function safeSections(design: SectionDesign | undefined): SectionDesign | null {
  if (!design || design.version !== 1 || !design.theme || !Array.isArray(design.blocks)) return null;
  return {
    version: 1,
    theme: {
      contentBackground: design.theme.contentBackground || 'var(--landing-surface)',
      border: design.theme.border || 'var(--landing-border)',
    },
    blocks: design.blocks.filter((b) => b && typeof b.id === 'string' && typeof b.type === 'string') as SectionBlock[],
  };
}

const sectionCardStyle: React.CSSProperties = {
  borderColor: 'var(--landing-border)',
  background: 'var(--landing-surface)',
  color: 'var(--landing-text)',
};

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

  const speakerById = useMemo(() => Object.fromEntries((speakers || []).map((s) => [s.id, s])), [speakers]);

  const sponsors = useMemo(() => {
    const block = design.blocks.find((b) => b.type === 'sponsors');
    const text = (block?.props as { itemsText?: string })?.itemsText;
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
    if (b.type === 'divider') {
      return <div className="h-px w-full" style={{ background: b.props?.color || 'var(--landing-border)' }} />;
    }

    if (b.type === 'hero') {
      const align = b.props?.align === 'center' ? 'text-center items-center' : 'text-left items-start';
      return (
        <div className={`flex flex-col gap-5 ${align}`}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--landing-text-muted)' }}>
            {b.props?.eyebrow || 'Welcome'}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: 'var(--landing-text)' }}>
            {b.props?.title || event.customization?.heroText || event.title}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
            {b.props?.subtitle || event.customization?.heroSubtext || event.description}
          </p>
          <div className="w-full overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--landing-border)' }}>
            <img
              src={b.props?.imageUrl || event.bannerUrl}
              alt={event.title}
              referrerPolicy="no-referrer"
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
          <EventMeta event={event} tone="light" />
        </div>
      );
    }

    if (b.type === 'richText') {
      return (
        <div>
          <SectionHeading>{b.props?.title || 'About'}</SectionHeading>
          <p className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
            {b.props?.text || event.description}
          </p>
        </div>
      );
    }

    if (b.type === 'image' && b.props?.imageUrl) {
      return (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--landing-border)' }}>
          <img src={b.props.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />
        </div>
      );
    }

    if (b.type === 'countdown') {
      return <CountdownDisplay targetIso={event.date} title={b.props?.title || 'Event starts in'} />;
    }

    if (b.type === 'tickets') {
      return (
        <div>
          <SectionHeading subtitle="Choose your tickets and proceed to secure checkout.">{b.props?.title || 'Tickets'}</SectionHeading>
          <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} accent="var(--secondary)" />
          <div className="mt-8 hidden md:block">
            <CheckoutPanel
              tickets={tickets}
              selectedTickets={selectedTickets}
              totalAmount={totalAmount}
              onCheckout={onCheckout}
              isPurchasing={isPurchasing}
            />
          </div>
        </div>
      );
    }

    if (b.type === 'speakers') {
      const list = speakers;
      return (
        <div>
          <SectionHeading subtitle={b.props?.subtitle}>{b.props?.title || 'Speakers'}</SectionHeading>
          {list === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border" style={sectionCardStyle} />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              Speaker lineup coming soon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <div key={s.id} className="rounded-2xl border p-5" style={sectionCardStyle}>
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt={s.name} className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                      style={{ background: 'var(--landing-surface-muted)', color: 'var(--primary)' }}
                    >
                      {s.name?.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="mt-4 font-semibold">{s.name}</p>
                  <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                    {[s.title, s.company].filter(Boolean).join(' · ')}
                  </p>
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
          <SectionHeading subtitle={b.props?.subtitle}>{b.props?.title || 'Agenda'}</SectionHeading>
          {list === null ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border" style={sectionCardStyle} />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              Schedule will be published soon.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {list.map((s) => (
                <div key={s.id} className="rounded-2xl border p-5" style={sectionCardStyle}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                    {new Date(s.startsAt).toLocaleString()} — {new Date(s.endsAt).toLocaleTimeString()}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{s.title}</p>
                  {s.speakerIds?.length ? (
                    <p className="mt-2 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                      {s.speakerIds.map((id) => speakerById[id]?.name || 'Speaker').join(', ')}
                    </p>
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
          <SectionHeading>{b.props?.title || 'Partners'}</SectionHeading>
          {sponsors.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              Our partners will be listed here.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sponsors.map((sp, idx) => {
                const card = (
                  <div className="flex h-24 items-center justify-center rounded-2xl border p-4" style={sectionCardStyle}>
                    {sp.logoUrl ? (
                      <img src={sp.logoUrl} alt={sp.name} className="max-h-14 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="font-semibold">{sp.name}</span>
                    )}
                  </div>
                );
                return sp.linkUrl ? (
                  <a key={idx} href={sp.linkUrl} target="_blank" rel="noreferrer">
                    {card}
                  </a>
                ) : (
                  <div key={idx}>{card}</div>
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
          ? { background: 'transparent', color: 'var(--landing-text)', border: '2px solid var(--landing-border)' }
          : variant === 'secondary'
            ? { background: 'var(--secondary)', color: '#fff' }
            : { background: 'var(--primary)', color: '#fff' };
      return (
        <button
          type="button"
          onClick={onCheckout}
          disabled={isPurchasing}
          className="w-full rounded-2xl px-5 py-4 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
          style={style}
        >
          {b.props?.text || 'Get tickets'}
        </button>
      );
    }

    return null;
  };

  return (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }} className="w-full">
      <LandingTopBar event={event} />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-col gap-0 overflow-hidden rounded-3xl border shadow-sm" style={sectionCardStyle}>
          {design.blocks.map((b, i) => (
            <div
              key={b.id}
              className="border-b p-8 last:border-b-0 sm:p-10"
              style={{ borderColor: 'var(--landing-border)' }}
            >
              {renderBlock(b)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CanvasRenderer(props: LandingTemplateProps) {
  const design = safeCanvas(props.event.customization?.canvas);
  if (!design) return Template1.render(props);

  const { event, tickets, selectedTickets, onTicketChange, onCheckout, isPurchasing } = props;

  const renderEl = (el: CanvasElement) => {
    const base: React.CSSProperties = { position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h };
    if (el.type === 'button') {
      return (
        <div key={el.id} style={base}>
          <button
            type="button"
            onClick={onCheckout}
            disabled={isPurchasing}
            className="h-full w-full font-bold"
            style={{
              borderRadius: el.props?.radius ?? 16,
              background: el.props?.bg || 'var(--primary)',
              color: el.props?.color || '#fff',
            }}
          >
            {isPurchasing ? '…' : el.props?.text || 'Get tickets'}
          </button>
        </div>
      );
    }
    if (el.type === 'ticketsEmbed') {
      return (
        <div key={el.id} style={{ ...base, overflow: 'auto', borderRadius: 16, border: '1px solid var(--landing-border)', background: 'var(--landing-surface)', padding: 12 }}>
          <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
        </div>
      );
    }
    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          style={{
            ...base,
            whiteSpace: 'pre-wrap',
            fontSize: el.props?.size ?? 20,
            fontWeight: el.props?.weight ?? 700,
            color: el.props?.color || 'var(--landing-text)',
          }}
        >
          {el.props?.text}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <LandingTopBar event={event} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="relative overflow-hidden rounded-3xl border" style={{ ...sectionCardStyle, width: design.canvas.width, height: design.canvas.height, background: design.canvas.background }}>
          {design.elements.map(renderEl)}
        </div>
      </div>
    </div>
  );
}

const Template1: LandingTemplate = {
  id: 'template-1',
  name: 'Cinematic Hero',
  description: 'Full-width hero with story and tickets.',
  previewSeed: 'cinematic-hero',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <LandingTopBar event={event} />
      <div className="relative">
        <EventBanner event={event} heightClass="h-[min(58vh,520px)]" overlay="dark" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-10 pt-24 sm:px-8 lg:px-12">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">
            {themeDisplayName(event)}
          </span>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {event.customization?.heroText || event.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            {event.customization?.heroSubtext || event.description}
          </p>
          <EventMeta event={event} tone="dark" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-16">
        <div className="lg:col-span-2">
          <CountdownDisplay targetIso={event.date} />
          <section className="mt-10">
            <SectionHeading subtitle="Everything you need to know before you book.">About this event</SectionHeading>
            <p className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
              {event.description}
            </p>
          </section>
          <section className="mt-12">
            <SectionHeading>Tickets</SectionHeading>
            <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
          </section>
        </div>
        <div className="hidden md:block">
          <CheckoutPanel tickets={tickets} selectedTickets={selectedTickets} totalAmount={totalAmount} onCheckout={onCheckout} isPurchasing={isPurchasing} />
        </div>
      </div>
    </div>
  ),
};

const Template2: LandingTemplate = {
  id: 'template-2',
  name: 'Centered Minimal',
  description: 'Clean, airy layout for professional events.',
  previewSeed: 'centered-minimal',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <LandingTopBar event={event} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="text-center">
          <span
            className="inline-flex rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{ background: 'var(--landing-surface-muted)', color: 'var(--landing-text-muted)' }}
          >
            {event.status === 'published' ? 'Tickets available' : event.status}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: 'var(--landing-text)' }}>
            {event.customization?.heroText || event.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
            {event.customization?.heroSubtext || event.description}
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: 'var(--landing-border)' }}>
          <EventBanner event={event} heightClass="h-64 sm:h-80" overlay="none" />
        </div>

        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-xl">
            <EventMeta event={event} tone="light" />
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <CountdownDisplay targetIso={event.date} compact />
            <div className="mt-10">
              <SectionHeading>Tickets</SectionHeading>
              <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} accent="var(--secondary)" />
            </div>
          </div>
          <div className="hidden md:block">
            <CheckoutPanel tickets={tickets} selectedTickets={selectedTickets} totalAmount={totalAmount} onCheckout={onCheckout} isPurchasing={isPurchasing} />
          </div>
        </div>
      </div>
    </div>
  ),
};

const Template3: LandingTemplate = {
  id: 'template-3',
  name: 'Split Gradient',
  description: 'Modern split layout with gradient hero.',
  previewSeed: 'split-gradient',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <LandingTopBar event={event} />
      <div className="mx-auto grid max-w-7xl lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-2">
        <div className="relative flex flex-col justify-center px-6 py-12 lg:px-12 lg:py-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background: `radial-gradient(900px circle at 0% 0%, var(--primary), transparent 55%), radial-gradient(700px circle at 100% 20%, var(--secondary), transparent 50%)`,
            }}
          />
          <div className="relative">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--landing-text-muted)' }}>
              {themeDisplayName(event)}
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: 'var(--landing-text)' }}>
              {event.customization?.heroText || event.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
              {event.customization?.heroSubtext || event.description}
            </p>
            <div className="mt-8 overflow-hidden rounded-2xl border shadow-md" style={{ borderColor: 'var(--landing-border)' }}>
              <EventBanner event={event} heightClass="h-56 sm:h-64" overlay="none" />
            </div>
            <div className="mt-8">
              <EventMeta event={event} tone="light" />
            </div>
            <div className="mt-8">
              <CountdownDisplay targetIso={event.date} compact />
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-12 lg:border-l lg:border-t-0 lg:px-12 lg:py-16" style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface)' }}>
          <SectionHeading subtitle="Select quantities and checkout securely.">Tickets</SectionHeading>
          <TicketsList tickets={tickets} selectedTickets={selectedTickets} onTicketChange={onTicketChange} />
          <div className="mt-10 hidden md:block">
            <CheckoutPanel tickets={tickets} selectedTickets={selectedTickets} totalAmount={totalAmount} onCheckout={onCheckout} isPurchasing={isPurchasing} />
          </div>
        </div>
      </div>
    </div>
  ),
};

const Template4: LandingTemplate = {
  id: 'template-4',
  name: 'Dark Poster',
  description: 'High-contrast poster style for nightlife and launches.',
  previewSeed: 'dark-poster',
  render: ({ event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing }) => (
    <div style={{ ...landingCssVars(event.customization), ...landingShellStyle() }}>
      <LandingTopBar event={event} />
      <div className="relative">
        <EventBanner event={event} heightClass="h-[min(50vh,440px)]" overlay="dark" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--landing-page-bg)] via-black/70 to-transparent px-4 pb-8 pt-20 sm:px-8 lg:px-12">
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
            {themeDisplayName(event)}
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">{event.customization?.heroText || event.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/80">{event.customization?.heroSubtext || event.description}</p>
          <EventMeta event={event} tone="dark" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">
        <div className="lg:col-span-2">
          <CountdownDisplay targetIso={event.date} />
          <section className="mt-10">
            <SectionHeading>About</SectionHeading>
            <p className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
              {event.description}
            </p>
          </section>
          <section className="mt-12">
            <SectionHeading>Tickets</SectionHeading>
            <TicketsList
              tickets={tickets}
              selectedTickets={selectedTickets}
              onTicketChange={onTicketChange}
              accent="var(--secondary)"
              variant="dark"
            />
          </section>
        </div>
        <div className="hidden md:block">
          <CheckoutPanel tickets={tickets} selectedTickets={selectedTickets} totalAmount={totalAmount} onCheckout={onCheckout} isPurchasing={isPurchasing} />
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
  name: 'Custom layout',
  description: 'Section-based or canvas designer layout.',
  previewSeed: 'blank-canvas',
  render: (props) => {
    const sections = safeSections(props.event.customization?.sections);
    if (sections) return <SectionsRenderer {...props} design={sections} />;
    return <CanvasRenderer {...props} />;
  },
};

export const landingTemplatesAll: LandingTemplate[] = [...landingTemplates, CanvasTemplate];

export function getLandingTemplateAll(id: string | undefined): LandingTemplate {
  return landingTemplatesAll.find((t) => t.id === id) || Template1;
}

export function getLandingTemplateForEvent(event: Event): LandingTemplate {
  return getLandingTemplateAll(resolveTemplateId(event));
}
