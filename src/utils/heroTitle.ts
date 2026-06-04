import type { Event } from '../types';

export type HeroTitleSplitMode = 'auto' | 'custom';

export type HeroTitleCustomization = {
  heroText?: string;
  heroTitleSplitMode?: HeroTitleSplitMode;
  /** Words on the accent (first) line when mode is auto. Default 2. */
  heroTitleAccentWords?: number;
  heroTitleAccent?: string;
  heroTitleMain?: string;
};

/** Split a title into accent + main lines (colon syntax or word count). */
export function splitHeroTitle(title: string, accentWordCount = 2): { accent: string; main: string } {
  const trimmed = title.trim();
  if (!trimmed) return { accent: '', main: '' };

  const colon = trimmed.indexOf(':');
  if (colon > 0 && colon < trimmed.length - 1) {
    return {
      accent: trimmed.slice(0, colon).trim(),
      main: trimmed.slice(colon + 1).trim(),
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { accent: trimmed, main: '' };
  if (words.length === 2) return { accent: words[0], main: words[1] };

  const count = Math.max(1, Math.min(4, Math.floor(accentWordCount) || 2));
  const accentCount = Math.min(count, words.length - 1);
  return {
    accent: words.slice(0, accentCount).join(' '),
    main: words.slice(accentCount).join(' '),
  };
}

export function resolveHeroTitleLines(
  event: Pick<Event, 'title' | 'customization'>
): { accent: string; main: string; fullTitle: string } {
  const c = event.customization;
  const fullTitle = (c?.heroText || event.title || '').trim();

  const mode: HeroTitleSplitMode =
    c?.heroTitleSplitMode === 'custom' || c?.heroTitleSplitMode === 'auto'
      ? c.heroTitleSplitMode
      : c?.heroTitleAccent?.trim() || c?.heroTitleMain?.trim()
        ? 'custom'
        : 'auto';

  if (mode === 'custom') {
    const accent = (c?.heroTitleAccent || '').trim();
    const main = (c?.heroTitleMain || '').trim();
    if (accent || main) {
      if (accent && !main) {
        const rest = fullTitle.replace(new RegExp(`^${escapeRegExp(accent)}\\s*`, 'i'), '').trim();
        return { accent, main: rest || fullTitle, fullTitle };
      }
      return {
        accent,
        main: main || fullTitle,
        fullTitle,
      };
    }
  }

  const accentWords = c?.heroTitleAccentWords ?? 2;
  const { accent, main } = splitHeroTitle(fullTitle, accentWords);
  return { accent, main, fullTitle };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
