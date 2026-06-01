import type { CSSProperties } from 'react';
import type { Event, LandingDisplayMode, LandingStyle } from '../types';
import type { TemplateId } from '../templates/templates';
import { resolveLandingFont } from './landingFonts';

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
    primary: '#0f766e',
    secondary: '#64748b',
    templateId: 'template-2',
    ui: {
      pageBg: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
      headerBg: 'rgba(255,255,255,0.92)',
      footerBg: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      cardBg: 'rgba(255,255,255,0.95)',
      cardMutedBg: 'rgba(248,250,252,0.9)',
      fieldBg: 'rgba(255,255,255,0.95)',
      pillBg: 'rgba(255,255,255,0.95)',
      accent: '#0f766e',
      accentHover: '#115e59',
      accentSoft: 'rgba(15,118,110,0.12)',
      text: '#0f172a',
      textMuted: '#475569',
      textSubtle: '#64748b',
      dotActive: '#0f172a',
      dotInactive: '#cbd5e1',
      lineDashed: '#cbd5e1',
      bannerFrame: 'border-slate-200 bg-slate-50 hover:border-slate-300',
      bannerPlaceholder: 'text-slate-600',
      isDark: false,
    },
    landing: {
      pageBg: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
      surfaceBg: '#ffffff',
      surfaceMutedBg: '#f8fafc',
      text: '#0f172a',
      textMuted: '#475569',
      borderColor: '#e2e8f0',
      cardShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
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

export function resolveEventTheme(customization: LandingCustomizationInput): EventThemeDefinition {
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

export function resolveTemplateId(event: Pick<Event, 'templateId' | 'customization'>): TemplateId {
  const id = event.templateId;
  if (id === 'template-1' || id === 'template-2' || id === 'template-3' || id === 'template-4' || id === 'template-canvas') {
    return id;
  }
  return resolveEventTheme(event.customization).templateId;
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
  const mode: LandingDisplayMode =
    customization?.displayMode === 'light' || customization?.displayMode === 'dark'
      ? customization.displayMode
      : 'auto';
  const isDark = mode === 'auto' ? theme.ui.isDark : mode === 'dark';
  return { mode, isDark };
}

export function resolveLandingStyle(customization: LandingCustomizationInput): LandingStyle {
  const style = customization?.landingStyle;
  return style === 'minimal' || style === 'bold' ? style : 'glass';
}

/** Neutral dark surface set used when an organizer forces dark on a light theme. */
function generatedDarkSurfaces(primary: string): LandingSurfaces {
  return {
    isDark: true,
    pageBg: `radial-gradient(ellipse 70% 50% at 50% -10%, color-mix(in srgb, ${primary} 22%, transparent) 0%, transparent 60%), linear-gradient(165deg, #0b1120 0%, #0f172a 58%, #020617 100%)`,
    surfaceBg: 'rgba(255, 255, 255, 0.045)',
    surfaceMutedBg: 'rgba(255, 255, 255, 0.025)',
    text: '#f8fafc',
    textMuted: 'rgba(248, 250, 252, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    cardShadow: '0 18px 44px rgba(0, 0, 0, 0.5)',
    glassBg: 'rgba(15, 23, 42, 0.55)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
  };
}

/** Neutral light surface set used when an organizer forces light on a dark theme. */
function generatedLightSurfaces(primary: string): LandingSurfaces {
  return {
    isDark: false,
    pageBg: `radial-gradient(ellipse 70% 50% at 50% -10%, color-mix(in srgb, ${primary} 12%, transparent) 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f4f6fb 100%)`,
    surfaceBg: '#ffffff',
    surfaceMutedBg: '#f5f7fb',
    text: '#0f172a',
    textMuted: '#475569',
    borderColor: '#e6eaf2',
    cardShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
    glassBg: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.65)',
  };
}

function resolveLandingSurfaces(
  customization: LandingCustomizationInput,
  theme = resolveEventTheme(customization)
): LandingSurfaces {
  const { isDark } = resolveDisplayMode(customization, theme);
  const primary = customization?.primaryColor || theme.primary;
  const themeIsDark = theme.ui.isDark;

  // When the requested mode matches the theme's native lightness, keep its
  // hand-tuned surfaces; otherwise synthesize a neutral set in the new mode.
  if (isDark === themeIsDark) {
    const landing = theme.landing;
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

  return isDark ? generatedDarkSurfaces(primary) : generatedLightSurfaces(primary);
}

/** Per-style overrides applied on top of the resolved surface set. */
function applyStyleOverrides(style: LandingStyle, surfaces: LandingSurfaces, primary: string): LandingSurfaces {
  if (style === 'minimal') {
    return {
      ...surfaces,
      surfaceBg: surfaces.isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      glassBg: surfaces.isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.9)',
      cardShadow: surfaces.isDark
        ? '0 1px 0 rgba(255,255,255,0.05)'
        : '0 1px 2px rgba(15,23,42,0.05)',
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
  const theme = resolveEventTheme(customization);
  const primary = customization?.primaryColor || theme.primary;
  const secondary = customization?.secondaryColor || theme.secondary;
  const style = resolveLandingStyle(customization);
  const surfaces = applyStyleOverrides(style, resolveLandingSurfaces(customization, theme), primary);
  const isDark = surfaces.isDark;
  const font = resolveLandingFont(customization?.fontFamily);
  const radius = style === 'bold' ? '1.75rem' : style === 'minimal' ? '1rem' : '1.5rem';

  return {
    ['--primary' as string]: primary,
    ['--secondary' as string]: secondary,
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
