import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Event, Ticket } from '../../types';
import { getLandingTemplateForEvent } from '../../templates/templates';
import { landingCssVars, normalizeLandingCustomization } from '../../themes/eventThemes';
import { loadLandingFont } from '../../themes/landingFonts';
import { formatLKRWhole } from '../../utils/money';
import { cn } from '../../utils/cn';

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

  const template = useMemo(() => getLandingTemplateForEvent(event), [event]);
  const landingVars = useMemo(
    () => landingCssVars(normalizeLandingCustomization(event.customization)),
    [event.customization]
  );

  useEffect(() => {
    loadLandingFont(event.customization?.fontFamily || 'fraunces');
  }, [event.customization?.fontFamily]);

  const totalAmount = useMemo(
    () =>
      tickets.reduce((sum, ticket) => {
        const qty = selectedTickets[ticket.id] || 0;
        return sum + ticket.price * qty;
      }, 0),
    [selectedTickets, tickets]
  );

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border', className)}
      style={{ borderColor: 'var(--landing-border, #e2e8f0)', background: '#0f172a' }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.95)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-white">Live preview</p>
          <p className="truncate text-[11px] text-white/60">Updates as you edit — save to publish</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-950">
        <div className="mx-auto w-full max-w-[420px] border-x border-white/10 shadow-2xl" style={landingVars}>
          {template.render({
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
          })}
        </div>
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
