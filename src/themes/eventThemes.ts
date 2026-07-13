import type { CSSProperties } from 'react';
import type { Event, LandingDisplayMode, LandingStyle } from '../types';
import type { TemplateId } from '../templates/templates';
import { isEventCategoryId, resolveEventCategory } from './eventCategories';
import { resolveLandingFont, resolveLandingFontKey } from './landingFonts';
import { TURNOUT_APP_PAGE_BG, TURNOUT_BRAND } from './brandColors';

export type EventThemeId = 'minimal' | 'neo-green' | 'midnight' | 'sunset';

export type CreateThemeUI = {
  pageBg: string;
  headerBg: string;
  footerBg: string;
  borderColor: string;
  cardBg: string;
  cardMutedBg: string;
  fieldBg: string;
  pillBg: string;
  accent: string;
  accentHover: string;
  accentOn: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  dotActive: string;
  dotInactive: string;
  lineDashed: string;
  bannerFrame: string;
  bannerPlaceholder: string;
  isDark: boolean;
};

export type LandingThemeUI = {
  pageBg: string;
  surfaceBg: string;
  surfaceMutedBg: string;
  text: string;
  textMuted: string;
  borderColor: string;
  cardShadow: string;
};

export type EventThemeDefinition = {
  id: EventThemeId;
  name: string;
  primary: string;
  secondary: string;
  templateId: TemplateId;
  ui: CreateThemeUI;
  landing: LandingThemeUI;
};

export const EVENT_THEMES: Record<EventThemeId, EventThemeDefinition> = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    primary: TURNOUT_BRAND.teal700,
    secondary: TURNOUT_BRAND.lime500,
    templateId: 'template-2',
    ui: {
      pageBg: TURNOUT_APP_PAGE_BG,
      headerBg: 'rgba(5, 46, 48, 0.88)',
      footerBg: 'rgba(5, 46, 48, 0.94)',
      borderColor: TURNOUT_BRAND.limeLine,
      cardBg: 'rgba(255, 255, 255, 0.06)',
      cardMutedBg: 'rgba(255, 255, 255, 0.04)',
      fieldBg: 'rgba(255, 255, 255, 0.08)',
      pillBg: 'rgba(255, 255, 255, 0.07)',
      accent: TURNOUT_BRAND.lime500,
      accentHover: TURNOUT_BRAND.lime400,
      accentOn: TURNOUT_BRAND.ink,
      accentSoft: TURNOUT_BRAND.limeSoft,
      text: TURNOUT_BRAND.text,
      textMuted: TURNOUT_BRAND.textMuted,
      textSubtle: TURNOUT_BRAND.textSubtle,
      dotActive: TURNOUT_BRAND.lime500,
      dotInactive: 'rgba(147, 181, 183, 0.35)',
      lineDashed: 'rgba(147, 181, 183, 0.45)',
      bannerFrame: 'border-teal-400/30 bg-teal-950/40 hover:border-lime-400/40',
      bannerPlaceholder: 'text-teal-100',
      isDark: true,
    },
    landing: {
      pageBg: TURNOUT_APP_PAGE_BG,
      surfaceBg: 'rgba(255, 255, 255, 0.06)',
      surfaceMutedBg: 'rgba(255, 255, 255, 0.04)',
      text: TURNOUT_BRAND.text,
      textMuted: TURNOUT_BRAND.textMuted,
      borderColor: TURNOUT_BRAND.limeLine,
      cardShadow: '0 18px 44px rgba(5, 46, 48, 0.55)',
    },
  },
  'neo-green': {
    id: 'neo-green',
    name: 'Neo Green',
    primary: '#34d399',
    secondary: '#10b981',
    templateId: 'template-2',
    ui: {
      pageBg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 42%, #f0fdf4 100%)',
      headerBg: 'rgba(255,255,255,0.82)',
      footerBg: 'rgba(236,253,245,0.95)',
      borderColor: '#a7f3d0',
      cardBg: 'rgba(255,255,255,0.88)',
      cardMutedBg: 'rgba(236,253,245,0.75)',
      fieldBg: 'rgba(255,255,255,0.92)',
      pillBg: 'rgba(255,255,255,0.9)',
      accent: '#059669',
      accentHover: '#047857',
      accentOn: '#ffffff',
      accentSoft: 'rgba(5,150,105,0.15)',
      text: '#064e3b',
      textMuted: '#047857',
      textSubtle: '#0d9488',
      dotActive: '#059669',
      dotInactive: '#86efac',
      lineDashed: '#6ee7b7',
      bannerFrame: 'border-emerald-200 bg-emerald-50/90 hover:border-emerald-300',
      bannerPlaceholder: 'text-emerald-800',
      isDark: false,
    },
    landing: {
      pageBg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 42%, #f0fdf4 100%)',
      surfaceBg: 'rgba(255,255,255,0.92)',
      surfaceMutedBg: 'rgba(236,253,245,0.85)',
      text: '#064e3b',
      textMuted: '#047857',
      borderColor: '#a7f3d0',
      cardShadow: '0 14px 40px rgba(5, 150, 105, 0.12)',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    primary: '#818cf8',
    secondary: '#a78bfa',
    templateId: 'template-4',
    ui: {
      pageBg: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 48%, #4c1d95 100%)',
      headerBg: 'rgba(15,23,42,0.75)',
      footerBg: 'rgba(15,23,42,0.88)',
      borderColor: 'rgba(129,140,248,0.35)',
      cardBg: 'rgba(255,255,255,0.07)',
      cardMutedBg: 'rgba(255,255,255,0.05)',
      fieldBg: 'rgba(255,255,255,0.08)',
      pillBg: 'rgba(255,255,255,0.08)',
      accent: '#818cf8',
      accentHover: '#6366f1',
      accentOn: '#ffffff',
      accentSoft: 'rgba(129,140,248,0.22)',
      text: '#f8fafc',
      textMuted: '#c7d2fe',
      textSubtle: '#a5b4fc',
      dotActive: '#a5b4fc',
      dotInactive: 'rgba(255,255,255,0.35)',
      lineDashed: 'rgba(165,180,252,0.45)',
      bannerFrame: 'border-indigo-400/40 bg-indigo-950/40 hover:border-indigo-300/60',
      bannerPlaceholder: 'text-indigo-100',
      isDark: true,
    },
    landing: {
      pageBg: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 48%, #4c1d95 100%)',
      surfaceBg: 'rgba(15,23,42,0.65)',
      surfaceMutedBg: 'rgba(255,255,255,0.06)',
      text: '#f8fafc',
      textMuted: '#c7d2fe',
      borderColor: 'rgba(129,140,248,0.35)',
      cardShadow: '0 14px 40px rgba(15, 23, 42, 0.45)',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    primary: '#f97316',
    secondary: '#ec4899',
    templateId: 'template-1',
    ui: {
      pageBg: 'linear-gradient(165deg, #fff7ed 0%, #ffedd5 38%, #fce7f3 78%, #fdf2f8 100%)',
      headerBg: 'rgba(255,255,255,0.85)',
      footerBg: 'rgba(255,247,237,0.95)',
      borderColor: '#fdba74',
      cardBg: 'rgba(255,255,255,0.9)',
      cardMutedBg: 'rgba(255,237,213,0.65)',
      fieldBg: 'rgba(255,255,255,0.92)',
      pillBg: 'rgba(255,255,255,0.9)',
      accent: '#ea580c',
      accentHover: '#c2410c',
      accentOn: '#ffffff',
      accentSoft: 'rgba(234,88,12,0.14)',
      text: '#7c2d12',
      textMuted: '#c2410c',
      textSubtle: '#db2777',
      dotActive: '#ea580c',
      dotInactive: '#fdba74',
      lineDashed: '#fb923c',
      bannerFrame: 'border-orange-200 bg-orange-50/80 hover:border-orange-300',
      bannerPlaceholder: 'text-orange-900',
      isDark: false,
    },
    landing: {
      pageBg: 'linear-gradient(165deg, #fff7ed 0%, #ffedd5 38%, #fce7f3 78%, #fdf2f8 100%)',
      surfaceBg: 'rgba(255,255,255,0.94)',
      surfaceMutedBg: 'rgba(255,237,213,0.55)',
      text: '#7c2d12',
      textMuted: '#9a3412',
      borderColor: '#fdba74',
      cardShadow: '0 14px 40px rgba(234, 88, 12, 0.12)',
    },
  },
};

export const EVENT_THEME_IDS = Object.keys(EVENT_THEMES) as EventThemeId[];

export function isEventThemeId(value: string | undefined | null): value is EventThemeId {
  return !!value && value in EVENT_THEMES;
}

/** Loosely-typed customization input; landing helpers only read a subset. */
export type LandingCustomizationInput = Partial<Event['customization']> | undefined;

function storedHexColor(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^#[0-9a-f]{6}$/.test(normalized) ? normalized : undefined;
}

const LIGHT_LANDING_TEXT = '#0f172a';
const LIGHT_LANDING_TEXT_MUTED = '#475569';

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase();
  const match = /^#?([0-9a-f]{6})$/.exec(normalized);
  if (!match) return null;
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

/** WCAG relative luminance (sRGB). */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** True for white and other very light brand colours from the custom picker. */
export function isLightHex(hex: string): boolean {
  const lum = relativeLuminance(hex);
  return lum !== null && lum >= 0.62;
}

function pickReadableAccent(primary: string, secondary?: string): string {
  if (!isLightHex(primary)) return primary;
  if (secondary && !isLightHex(secondary)) return secondary;
  return TURNOUT_BRAND.teal700;
}

/** Dark text on light pages; fixes white brand colour + auto/dark display. */
function ensureReadableLandingSurfaces(
  surfaces: LandingSurfaces,
  primary: string,
  secondary?: string
): LandingSurfaces {
  const brandIsLight = isLightHex(primary) || (secondary ? isLightHex(secondary) : false);
  if (!brandIsLight) return surfaces;

  const light = generatedLightSurfaces(primary, secondary);
  return {
    ...light,
    text: LIGHT_LANDING_TEXT,
    textMuted: LIGHT_LANDING_TEXT_MUTED,
    glassBg: light.glassBg,
    glassBorder: light.glassBorder,
    cardShadow: light.cardShadow,
  };
}

/** Events created before event categories — keep their saved palette when present. */
export function isLegacyLandingCustomization(customization: LandingCustomizationInput): boolean {
  return !isEventCategoryId(customization?.eventCategory);
}

/** Theme resolution used for older events (themeId + historic accent colours). */
export function resolveLegacyEventTheme(customization: LandingCustomizationInput): EventThemeDefinition {
  const themeId = customization?.themeId;
  if (isEventThemeId(themeId)) {
    return EVENT_THEMES[themeId];
  }

  const primary = customization?.primaryColor?.toLowerCase();
  if (primary === '#34d399' || primary === '#10b981' || primary === '#059669') {
    return EVENT_THEMES['neo-green'];
  }
  if (primary === '#818cf8' || primary === '#4f46e5' || primary === '#7c3aed') {
    return EVENT_THEMES.midnight;
  }
  if (primary === '#f97316' || primary === '#ec4899' || primary === '#ea580c') {
    return EVENT_THEMES.sunset;
  }

  return EVENT_THEMES.minimal;
}

/**
 * Maps stored customization to what the public landing should render.
 * Legacy events only receive category defaults for fields that were never saved.
 */
export function normalizeLandingCustomization(
  customization: LandingCustomizationInput
): NonNullable<LandingCustomizationInput> {
  const category = resolveEventCategory(
    isEventCategoryId(customization?.eventCategory) ? customization.eventCategory : 'default'
  );
  const legacy = isLegacyLandingCustomization(customization);

  if (legacy) {
    const landingStyle = customization?.landingStyle;
    return {
      ...(customization ?? {}),
      themeId: isEventThemeId(customization?.themeId) ? customization.themeId : 'minimal',
      eventCategory: 'default',
      primaryColor: storedHexColor(customization?.primaryColor) ?? category.primaryColor,
      secondaryColor: storedHexColor(customization?.secondaryColor) ?? category.secondaryColor,
      fontFamily: customization?.fontFamily?.trim()
        ? resolveLandingFontKey(customization.fontFamily)
        : category.fontFamily,
      landingStyle:
        landingStyle === 'minimal' || landingStyle === 'bold' || landingStyle === 'glass'
          ? landingStyle
          : category.landingStyle,
    };
  }

  return {
    ...(customization ?? {}),
    themeId: 'minimal',
    eventCategory: category.id,
    primaryColor: customization?.primaryColor ?? category.primaryColor,
    secondaryColor: customization?.secondaryColor ?? category.secondaryColor,
    fontFamily: customization?.fontFamily ?? category.fontFamily,
    landingStyle:
      customization?.landingStyle === 'minimal' ||
      customization?.landingStyle === 'bold' ||
      customization?.landingStyle === 'glass'
        ? customization.landingStyle
        : category.landingStyle,
  };
}

/** Public landings always use the Minimal theme definition. */
export function resolveEventTheme(_customization?: LandingCustomizationInput): EventThemeDefinition {
  return EVENT_THEMES.minimal;
}

/** Respect stored layout template; canvas layouts are preserved. */
export function resolveTemplateId(event: Pick<Event, 'templateId' | 'customization'>): TemplateId {
  if (event.templateId === 'template-canvas') return 'template-canvas';
  const id = event.templateId;
  if (
    id === 'template-1' ||
    id === 'template-2' ||
    id === 'template-3' ||
    id === 'template-4' ||
    id === 'template-5'
  ) {
    return id;
  }
  return 'template-2';
}

type LandingSurfaces = {
  isDark: boolean;
  pageBg: string;
  surfaceBg: string;
  surfaceMutedBg: string;
  text: string;
  textMuted: string;
  borderColor: string;
  cardShadow: string;
  glassBg: string;
  glassBorder: string;
};

/** Resolve the requested display mode against the theme's native lightness. */
export function resolveDisplayMode(
  customization: LandingCustomizationInput,
  theme = resolveEventTheme(customization)
): { mode: LandingDisplayMode; isDark: boolean } {
  const c = normalizeLandingCustomization(customization);
  const mode: LandingDisplayMode =
    c.displayMode === 'light' || c.displayMode === 'dark' ? c.displayMode : 'auto';
  const toneTheme = isLegacyLandingCustomization(customization)
    ? resolveLegacyEventTheme(customization)
    : theme;
  const isDark = mode === 'auto' ? toneTheme.ui.isDark : mode === 'dark';
  return { mode, isDark };
}

export function resolveLandingStyle(customization: LandingCustomizationInput): LandingStyle {
  const style = normalizeLandingCustomization(customization).landingStyle;
  return style === 'minimal' || style === 'bold' ? style : 'glass';
}

/** Neutral dark surface set used when an organizer forces dark on a light theme. */
function generatedDarkSurfaces(primary: string, secondary?: string): LandingSurfaces {
  const accent = secondary || primary;
  return {
    isDark: true,
    pageBg: `radial-gradient(ellipse 70% 50% at 50% -10%, color-mix(in srgb, ${primary} 24%, transparent) 0%, transparent 60%), linear-gradient(165deg, color-mix(in srgb, ${accent} 18%, ${TURNOUT_BRAND.teal900}) 0%, color-mix(in srgb, ${primary} 16%, ${TURNOUT_BRAND.teal700}) 52%, ${TURNOUT_BRAND.teal800} 100%)`,
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceMutedBg: 'rgba(255, 255, 255, 0.04)',
    text: TURNOUT_BRAND.text,
    textMuted: TURNOUT_BRAND.textMuted,
    borderColor: TURNOUT_BRAND.limeLine,
    cardShadow: '0 18px 44px rgba(5, 46, 48, 0.55)',
    glassBg: 'rgba(5, 46, 48, 0.72)',
    glassBorder: TURNOUT_BRAND.limeLine,
  };
}

/** Neutral light surface set used when an organizer forces light on a dark theme. */
function generatedLightSurfaces(primary: string, secondary?: string): LandingSurfaces {
  const accent = secondary || primary;
  return {
    isDark: false,
    pageBg: `radial-gradient(ellipse 90% 60% at 50% -8%, color-mix(in srgb, ${primary} 12%, transparent) 0%, transparent 55%), linear-gradient(180deg, #fafaf9 0%, color-mix(in srgb, ${accent} 6%, #f1f5f9) 48%, #eef2f7 100%)`,
    surfaceBg: '#ffffff',
    surfaceMutedBg: '#f4f6fa',
    text: '#0c1222',
    textMuted: '#5b6478',
    borderColor: '#d8e0ec',
    cardShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.07)',
    glassBg: 'rgba(255, 255, 255, 0.86)',
    glassBorder: 'rgba(15, 23, 42, 0.08)',
  };
}

/** Whether the public landing renders in light or dark tone. */
export function landingToneIsDark(customization: LandingCustomizationInput): boolean {
  return resolveDisplayMode(normalizeLandingCustomization(customization)).isDark;
}

function resolveLandingSurfaces(
  customization: LandingCustomizationInput,
  theme = resolveEventTheme(customization)
): LandingSurfaces {
  const c = normalizeLandingCustomization(customization);
  const { isDark } = resolveDisplayMode(c, theme);
  const primary = c.primaryColor || theme.primary;
  const secondary = c.secondaryColor || theme.secondary;

  if (isLegacyLandingCustomization(customization)) {
    const legacyTheme = resolveLegacyEventTheme(customization);
    const themeIsDark = legacyTheme.ui.isDark;
    if (isDark === themeIsDark) {
      const landing = legacyTheme.landing;
      return {
        isDark,
        pageBg: landing.pageBg,
        surfaceBg: landing.surfaceBg,
        surfaceMutedBg: landing.surfaceMutedBg,
        text: landing.text,
        textMuted: landing.textMuted,
        borderColor: landing.borderColor,
        cardShadow: landing.cardShadow,
        glassBg: themeIsDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.72)',
        glassBorder: themeIsDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.65)',
      };
    }
    return isDark ? generatedDarkSurfaces(primary, secondary) : generatedLightSurfaces(primary, secondary);
  }

  const themeIsDark = theme.ui.isDark;
  const tinted = isDark ? generatedDarkSurfaces(primary, secondary) : generatedLightSurfaces(primary, secondary);

  // New events: tint page background from organizer primary/secondary so public
  // landings match the Customize design colours.
  if (isDark === themeIsDark) {
    const landing = theme.landing;
    return {
      ...tinted,
      text: landing.text,
      textMuted: landing.textMuted,
      borderColor: landing.borderColor,
      cardShadow: landing.cardShadow,
      glassBg: themeIsDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.72)',
      glassBorder: themeIsDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.65)',
    };
  }

  return tinted;
}

/** Per-style overrides applied on top of the resolved surface set. */
function applyStyleOverrides(style: LandingStyle, surfaces: LandingSurfaces, primary: string): LandingSurfaces {
  if (style === 'minimal') {
    return {
      ...surfaces,
      surfaceBg: surfaces.isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      glassBg: surfaces.isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.92)',
      glassBorder: surfaces.isDark ? surfaces.glassBorder : 'rgba(15, 23, 42, 0.1)',
      cardShadow: surfaces.isDark
        ? '0 1px 0 rgba(255,255,255,0.05)'
        : '0 1px 2px rgba(15, 23, 42, 0.05), 0 16px 40px rgba(15, 23, 42, 0.08)',
    };
  }
  if (style === 'bold') {
    return {
      ...surfaces,
      surfaceBg: surfaces.isDark
        ? `color-mix(in srgb, ${primary} 12%, rgba(255,255,255,0.05))`
        : `color-mix(in srgb, ${primary} 6%, #ffffff)`,
      borderColor: `color-mix(in srgb, ${primary} 38%, ${surfaces.borderColor})`,
      cardShadow: surfaces.isDark
        ? `0 22px 50px rgba(0,0,0,0.55), 0 0 0 1px color-mix(in srgb, ${primary} 30%, transparent)`
        : `0 22px 50px color-mix(in srgb, ${primary} 22%, rgba(15,23,42,0.12))`,
    };
  }
  return surfaces;
}

export function landingCssVars(customization: LandingCustomizationInput): CSSProperties {
  const c = normalizeLandingCustomization(customization);
  const theme = resolveEventTheme(c);
  const primary = c.primaryColor || theme.primary;
  const secondary = c.secondaryColor || theme.secondary;
  const style = resolveLandingStyle(c);
  const surfaces = ensureReadableLandingSurfaces(
    applyStyleOverrides(style, resolveLandingSurfaces(c, theme), primary),
    primary,
    secondary
  );
  const isDark = surfaces.isDark;
  const font = resolveLandingFont(c.fontFamily);
  const radius = style === 'bold' ? '1.75rem' : style === 'minimal' ? '1rem' : '1.5rem';
  const accentReadable = pickReadableAccent(primary, secondary);
  const onPrimary = isLightHex(primary) ? TURNOUT_BRAND.ink : '#ffffff';

  return {
    ['--primary' as string]: primary,
    ['--secondary' as string]: secondary,
    ['--landing-accent-readable' as string]: accentReadable,
    ['--landing-on-primary' as string]: onPrimary,
    ['--landing-page-bg' as string]: surfaces.pageBg,
    ['--landing-surface' as string]: surfaces.surfaceBg,
    ['--landing-surface-muted' as string]: surfaces.surfaceMutedBg,
    ['--landing-text' as string]: surfaces.text,
    ['--landing-text-muted' as string]: surfaces.textMuted,
    ['--landing-border' as string]: surfaces.borderColor,
    ['--landing-shadow' as string]: surfaces.cardShadow,
    ['--landing-shadow-hover' as string]: isDark
      ? '0 24px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.06)'
      : '0 24px 48px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    ['--landing-glow' as string]: `color-mix(in srgb, ${primary} 35%, transparent)`,
    ['--landing-glass-bg' as string]: surfaces.glassBg,
    ['--landing-glass-border' as string]: surfaces.glassBorder,
    ['--landing-radius' as string]: radius,
    ['--landing-font-display' as string]: font.display,
    ['--landing-font-body' as string]: font.body,
    ['--landing-accent' as string]: primary,
  };
}
