import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Monitor, Smartphone, X } from 'lucide-react';
import type { Event, Ticket } from '../../types';
import { getLandingTemplateForEvent } from '../../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../../themes/eventThemes';
import { loadLandingFont } from '../../themes/landingFonts';
import { formatLKRWhole } from '../../utils/money';
import { cn } from '../../utils/cn';

const MOBILE_CANVAS_WIDTH = 390;
const MOBILE_CANVAS_HEIGHT = 780;

const DESKTOP_CANVAS_WIDTH = 1280;
const DESKTOP_CANVAS_HEIGHT = 900;

type PreviewMode = 'mobile' | 'desktop';

type EventLandingLivePreviewProps = {
  event: Event;
  tickets: Ticket[];
  publicUrl?: string;
  onClose?: () => void;
  className?: string;
};

function BrowserChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
        className
      )}
      style={{ borderColor: 'rgba(255,255,255,0.14)', background: '#111' }}
    >
      <div
        className="flex items-center gap-1.5 border-b px-3 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#1c1c1e' }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-2 truncate text-[10px] text-white/45">{title}</span>
      </div>
      {children}
    </div>
  );
}

export const EventLandingLivePreview: React.FC<EventLandingLivePreviewProps> = ({
  event,
  tickets,
  publicUrl,
  onClose,
  className,
}) => {
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<PreviewMode>('mobile');
  const desktopHostRef = useRef<HTMLDivElement>(null);
  const [desktopScale, setDesktopScale] = useState(0.34);

  const template = useMemo(() => getLandingTemplateForEvent(event), [event]);
  const landingVars = useMemo(
    () => landingCssVars(normalizeLandingCustomization(event.customization)),
    [event.customization]
  );

  useEffect(() => {
    loadLandingFont(event.customization?.fontFamily || 'fraunces');
  }, [event.customization?.fontFamily]);

  useEffect(() => {
    if (mode !== 'desktop') return;
    const el = desktopHostRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setDesktopScale(Math.min(1, width / DESKTOP_CANVAS_WIDTH));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const totalAmount = useMemo(
    () =>
      tickets.reduce((sum, ticket) => {
        const qty = selectedTickets[ticket.id] || 0;
        return sum + ticket.price * qty;
      }, 0),
    [selectedTickets, tickets]
  );

  const renderLanding = () =>
    template.render({
      event: { ...event, status: 'published' },
      tickets,
      selectedTickets,
      onTicketChange: (ticketId, quantity) => {
        setSelectedTickets((prev) => {
          const next = { ...prev };
          if (quantity <= 0) delete next[ticketId];
          else next[ticketId] = quantity;
          return next;
        });
      },
      totalAmount,
      onCheckout: () => {},
      isPurchasing: false,
    });

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border', className)}
      style={{ borderColor: 'rgba(255,255,255,0.12)', background: '#0b1220' }}
    >
      <div
        className="flex shrink-0 flex-col gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.95)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white">Live preview</p>
            <p className="truncate text-[11px] text-white/60">
              {mode === 'mobile'
                ? `${MOBILE_CANVAS_WIDTH}px · mobile layout`
                : `${DESKTOP_CANVAS_WIDTH}px · desktop layout`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {publicUrl ? (
              <button
                type="button"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/10"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close live preview"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-1 rounded-lg p-1"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          role="tablist"
          aria-label="Preview device"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mobile'}
            onClick={() => setMode('mobile')}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition',
              mode === 'mobile' ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'desktop'}
            onClick={() => setMode('desktop')}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition',
              mode === 'desktop' ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#020617_70%)] px-3 py-5 sm:px-4">
        {mode === 'mobile' ? (
          <div className="mx-auto flex w-full max-w-[430px] justify-center">
            <BrowserChrome title="Event landing · Mobile" className="w-full max-w-[390px]">
              <div
                className="event-settings-mobile-preview overflow-hidden bg-white"
                style={{
                  width: '100%',
                  height: `min(${MOBILE_CANVAS_HEIGHT}px, calc(100vh - 16rem))`,
                  maxHeight: MOBILE_CANVAS_HEIGHT,
                }}
              >
                <div className="h-full overflow-x-hidden overflow-y-auto overscroll-contain" style={landingVars}>
                  {renderLanding()}
                </div>
              </div>
            </BrowserChrome>
          </div>
        ) : (
          <div ref={desktopHostRef} className="mx-auto w-full max-w-[440px]">
            <BrowserChrome title="Event landing · Desktop" className="w-full">
              <div
                className="event-settings-desktop-preview overflow-hidden bg-white"
                style={{ height: (DESKTOP_CANVAS_HEIGHT - 32) * desktopScale }}
              >
                <div
                  style={{
                    width: DESKTOP_CANVAS_WIDTH,
                    height: DESKTOP_CANVAS_HEIGHT - 32,
                    transform: `scale(${desktopScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <div
                    className="h-full overflow-x-hidden overflow-y-auto overscroll-contain"
                    style={landingVars}
                  >
                    {renderLanding()}
                  </div>
                </div>
              </div>
            </BrowserChrome>
          </div>
        )}
      </div>

      {totalAmount > 0 && (
        <div
          className="shrink-0 border-t px-3 py-2 text-center text-[11px] font-medium text-white/70"
          style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.95)' }}
        >
          Preview total: {formatLKRWhole(totalAmount)} · checkout disabled in preview
        </div>
      )}
    </div>
  );
};
