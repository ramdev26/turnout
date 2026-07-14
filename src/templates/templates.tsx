import React, { useEffect, useMemo, useState } from 'react';
import { CanvasElement, CanvasDesign, Event, SectionBlock, SectionDesign, Ticket } from '../types';
import { api } from '../api/client';
import type { Speaker, Session } from '../types';
import { resolveTemplateId } from '../themes/eventThemes';
import { LandingShowcasePage } from '../components/landing/LandingShowcase';
import { LandingClassicPage } from '../components/landing/LandingClassic';
import { LandingArenaPage } from '../components/landing/LandingArena';
import { LandingSpotlightPage } from '../components/landing/LandingSpotlight';
import {
  AboutBlock,
  CheckoutPanel,
  CountdownDisplay,
  EventBanner,
  HeroSubtitle,
  HeroTitle,
  LandingContentGrid,
  LandingPageShell,
  LandingTopBar,
  PremiumBadge,
  SectionHeading,
  TicketsList,
  TicketsSection,
} from '../components/landing/LandingShared';

export type TemplateId = 'template-2' | 'template-5' | 'template-6' | 'template-7' | 'template-canvas';

/** Layout templates organizers can pick in the design console (excludes custom canvas). */
export type LayoutTemplateId = Exclude<TemplateId, 'template-canvas'>;

export const LANDING_LAYOUT_TEMPLATES: {
  id: LayoutTemplateId;
  name: string;
  description: string;
}[] = [
  { id: 'template-2', name: 'Showcase', description: 'Editorial hero with sidebar checkout' },
  { id: 'template-6', name: 'Arena', description: 'Venue carousel with seating picker' },
  { id: 'template-7', name: 'Spotlight', description: 'Featured banner with sticky booking card' },
  { id: 'template-5', name: 'Classic', description: 'Clean single-column stack' },
];

const LEGACY_TEMPLATE_IDS = new Set(['template-1', 'template-3', 'template-4']);

export function resolveLayoutTemplateId(id?: string | null): LayoutTemplateId {
  if (id === 'template-2' || id === 'template-5' || id === 'template-6' || id === 'template-7') return id;
  if (id && LEGACY_TEMPLATE_IDS.has(id)) return 'template-2';
  return 'template-2';
}

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

function ticketsMain(props: LandingTemplateProps) {
  return (
    <TicketsSection>
      <TicketsList
        tickets={props.tickets}
        selectedTickets={props.selectedTickets}
        onTicketChange={props.onTicketChange}
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
          <div className="landing-poster-frame landing-poster-frame--hero landing-poster-frame--showcase mx-auto mb-8">
            <EventBanner event={event} overlay="none" imageClassName="landing-poster-img" />
          </div>
          <PremiumBadge>{b.props?.eyebrow || 'Featured event'}</PremiumBadge>
          <HeroTitle className="mt-6">{b.props?.title || event.title}</HeroTitle>
          {landingHeroSubtitle(event, b.props?.subtitle) ? <HeroSubtitle>{landingHeroSubtitle(event, b.props?.subtitle)}</HeroSubtitle> : null}
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
        <button type="button" onClick={props.onCheckout} className="landing-showcase-btn-cta w-full min-h-[48px]">
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
              <div key={s.id} className="landing-showcase-card p-5">
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
              <div key={s.id} className="landing-showcase-card p-5">
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
    if (b.type === 'image' && b.props?.imageUrl) {
      return (
        <div className="landing-showcase-card overflow-hidden">
          <img
            src={b.props.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="block h-auto max-h-[min(70vh,560px)] w-full object-contain object-center"
            style={{ background: 'var(--showcase-card-muted)' }}
          />
        </div>
      );
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
  if (!design) return TemplateShowcase.render(props);
  return (
    <LandingPageShell event={props.event}>
      <LandingTopBar event={props.event} />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <div className="landing-showcase-card overflow-hidden" style={{ width: design.canvas.width, height: design.canvas.height, background: design.canvas.background }} />
      </div>
    </LandingPageShell>
  );
}

const TemplateShowcase: LandingTemplate = {
  id: 'template-2',
  name: 'Showcase',
  description: 'Premium two-column layout with hero, passes, and live order summary.',
  previewSeed: 'centered-minimal',
  render: (props) => <LandingShowcasePage {...props} />,
};

const TemplateClassic: LandingTemplate = {
  id: 'template-5',
  name: 'Classic',
  description: 'Clean centered single-column layout for any screen size.',
  previewSeed: 'classic-stack',
  render: (props) => <LandingClassicPage {...props} />,
};

const TemplateArena: LandingTemplate = {
  id: 'template-6',
  name: 'Arena',
  description: 'Mobile-first venue layout with carousel, seating cards, and inline checkout.',
  previewSeed: 'arena-venue',
  render: (props) => <LandingArenaPage {...props} />,
};

const TemplateSpotlight: LandingTemplate = {
  id: 'template-7',
  name: 'Spotlight',
  description: 'Featured banner layout with sticky booking card and mobile checkout bar.',
  previewSeed: 'spotlight-concert',
  render: (props) => <LandingSpotlightPage {...props} />,
};

export const landingTemplates: LandingTemplate[] = [
  TemplateShowcase,
  TemplateArena,
  TemplateSpotlight,
  TemplateClassic,
];

export function getLandingTemplate(id: string | undefined): LandingTemplate {
  const resolved = resolveLayoutTemplateId(id);
  return landingTemplates.find((t) => t.id === resolved) || TemplateShowcase;
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
  if (id === 'template-canvas') return CanvasTemplate;
  return getLandingTemplate(id);
}

export function getLandingTemplateForEvent(event: Event): LandingTemplate {
  return getLandingTemplateAll(resolveTemplateId(event));
}
