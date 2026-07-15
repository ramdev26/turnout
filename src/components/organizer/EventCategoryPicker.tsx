import React from 'react';
import { EVENT_CATEGORIES, resolveEventCategory } from '../../themes/eventCategories';
import { cn } from '../../utils/cn';
import type { LandingDesignValue } from './LandingCustomizer';

type EventCategoryPickerProps = {
  value: string | undefined;
  onChange: (next: LandingDesignValue) => void;
  design: LandingDesignValue;
  ui: {
    text: string;
    textMuted: string;
    textSubtle: string;
    borderColor: string;
    accent: string;
    cardBg?: string;
  };
  className?: string;
};

/** Set category label only — never touches colour / font / style. */
export function designWithEventCategory(
  design: LandingDesignValue,
  categoryId: string
): LandingDesignValue {
  return {
    ...design,
    eventCategory: resolveEventCategory(categoryId).id,
  };
}

/**
 * Visible create/settings control for event category (Music, Sports, etc.).
 * Labels only — landing colours stay with the template / design dock.
 */
export const EventCategoryPicker: React.FC<EventCategoryPickerProps> = ({
  value,
  onChange,
  design,
  ui,
  className,
}) => {
  const activeId = value || 'default';

  return (
    <div
      className={cn('rounded-xl border px-3.5 py-3', className)}
      style={{ borderColor: ui.borderColor, background: ui.cardBg }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
        Event category
      </p>
      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: ui.textMuted }}>
        Shown on your event page (breadcrumb, chips). Does not change colours or fonts — use Customize
        design for that.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {EVENT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(designWithEventCategory(design, cat.id))}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:opacity-95"
              style={
                active
                  ? {
                      borderColor: ui.accent,
                      background: `color-mix(in srgb, ${ui.accent} 14%, transparent)`,
                      color: ui.text,
                    }
                  : {
                      borderColor: ui.borderColor,
                      background: 'transparent',
                      color: ui.text,
                    }
              }
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${cat.swatchPrimary}, ${cat.swatchSecondary})`,
                }}
              >
                <Icon className="h-3.5 w-3.5 text-white drop-shadow" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{cat.name}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
