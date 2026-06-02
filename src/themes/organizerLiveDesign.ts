import { useEffect, useMemo } from 'react';
import type { LandingDesignValue } from '../components/organizer/LandingCustomizer';
import type { LandingStyle } from '../types';
import { loadLandingFont, resolveLandingFont } from './landingFonts';
import { EVENT_THEMES, landingCssVars, type CreateThemeUI, type EventThemeId } from './eventThemes';

export function uiIsDark(displayMode: LandingDesignValue['displayMode'], fallbackIsDark: boolean): boolean {
  if (displayMode === 'dark') return true;
  if (displayMode === 'light') return false;
  return fallbackIsDark;
}

/** Lighter companion for custom primary picks (hex #RRGGBB). */
export function companionSecondaryColor(primaryHex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(primaryHex.trim());
  if (!match) return primaryHex;
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * 0.35));
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, '0')}`;
}

export function landingCustomizationFromDesign(
  design: LandingDesignValue,
  themeId: EventThemeId = 'minimal'
) {
  return {
    themeId,
    eventCategory: design.eventCategory,
    primaryColor: design.primaryColor,
    secondaryColor: design.secondaryColor,
    fontFamily: design.fontFamily,
    displayMode: design.displayMode,
    landingStyle: design.landingStyle,
  };
}

function buildLiveUi(design: LandingDesignValue, baseUi: CreateThemeUI): CreateThemeUI {
  const isDark = uiIsDark(design.displayMode, baseUi.isDark);
  const dynamicPageBg = isDark
    ? 'radial-gradient(ellipse 70% 52% at 50% -14%, color-mix(in srgb, var(--primary) 26%, transparent) 0%, transparent 62%), linear-gradient(165deg, color-mix(in srgb, var(--secondary) 22%, #052e30) 0%, color-mix(in srgb, var(--primary) 20%, #0d585b) 52%, #052e30 100%)'
    : 'radial-gradient(ellipse 70% 52% at 50% -12%, color-mix(in srgb, var(--primary) 18%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--secondary) 10%, #ffffff) 0%, color-mix(in srgb, var(--primary) 8%, #f5f7fb) 100%)';

  const style = design.landingStyle;
  const cardBorder =
    style === 'bold'
      ? 'color-mix(in srgb, var(--primary) 42%, var(--landing-border))'
      : 'var(--landing-border)';

  return {
    ...baseUi,
    pageBg: dynamicPageBg,
    headerBg: 'color-mix(in srgb, var(--landing-page-bg) 62%, var(--landing-surface) 38%)',
    footerBg: 'color-mix(in srgb, var(--landing-page-bg) 68%, var(--landing-surface) 32%)',
    borderColor: cardBorder,
    cardBg:
      style === 'glass'
        ? 'color-mix(in srgb, var(--landing-surface) 82%, transparent)'
        : 'var(--landing-surface)',
    cardMutedBg: 'var(--landing-surface-muted)',
    fieldBg: 'color-mix(in srgb, var(--landing-surface) 76%, transparent)',
    pillBg: 'color-mix(in srgb, var(--landing-surface) 78%, transparent)',
    accent: 'var(--primary)',
    accentHover: 'color-mix(in srgb, var(--primary) 84%, black)',
    accentSoft: 'color-mix(in srgb, var(--primary) 18%, transparent)',
    text: 'var(--landing-text)',
    textMuted: 'var(--landing-text-muted)',
    textSubtle: 'color-mix(in srgb, var(--landing-text-muted) 70%, var(--landing-text) 30%)',
    dotActive: 'var(--primary)',
    dotInactive: 'color-mix(in srgb, var(--landing-text-muted) 45%, transparent)',
    lineDashed: 'color-mix(in srgb, var(--landing-border) 72%, transparent)',
    bannerFrame: baseUi.bannerFrame,
    bannerPlaceholder: baseUi.bannerPlaceholder,
    isDark,
  };
}

export function organizerCardStyle(ui: CreateThemeUI, landingStyle: LandingStyle) {
  return {
    backgroundColor: ui.cardBg,
    borderColor: ui.borderColor,
    ...(landingStyle === 'glass' ? { backdropFilter: 'blur(12px)' as const } : {}),
    ...(landingStyle === 'bold' ? { boxShadow: 'var(--landing-shadow)' as const } : {}),
  };
}

export function useOrganizerLiveDesign(design: LandingDesignValue, themeId: EventThemeId = 'minimal') {
  const baseUi = EVENT_THEMES[themeId]?.ui || EVENT_THEMES.minimal.ui;

  useEffect(() => {
    loadLandingFont(design.fontFamily);
  }, [design.fontFamily]);

  const landingVars = useMemo(
    () => landingCssVars(landingCustomizationFromDesign(design, themeId)),
    [design, themeId]
  );

  const ui = useMemo(() => buildLiveUi(design, baseUi), [design, baseUi]);
  const fonts = useMemo(() => resolveLandingFont(design.fontFamily), [design.fontFamily]);
  const cardStyle = useMemo(() => organizerCardStyle(ui, design.landingStyle), [ui, design.landingStyle]);
  const cardMutedStyle = useMemo(
    () => ({ backgroundColor: ui.cardMutedBg, borderColor: ui.borderColor }),
    [ui]
  );

  return {
    ui,
    landingVars,
    titleFont: fonts.display,
    bodyFont: fonts.body,
    cardStyle,
    cardMutedStyle,
  };
}
