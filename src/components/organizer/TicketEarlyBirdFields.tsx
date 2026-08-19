import React from 'react';
import { cn } from '../utils/cn';
import type { CreateThemeUI } from '../themes/flowUi';
import { cardMutedStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';

export type TicketEarlyBirdFieldValues = {
  earlyBirdEnabled: boolean;
  earlyBirdPrice: number;
  earlyBirdEndAt: string;
  earlyBirdLimit: number;
};

type Props = {
  values: TicketEarlyBirdFieldValues;
  onChange: (patch: Partial<TicketEarlyBirdFieldValues>) => void;
  standardPrice: number;
  totalQuantity: number;
  ui: CreateThemeUI;
  className?: string;
  idPrefix?: string;
};

export function TicketEarlyBirdFields({
  values,
  onChange,
  standardPrice,
  totalQuantity,
  ui,
  className,
  idPrefix = 'eb',
}: Props) {
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const toggleId = `${idPrefix}-enabled`;

  return (
    <div className={cn('mt-3 rounded-xl border p-3', className)} style={cardMutedStyle}>
      <label htmlFor={toggleId} className="flex cursor-pointer items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: ui.text }}>
            Early bird pricing
          </p>
          <p className="mt-0.5 text-xs" style={{ color: ui.textSubtle }}>
            Offer a lower rate until a date or until a set number sell.
          </p>
        </div>
        <input
          id={toggleId}
          type="checkbox"
          checked={values.earlyBirdEnabled}
          onChange={(e) => onChange({ earlyBirdEnabled: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-neutral-300"
        />
      </label>

      {values.earlyBirdEnabled ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
              Early bird rate (LKR)
            </label>
            <input
              type="number"
              min={0}
              max={standardPrice > 0 ? standardPrice - 0.01 : undefined}
              step="0.01"
              value={Number.isFinite(values.earlyBirdPrice) ? values.earlyBirdPrice : ''}
              onChange={(e) => onChange({ earlyBirdPrice: Number(e.target.value) })}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
              Ends
            </label>
            <input
              type="datetime-local"
              value={values.earlyBirdEndAt}
              onChange={(e) => onChange({ earlyBirdEndAt: e.target.value })}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
              Early bird limit
            </label>
            <input
              type="number"
              min={1}
              max={totalQuantity > 0 ? totalQuantity : undefined}
              value={Number.isFinite(values.earlyBirdLimit) ? values.earlyBirdLimit : ''}
              onChange={(e) => onChange({ earlyBirdLimit: Number(e.target.value) })}
              className={fieldClass}
              style={fieldStyle}
            />
            {totalQuantity > 0 ? (
              <p className="mt-1 text-[11px]" style={{ color: ui.textSubtle }}>
                Max {totalQuantity} (tier capacity)
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
