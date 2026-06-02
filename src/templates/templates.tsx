import React, { useEffect, useMemo, useState } from 'react';
import { CanvasElement, CanvasDesign, Event, SectionBlock, SectionDesign, Ticket } from '../types';
import { api } from '../api/client';
import type { Speaker, Session } from '../types';
import { landingCssVars, resolveTemplateId } from '../themes/eventThemes';
import {
  AboutBlock,
  CheckoutPanel,
  CountdownDisplay,
  EventBanner,
  EventMeta,
  HeroCTA,
  HeroSubtitle,
  HeroTitle,
  LandingContentGrid,
  LandingPageShell,
  LandingTopBar,
  PremiumBadge,
  SectionHeading,
  TicketsList,
  TicketsSection,
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

function checkoutAside(props: LandingTemplateProps) {
  return (
    <CheckoutPanel
      tickets={props.tickets}
      selectedTickets={props.selectedTickets}
      totalAmount={props.totalAmount}
      onCheckout={props.onCheckout}
      isPurchasing={props.isPurchasing}
    />
  );
}

function ticketsMain(props: LandingTemplateProps, variant: 'default' | 'dark' = 'default') {
  return (
    <TicketsSection>
      <TicketsList
        tickets={props.tickets}
        selectedTickets={props.selectedTickets}
        onTicketChange={props.onTicketChange}
        accent={variant === 'dark' ? 'var(--secondary)' : 'var(--primary)'}
        variant={variant}
      />
    </TicketsSection>
  );
}

function landingHeroSubtitle(event: Event, override?: string): string {
  const custom = (override ?? '').trim();
  if (custom) return custom;
  return (event.customization?.heroSubtext || '').trim();
}

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

function SectionsRenderer(props: LandingTemplateProps & { design: SectionDesign }) {
  const { event, design } = props;
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

  const renderBlock = (b: SectionBlock) => {
    if (b.type === 'hero') {
      return (
        <div className="text-center sm:text-left">
          <PremiumBadge>{b.props?.eyebrow || 'Featured event'}</PremiumBadge>
          <HeroTitle className="mt-6">{b.props?.title || event.title}</HeroTitle>
          {landingHeroSubtitle(event, b.props?.subtitle) ? <HeroSubtitle>{landingHeroSubtitle(event, b.props?.subtitle)}</HeroSubtitle> : null}
          <div className="mt-8 overflow-hidden rounded-3xl border shadow-2xl" style={{ borderColor: 'var(--landing-border)' }}>
            <EventBanner event={event} heightClass="aspect-[21/9] h-auto min-h-[240px]" overlay="light" />
          </div>
        </div>
      );
    }
    if (b.type === 'tickets') {
      return ticketsMain(props);
    }
    if (b.type === 'countdown') {
      return <CountdownDisplay targetIso={event.date} title={b.props?.title} tba={!!event.customization?.scheduleTba} />;
    }
    if (b.type === 'button') {
      return (
        <button type="button" onClick={props.onCheckout} className="landing-btn-primary w-full rounded-2xl py-4 text-sm font-bold text-white">
          {b.props?.text || 'Get tickets'}
        </button>
      );
    }
    if (b.type === 'speakers' && speakers?.length) {
      return (
        <div>
          <SectionHeading>{b.props?.title || 'Speakers'}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {speakers.map((s) => (
              <div key={s.id} className="landing-card-premium rounded-2xl p-5">
                <p className="font-bold">{s.name}</p>
                <p className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  {[s.title, s.company].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (b.type === 'agenda' && sessions?.length) {
      return (
        <div>
          <SectionHeading>{b.props?.title || 'Schedule'}</SectionHeading>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="landing-card-premium rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                  {new Date(s.startsAt).toLocaleString()}
                </p>
                <p className="mt-2 font-semibold">{s.title}</p>
                {s.speakerIds?.length ? (
                  <p className="mt-1 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                    {s.speakerIds.map((id) => speakerById[id]?.name).filter(Boolean).join(', ')}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (b.type === 'richText') {
      return <AboutBlock event={{ ...event, description: b.props?.text || event.description }} />;
    }
    return null;
  };

  return (
    <LandingPageShell event={event}>
      <LandingTopBar event={event} onGetTickets={props.onCheckout} />
      <LandingContentGrid
        main={<div className="space-y-12">{design.blocks.map((b) => <div key={b.id}>{renderBlock(b)}</div>)}</div>}
        aside={checkoutAside(props)}
      />
    </LandingPageShell>
  );
}

function CanvasRenderer(props: LandingTemplateProps) {
  const design = safeCanvas(props.event.customization?.canvas);
  if (!design) return Template1.render(props);
  return (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <div className="landing-card-premium overflow-hidden rounded-3xl" style={{ width: design.canvas.width, height: design.canvas.height, background: design.canvas.background }} />
      </div>
    </LandingPageShell>
  );
}

const Template1: LandingTemplate = {
  id: 'template-1',
  name: 'Cinematic',
  description: 'Full-bleed cinematic hero with editorial story.',
  previewSeed: 'cinematic-hero',
  render: (props) => (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10">
        <div className="relative">
          <EventBanner event={props.event} overlay="cinematic" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-14 pt-32 sm:px-8 lg:px-12 lg:pb-20">
            <PremiumBadge tone="hero">{themeDisplayName(props.event)}</PremiumBadge>
            <HeroTitle light className="mt-5 text-white">
              {props.event.customization?.heroText || props.event.title}
            </HeroTitle>
            {landingHeroSubtitle(props.event) ? <HeroSubtitle light>{landingHeroSubtitle(props.event)}</HeroSubtitle> : null}
            <EventMeta event={props.event} tone="dark" />
            <HeroCTA onGetTickets={props.onCheckout} light />
          </div>
        </div>
        <LandingContentGrid
          main={
            <div className="space-y-14">
              <CountdownDisplay targetIso={props.event.date} tba={!!props.event.customization?.scheduleTba} />
              <AboutBlock event={props.event} />
              {ticketsMain(props)}
            </div>
          }
          aside={checkoutAside(props)}
        />
      </div>
    </LandingPageShell>
  ),
};

const Template2: LandingTemplate = {
  id: 'template-2',
  name: 'Editorial',
  description: 'Refined centered editorial for conferences and galas.',
  previewSeed: 'centered-minimal',
  render: (props) => (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-10 text-center sm:px-6 lg:pt-16">
        <PremiumBadge>{props.event.status === 'published' ? 'Now booking' : props.event.status}</PremiumBadge>
        <HeroTitle className="mx-auto mt-6">{props.event.customization?.heroText || props.event.title}</HeroTitle>
        {landingHeroSubtitle(props.event) ? <HeroSubtitle>{landingHeroSubtitle(props.event)}</HeroSubtitle> : null}
        <div className="mt-10 overflow-hidden rounded-[2rem] border shadow-2xl" style={{ borderColor: 'var(--landing-border)', boxShadow: 'var(--landing-shadow-hover)' }}>
          <EventBanner event={props.event} heightClass="aspect-[16/10] h-auto min-h-[280px]" overlay="light" />
        </div>
        <div className="mt-8 flex justify-center">
          <EventMeta event={props.event} tone="light" />
        </div>
        <HeroCTA onGetTickets={props.onCheckout} />
      </div>
      <LandingContentGrid
        main={
          <div className="space-y-14">
            <CountdownDisplay targetIso={props.event.date} compact tba={!!props.event.customization?.scheduleTba} />
            <AboutBlock event={props.event} />
            {ticketsMain(props)}
          </div>
        }
        aside={checkoutAside(props)}
      />
    </LandingPageShell>
  ),
};

const Template3: LandingTemplate = {
  id: 'template-3',
  name: 'Avant',
  description: 'Split layout with luminous gradient panel.',
  previewSeed: 'split-gradient',
  render: (props) => (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10 lg:grid lg:min-h-[calc(100vh-5rem)] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-14 lg:px-14 lg:py-20">
          <PremiumBadge>{themeDisplayName(props.event)}</PremiumBadge>
          <HeroTitle className="mt-5">{props.event.customization?.heroText || props.event.title}</HeroTitle>
          {landingHeroSubtitle(props.event) ? <HeroSubtitle>{landingHeroSubtitle(props.event)}</HeroSubtitle> : null}
          <div className="mt-10 overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--landing-border)', boxShadow: 'var(--landing-shadow)' }}>
            <EventBanner event={props.event} heightClass="aspect-[4/3] h-auto" overlay="light" />
          </div>
          <EventMeta event={props.event} tone="light" />
          <div className="mt-10">
            <CountdownDisplay targetIso={props.event.date} compact tba={!!props.event.customization?.scheduleTba} />
          </div>
        </div>
        <div
          className="border-t px-6 py-14 lg:border-l lg:border-t-0 lg:px-14 lg:py-20"
          style={{ borderColor: 'var(--landing-border)', background: 'color-mix(in srgb, var(--landing-surface) 92%, transparent)' }}
        >
          <AboutBlock event={props.event} />
          <div className="mt-12">{ticketsMain(props)}</div>
          <div className="mt-10 hidden lg:block">{checkoutAside(props)}</div>
        </div>
      </div>
    </LandingPageShell>
  ),
};

const Template4: LandingTemplate = {
  id: 'template-4',
  name: 'Noir',
  description: 'Moody high-contrast for launches and nightlife.',
  previewSeed: 'dark-poster',
  render: (props) => (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10">
        <div className="relative">
          <EventBanner event={props.event} heightClass="h-[min(65vh,560px)]" overlay="cinematic" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--landing-page-bg)] via-black/80 to-transparent px-4 pb-12 pt-28 sm:px-8 lg:px-12">
            <span className="landing-eyebrow text-white/70">{themeDisplayName(props.event)}</span>
            <HeroTitle light className="mt-3">
              {props.event.customization?.heroText || props.event.title}
            </HeroTitle>
            {landingHeroSubtitle(props.event) ? <HeroSubtitle light>{landingHeroSubtitle(props.event)}</HeroSubtitle> : null}
            <EventMeta event={props.event} tone="dark" />
            <HeroCTA onGetTickets={props.onCheckout} light />
          </div>
        </div>
        <LandingContentGrid
          main={
            <div className="space-y-14">
              <CountdownDisplay targetIso={props.event.date} tba={!!props.event.customization?.scheduleTba} />
              <AboutBlock event={props.event} />
              {ticketsMain(props, 'dark')}
            </div>
          }
          aside={checkoutAside(props)}
        />
      </div>
    </LandingPageShell>
  ),
};

export const landingTemplates: LandingTemplate[] = [Template1, Template2, Template3, Template4];

export function getLandingTemplate(id: string | undefined): LandingTemplate {
  return landingTemplates.find((t) => t.id === id) || Template1;
}

const CanvasTemplate: LandingTemplate = {
  id: 'template-canvas',
  name: 'Custom',
  description: 'Designer-built layout.',
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
