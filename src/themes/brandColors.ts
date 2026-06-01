/** Turnout marketing brand palette (teal + lime). */
export const TURNOUT_BRAND = {
  teal900: '#052E30',
  teal800: '#074143',
  teal700: '#0D585B',
  teal600: '#126E72',
  lime500: '#C0FF72',
  lime400: '#D7FF9E',
  lime300: '#E5FFC4',
  limeSoft: 'rgba(192, 255, 114, 0.12)',
  limeLine: 'rgba(192, 255, 114, 0.18)',
  cream: '#F5F2EA',
  ink: '#0A2426',
  text: '#E9F4EE',
  textMuted: '#93B5B7',
  textSubtle: '#5C8285',
} as const;

export const TURNOUT_APP_PAGE_BG = `radial-gradient(ellipse 80% 55% at 50% -15%, rgba(192, 255, 114, 0.1) 0%, transparent 52%),
  linear-gradient(180deg, ${TURNOUT_BRAND.teal800} 0%, ${TURNOUT_BRAND.teal700} 42%, ${TURNOUT_BRAND.teal900} 100%)`;
