/**
 * Curated Google Font pairings for landing pages.
 * Each key maps display (headline) + body families with on-demand Google load URLs.
 */

export type LandingFontKey =
  | 'fraunces'
  | 'playfair'
  | 'sora'
  | 'space-grotesk'
  | 'dm-serif'
  | 'poppins'
  | 'manrope'
  | 'outfit'
  | 'figtree'
  | 'libre-baskerville'
  | 'archivo'
  | 'raleway'
  | 'rubik'
  | 'syne'
  | 'instrument-serif';

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
    body: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Playfair+Display:wght@500;600;700;800', 'Source+Sans+3:wght@400;500;600;700'],
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
    body: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Space+Grotesk:wght@400;500;600;700', 'Plus+Jakarta+Sans:wght@400;500;600;700'],
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
  outfit: {
    key: 'outfit',
    name: 'Outfit',
    vibe: 'Soft geometric',
    display: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    body: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Outfit:wght@400;500;600;700;800'],
  },
  figtree: {
    key: 'figtree',
    name: 'Figtree',
    vibe: 'Readable modern',
    display: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    body: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Figtree:wght@400;500;600;700;800'],
  },
  'libre-baskerville': {
    key: 'libre-baskerville',
    name: 'Libre Baskerville',
    vibe: 'Classic print',
    display: '"Libre Baskerville", Georgia, serif',
    body: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Libre+Baskerville:wght@400;700', 'Nunito+Sans:wght@400;500;600;700'],
  },
  archivo: {
    key: 'archivo',
    name: 'Archivo',
    vibe: 'Strong sans',
    display: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    body: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Archivo:wght@400;500;600;700;800'],
  },
  raleway: {
    key: 'raleway',
    name: 'Raleway',
    vibe: 'Elegant sans',
    display: '"Raleway", ui-sans-serif, system-ui, sans-serif',
    body: '"Raleway", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Raleway:wght@400;500;600;700;800'],
  },
  rubik: {
    key: 'rubik',
    name: 'Rubik',
    vibe: 'Rounded utilitarian',
    display: '"Rubik", ui-sans-serif, system-ui, sans-serif',
    body: '"Rubik", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Rubik:wght@400;500;600;700;800'],
  },
  syne: {
    key: 'syne',
    name: 'Syne',
    vibe: 'Expressive display',
    display: '"Syne", ui-sans-serif, system-ui, sans-serif',
    body: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Syne:wght@500;600;700;800', 'Figtree:wght@400;500;600;700'],
  },
  'instrument-serif': {
    key: 'instrument-serif',
    name: 'Instrument Serif',
    vibe: 'Contemporary serif',
    display: '"Instrument Serif", Georgia, serif',
    body: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    googleFamilies: ['Instrument+Serif:ital@0;1', 'Outfit:wght@400;500;600;700'],
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
  outfit: 'outfit',
  figtree: 'figtree',
  'libre baskerville': 'libre-baskerville',
  archivo: 'archivo',
  raleway: 'raleway',
  rubik: 'rubik',
  syne: 'syne',
  'instrument serif': 'instrument-serif',
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
