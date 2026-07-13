import type { CSSProperties } from 'react';
import { cn } from '../utils/cn';
import type { CreateThemeUI } from './eventThemes';

export function fieldClassFor(ui: CreateThemeUI): string {
  return cn(
    'w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2',
    ui.isDark
      ? 'text-white placeholder:text-white/40 focus:ring-white/15'
      : 'text-neutral-900 placeholder:text-neutral-400 focus:ring-black/5'
  );
}

export function fieldStyleFor(ui: CreateThemeUI): CSSProperties {
  return {
    backgroundColor: ui.fieldBg,
    borderColor: ui.borderColor,
    color: ui.text,
  };
}

export function cardStyleFor(ui: CreateThemeUI): CSSProperties {
  return {
    backgroundColor: ui.cardBg,
    borderColor: ui.borderColor,
  };
}

export function cardMutedStyleFor(ui: CreateThemeUI): CSSProperties {
  return {
    backgroundColor: ui.cardMutedBg,
    borderColor: ui.borderColor,
  };
}

/** Filled accent button — dark ink on lime, light text on darker accent colors. */
export function accentButtonStyleFor(ui: CreateThemeUI): CSSProperties {
  return {
    backgroundColor: ui.accent,
    color: ui.accentOn,
  };
}

export function accentSegmentStyleFor(ui: CreateThemeUI, active: boolean): CSSProperties {
  if (!active) return { color: ui.textMuted };
  return accentButtonStyleFor(ui);
}
