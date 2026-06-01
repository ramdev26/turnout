/**
 * Curated typography pairings organizers can pick for their landing page.
 * Each font key maps a display (headline) family with a body family and the
 * Google Fonts query needed to load them on demand.
 */

export type LandingFontKey =
  | 'fraunces'
  | 'playfair'
  | 'sora'
  | 'space-grotesk'
  | 'dm-serif'
  | 'poppins'
  | 'manrope';

export type LandingFontDefinition = {
  key: LandingFontKey;
  name: string;
  /** Short descriptor shown in the picker */
  vibe: string;
  /** CSS font-family stack for headlines / display */
  display: string;
  /** CSS font-family stack for body copy */
  body: string;
  /** Google Fonts `family=` query fragments to load (already URL-ready) */
  googleFamilies: string[];
};

export const LANDING_FONTS: Record<LandingFontKey, LandingFontDefinition> = {
  fraunces: {
    key: 'fraunces',
    name: 'Fraunces',
    vibe: 'Editorial serif',
    display: '"Fraunces", Georgia, "Times New Roman", serif',
    body: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: [
      'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700',
      'Plus+Jakarta+Sans:wght@400;500;600;700',
    ],
  },
  playfair: {
    key: 'playfair',
    name: 'Playfair',
    vibe: 'Luxe & classic',
    display: '"Playfair Display", Georgia, serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Playfair+Display:wght@500;600;700;800', 'Inter:wght@400;500;600;700'],
  },
  sora: {
    key: 'sora',
    name: 'Sora',
    vibe: 'Modern & techy',
    display: '"Sora", ui-sans-serif, system-ui, sans-serif',
    body: '"Sora", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Sora:wght@400;500;600;700;800'],
  },
  'space-grotesk': {
    key: 'space-grotesk',
    name: 'Space Grotesk',
    vibe: 'Bold & geometric',
    display: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Space+Grotesk:wght@400;500;600;700', 'Inter:wght@400;500;600;700'],
  },
  'dm-serif': {
    key: 'dm-serif',
    name: 'DM Serif',
    vibe: 'Refined & dramatic',
    display: '"DM Serif Display", Georgia, serif',
    body: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['DM+Serif+Display:ital@0;1', 'DM+Sans:wght@400;500;600;700'],
  },
  poppins: {
    key: 'poppins',
    name: 'Poppins',
    vibe: 'Friendly & rounded',
    display: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    body: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Poppins:wght@400;500;600;700;800'],
  },
  manrope: {
    key: 'manrope',
    name: 'Manrope',
    vibe: 'Clean & corporate',
    display: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    body: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Manrope:wght@400;500;600;700;800'],
  },
};

export const LANDING_FONT_KEYS = Object.keys(LANDING_FONTS) as LandingFontKey[];

export const DEFAULT_LANDING_FONT: LandingFontKey = 'fraunces';

/** Legacy `fontFamily` values stored on older events map onto a curated key. */
const LEGACY_FONT_ALIASES: Record<string, LandingFontKey> = {
  inter: 'manrope',
  'plus jakarta sans': 'fraunces',
  fraunces: 'fraunces',
  playfair: 'playfair',
  'playfair display': 'playfair',
  sora: 'sora',
  'space grotesk': 'space-grotesk',
  poppins: 'poppins',
  manrope: 'manrope',
  'dm serif': 'dm-serif',
  'dm serif display': 'dm-serif',
};

export function isLandingFontKey(value: string | undefined | null): value is LandingFontKey {
  return !!value && value in LANDING_FONTS;
}

export function resolveLandingFontKey(fontFamily: string | undefined | null): LandingFontKey {
  if (isLandingFontKey(fontFamily)) return fontFamily;
  const normalized = (fontFamily || '').trim().toLowerCase();
  return LEGACY_FONT_ALIASES[normalized] || DEFAULT_LANDING_FONT;
}

export function resolveLandingFont(fontFamily: string | undefined | null): LandingFontDefinition {
  return LANDING_FONTS[resolveLandingFontKey(fontFamily)];
}

const loadedFonts = new Set<string>();

/**
 * Inject a Google Fonts stylesheet for the chosen pairing (idempotent).
 * Safe to call repeatedly; only loads each unique family set once.
 */
export function loadLandingFont(fontFamily: string | undefined | null): void {
  if (typeof document === 'undefined') return;
  const font = resolveLandingFont(fontFamily);
  const query = font.googleFamilies.map((f) => `family=${f}`).join('&');
  if (!query || loadedFonts.has(query)) return;
  loadedFonts.add(query);

  const href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  if (document.querySelector(`link[data-landing-font="${font.key}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.landingFont = font.key;
  document.head.appendChild(link);
}
