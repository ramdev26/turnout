import React, { useMemo } from 'react';
import { Plus, Ticket, Trash2 } from 'lucide-react';
import type { OrganizerPaidEventReadiness } from '../../types';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';
import { PaidEventSetupGate } from './PaidEventSetupGate';

export type OrganizerTicketTierDraft = {
  /** Stable local key for React lists */
  key: string;
  /** Persisted ticket id when editing an existing event */
  id?: string;
  name: string;
  price: number;
  quantity: number;
  sold?: number;
  description?: string;
};

type OrganizerTicketsModuleProps = {
  ticketMode: 'free' | 'paid';
  onSwitchFree: () => void;
  onSwitchPaid: () => void;
  freeUnlimited: boolean;
  onFreeUnlimitedChange: (unlimited: boolean) => void;
  tiers: OrganizerTicketTierDraft[];
  onChangeTier: (index: number, patch: Partial<OrganizerTicketTierDraft>) => void;
  onAddTier: () => void;
  onRemoveTier: (index: number) => void;
  paidEventReadiness?: OrganizerPaidEventReadiness | null;
  onDismissPaidGate?: () => void;
  ui: CreateThemeUI;
  /** Show sold counts (Event Settings). */
  showSold?: boolean;
  /** Optional footer actions (e.g. Save tickets). */
  footer?: React.ReactNode;
  className?: string;
};

export function newTicketDraftKey(): string {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OrganizerTicketsModule({
  ticketMode,
  onSwitchFree,
  onSwitchPaid,
  freeUnlimited,
  onFreeUnlimitedChange,
  tiers,
  onChangeTier,
  onAddTier,
  onRemoveTier,
  paidEventReadiness,
  onDismissPaidGate,
  ui,
  showSold = false,
  footer,
  className,
}: OrganizerTicketsModuleProps) {
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const panelCn = cn('rounded-2xl border transition-[background,border-color,box-shadow] duration-300');

  const totalSeats = useMemo(
    () => tiers.reduce((sum, t) => sum + (Number.isFinite(t.quantity) ? Math.max(0, t.quantity) : 0), 0),
    [tiers]
  );

  const showPaidGate = ticketMode === 'paid' && paidEventReadiness && !paidEventReadiness.isReady;

  return (
    <div className={cn(className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
          Tickets
        </p>
        <div className="inline-flex rounded-xl border p-1" style={cardMutedStyle}>
          <button
            type="button"
            onClick={onSwitchFree}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
            style={ticketMode === 'free' ? accentButtonStyleFor(ui) : { color: ui.textMuted }}
          >
            Free
          </button>
          <button
            type="button"
            onClick={onSwitchPaid}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
            style={ticketMode === 'paid' ? accentButtonStyleFor(ui) : { color: ui.textMuted }}
          >
            Paid
          </button>
        </div>
      </div>

      {showPaidGate ? (
        <div className="mb-4">
          <PaidEventSetupGate
            readiness={paidEventReadiness}
            title="Paid ticket setup required"
            onDismiss={onDismissPaidGate}
          />
        </div>
      ) : null}

      {ticketMode === 'free' ? (
        <div className="space-y-3 rounded-2xl border p-4 transition-[background,border-color] duration-700" style={cardMutedStyle}>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
              Ticket name
            </label>
            <input
              value={tiers[0]?.name || ''}
              onChange={(e) => onChangeTier(0, { name: e.target.value })}
              placeholder="General Admission"
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3" style={cardStyle}>
            <div>
              <p className="text-sm font-medium" style={{ color: ui.text }}>
                Capacity
              </p>
              <p className="text-xs" style={{ color: ui.textSubtle }}>
                {freeUnlimited ? 'Unlimited seats' : `${tiers[0]?.quantity || 0} seats`}
                {showSold && (tiers[0]?.sold || 0) > 0 ? ` · ${tiers[0]?.sold} claimed` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onFreeUnlimitedChange(true);
                  onChangeTier(0, { quantity: Math.max(500, tiers[0]?.sold || 0, tiers[0]?.quantity || 500) });
                }}
                className="turnout-btn-accent rounded-lg px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: freeUnlimited ? ui.accent : ui.accentSoft,
                  color: freeUnlimited ? ui.accentOn : ui.textMuted,
                }}
              >
                Unlimited
              </button>
              <button
                type="button"
                onClick={() => {
                  onFreeUnlimitedChange(false);
                  const sold = tiers[0]?.sold || 0;
                  onChangeTier(0, { quantity: Math.max(100, sold || 100) });
                }}
                className="rounded-lg px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: !freeUnlimited ? ui.accent : ui.accentSoft,
                  color: !freeUnlimited ? ui.accentOn : ui.textMuted,
                }}
              >
                Limited
              </button>
            </div>
          </div>
          {!freeUnlimited && (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                Seat quantity
              </label>
              <input
                type="number"
                min={Math.max(1, tiers[0]?.sold || 1)}
                value={tiers[0]?.quantity ?? 100}
                onChange={(e) => onChangeTier(0, { quantity: Number(e.target.value) })}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div key={tier.key} className={cn(panelCn, 'p-4 shadow-sm')} style={cardStyle}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" style={{ color: ui.textSubtle }} />
                  <span className="text-sm font-semibold" style={{ color: ui.text }}>
                    Tier {index + 1}
                  </span>
                  {showSold ? (
                    <span className="text-xs font-medium" style={{ color: ui.textSubtle }}>
                      {tier.sold || 0}/{tier.quantity} sold
                    </span>
                  ) : null}
                </div>
                {tiers.length > 1 && (tier.sold || 0) === 0 ? (
                  <button
                    type="button"
                    onClick={() => onRemoveTier(index)}
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                    Name
                  </label>
                  <input
                    value={tier.name}
                    onChange={(e) => onChangeTier(index, { name: e.target.value })}
                    placeholder="e.g. VIP, Early Bird"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                    Price (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tier.price}
                    onChange={(e) => onChangeTier(index, { price: Number(e.target.value) })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                    Seats
                  </label>
                  <input
                    type="number"
                    min={Math.max(1, tier.sold || 1)}
                    value={tier.quantity}
                    onChange={(e) => onChangeTier(index, { quantity: Number(e.target.value) })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddTier}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ ...cardMutedStyle, color: ui.text }}
          >
            <Plus className="h-4 w-4" />
            Add ticket tier
          </button>

          <p className="text-xs" style={{ color: ui.textSubtle }}>
            Total capacity across tiers:{' '}
            <span className="font-semibold" style={{ color: ui.text }}>
              {totalSeats.toLocaleString()}
            </span>{' '}
            seats
          </p>
        </div>
      )}

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
