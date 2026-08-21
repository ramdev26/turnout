import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CreateThemeUI } from '../../themes/flowUi';
import { cardMutedStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';

export type TicketBulkOfferValue = { qty: number; price: number };

type Props = {
  offers: TicketBulkOfferValue[];
  onChange: (next: TicketBulkOfferValue[]) => void;
  ui: CreateThemeUI;
  standardPrice: number;
};

export function TicketBulkOffersFields({ offers, onChange, ui, standardPrice }: Props) {
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const update = (index: number, patch: Partial<TicketBulkOfferValue>) => {
    onChange(offers.map((offer, i) => (i === index ? { ...offer, ...patch } : offer)));
  };

  return (
    <div className="mt-3 rounded-xl border p-3" style={cardMutedStyle}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: ui.text }}>
            Bulk offers
          </p>
          <p className="text-xs" style={{ color: ui.textSubtle }}>
            Bundle pricing per tier (example: 5 tickets for 5500)
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...offers, { qty: 5, price: Math.max(0, standardPrice * 5 - 500) }])}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
          style={{ ...fieldStyle, color: ui.text }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add bundle
        </button>
      </div>

      {offers.length === 0 ? (
        <p className="text-xs" style={{ color: ui.textSubtle }}>
          No bulk offers yet.
        </p>
      ) : (
        <div className="space-y-2">
          {offers.map((offer, index) => (
            <div key={`bulk-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="number"
                min={2}
                value={Number.isFinite(offer.qty) ? offer.qty : ''}
                onChange={(e) => update(index, { qty: Number(e.target.value) })}
                placeholder="Qty (e.g. 5)"
                className={fieldClass}
                style={fieldStyle}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={Number.isFinite(offer.price) ? offer.price : ''}
                onChange={(e) => update(index, { price: Number(e.target.value) })}
                placeholder="Bundle price"
                className={fieldClass}
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={() => onChange(offers.filter((_, i) => i !== index))}
                className="rounded-lg border px-2.5 py-2 text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
