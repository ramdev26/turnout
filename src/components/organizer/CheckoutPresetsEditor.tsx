import React from 'react';
import type { CheckoutFieldPresetsConfig } from '../../types';
import {
  CHECKOUT_PRESET_IDS,
  CHECKOUT_PRESET_LABELS,
  DEFAULT_CHECKOUT_PRESETS,
  type CheckoutPresetId,
} from '../../utils/checkoutFieldPresets';
import type { CreateThemeUI } from '../../themes/eventThemes';

type Props = {
  presets: CheckoutFieldPresetsConfig;
  onChange: (presets: CheckoutFieldPresetsConfig) => void;
  ui: CreateThemeUI;
  fieldClass: string;
  fieldStyle: React.CSSProperties;
  cardMutedStyle: React.CSSProperties;
};

function parseLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function CheckoutPresetsEditor({ presets, onChange, ui, fieldClass, fieldStyle, cardMutedStyle }: Props) {
  const p = { ...DEFAULT_CHECKOUT_PRESETS, ...presets };
  const categoryOptions = p.eventCategoryOptions ?? [];
  const doublesValues = p.doublesCategoryValues ?? [];

  const toggle = (id: CheckoutPresetId, enabled: boolean) => {
    const next = { ...p, [id]: enabled };
    if (id === 'eventCategory' && !enabled) {
      next.partnerName = false;
      next.partnerPhone = false;
    }
    if ((id === 'partnerName' || id === 'partnerPhone') && enabled && !next.eventCategory) {
      next.eventCategory = true;
    }
    onChange(next);
  };

  const setCategoryOptions = (lines: string) => {
    onChange({ ...p, eventCategoryOptions: parseLines(lines) });
  };

  const toggleDoublesValue = (value: string, checked: boolean) => {
    const set = new Set(doublesValues);
    if (checked) set.add(value);
    else set.delete(value);
    onChange({ ...p, doublesCategoryValues: Array.from(set) });
  };

  const enabledCount = CHECKOUT_PRESET_IDS.filter((id) => p[id]).length;

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: ui.textMuted }}>
        Standard fields for sports and tournament events. All are <strong>off by default</strong> — turn on only what
        you need. {enabledCount > 0 ? `${enabledCount} enabled.` : 'None enabled yet.'}
      </p>

      <div className="space-y-2">
        {CHECKOUT_PRESET_IDS.map((id) => {
          const needsCategory =
            (id === 'partnerName' || id === 'partnerPhone') && categoryOptions.length < 1 && p.eventCategory;
          return (
            <label
              key={id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5"
              style={cardMutedStyle}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={!!p[id]}
                onChange={(e) => toggle(id, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: ui.text }}>
                  {CHECKOUT_PRESET_LABELS[id]}
                </span>
                {id === 'duprRating' ? (
                  <span className="mt-0.5 block text-xs" style={{ color: ui.textMuted }}>
                    Optional for attendees — never required at checkout.
                  </span>
                ) : null}
                {needsCategory ? (
                  <span className="mt-0.5 block text-xs" style={{ color: ui.accent }}>
                    Add category options below first.
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {p.eventCategory ? (
        <div className="rounded-xl border p-4" style={cardMutedStyle}>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Event category options
            </span>
            <span className="text-xs" style={{ color: ui.textMuted }}>
              One option per line. Attendees pick from this dropdown at checkout.
            </span>
            <textarea
              value={categoryOptions.join('\n')}
              onChange={(e) => setCategoryOptions(e.target.value)}
              rows={5}
              placeholder={'Men\'s Singles\nWomen\'s Singles\nMen\'s Doubles\nMixed Doubles'}
              className={`${fieldClass} resize-y font-mono text-sm`}
              style={fieldStyle}
            />
          </label>

          {(p.partnerName || p.partnerPhone) && categoryOptions.length > 0 ? (
            <div className="mt-4 border-t pt-4" style={{ borderColor: ui.borderColor }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Doubles categories
              </p>
              <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                Partner name and phone appear only when the attendee selects one of these categories.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categoryOptions.map((opt) => {
                  const isDoubles = doublesValues.includes(opt);
                  return (
                    <label
                      key={opt}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                      style={{
                        borderColor: isDoubles ? ui.accent : ui.borderColor,
                        background: isDoubles ? ui.accentSoft : 'transparent',
                        color: ui.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={isDoubles}
                        onChange={(e) => toggleDoublesValue(opt, e.target.checked)}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
