import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Monitor, Smartphone, X } from 'lucide-react';
import type { Event, Ticket } from '../../types';
import { getLandingTemplateForEvent } from '../../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../../themes/eventThemes';
import { loadLandingFont } from '../../themes/landingFonts';
import { formatLKRWhole } from '../../utils/money';
import { cn } from '../../utils/cn';

/** Typical mobile viewport width (iPhone / Android). */
const MOBILE_SCREEN_WIDTH = 390;
const MOBILE_SCREEN_HEIGHT = 780;

/** Desktop canvas used for Arena (two-column) live preview. */
const DESKTOP_CANVAS_WIDTH = 1280;
const DESKTOP_CANVAS_HEIGHT = 900;

type EventLandingLivePreviewProps = {
  event: Event;
  tickets: Ticket[];
  publicUrl?: string;
  onClose?: () => void;
  className?: string;
};

export const EventLandingLivePreview: React.FC<EventLandingLivePreviewProps> = ({
  event,
  tickets,
  publicUrl,
  onClose,
  className,
}) => {
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});
  const desktopHostRef = useRef<HTMLDivElement>(null);
  const [desktopScale, setDesktopScale] = useState(0.34);

  const template = useMemo(() => getLandingTemplateForEvent(event), [event]);
  const isArena = template.id === 'template-6';
  const landingVars = useMemo(
    () => landingCssVars(normalizeLandingCustomization(event.customization)),
    [event.customization]
  );

  useEffect(() => {
    loadLandingFont(event.customization?.fontFamily || 'fraunces');
  }, [event.customization?.fontFamily]);

  useEffect(() => {
    if (!isArena) return;
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
  }, [isArena]);

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
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.95)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#c0ff72' }}
          >
            {isArena ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white">
              {isArena ? 'Desktop preview' : 'Mobile preview'}
            </p>
            <p className="truncate text-[11px] text-white/60">
              {isArena
                ? `${DESKTOP_CANVAS_WIDTH}px · real Arena layout`
                : `${MOBILE_SCREEN_WIDTH}px · updates as you edit`}
            </p>
          </div>
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#020617_70%)] px-3 py-5 sm:px-4">
        {isArena ? (
          <div ref={desktopHostRef} className="mx-auto w-full max-w-[440px]">
            <div
              className="overflow-hidden rounded-xl border shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              style={{
                borderColor: 'rgba(255,255,255,0.14)',
                background: '#111',
                height: DESKTOP_CANVAS_HEIGHT * desktopScale,
              }}
            >
              <div
                className="flex items-center gap-1.5 border-b px-3 py-2"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#1c1c1e' }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-2 truncate text-[10px] text-white/45">Event landing · Arena</span>
              </div>
              <div
                className="event-settings-desktop-preview overflow-hidden bg-white"
                style={{ height: `calc(100% - 2rem)` }}
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
            </div>
            <p className="mt-3 text-center text-[11px] text-white/45">
              Scaled desktop view of the real Arena page
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[430px] justify-center">
            <div
              className="relative shrink-0 rounded-[2.75rem] p-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              style={{
                background: 'linear-gradient(160deg, #3f3f46 0%, #18181b 45%, #09090b 100%)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <div
                className="absolute -left-[3px] top-[108px] h-10 w-[3px] rounded-l bg-zinc-600"
                aria-hidden
              />
              <div
                className="absolute -left-[3px] top-[156px] h-14 w-[3px] rounded-l bg-zinc-600"
                aria-hidden
              />
              <div
                className="absolute -right-[3px] top-[132px] h-16 w-[3px] rounded-r bg-zinc-600"
                aria-hidden
              />

              <div className="relative px-3 pt-2">
                <div className="mx-auto h-6 w-[34%] min-w-[96px] max-w-[128px] rounded-full bg-black" aria-hidden />
                <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-semibold text-white/55">
                  <span>9:41</span>
                  <span className="tracking-widest">●●●</span>
                </div>
              </div>

              <div
                className="event-settings-mobile-preview relative mt-1 overflow-hidden rounded-[2rem] bg-black"
                style={{
                  width: MOBILE_SCREEN_WIDTH,
                  height: `min(${MOBILE_SCREEN_HEIGHT}px, calc(100vh - 14rem))`,
                  maxHeight: MOBILE_SCREEN_HEIGHT,
                }}
              >
                <div className="h-full overflow-x-hidden overflow-y-auto overscroll-contain" style={landingVars}>
                  {renderLanding()}
                </div>
              </div>

              <div className="mx-auto mt-2.5 h-1 w-[34%] min-w-[96px] rounded-full bg-white/25" aria-hidden />
            </div>
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
