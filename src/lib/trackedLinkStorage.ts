/** Affiliate attribution cookie — survives across days (not just the browser session). */
const AFFILIATE_COOKIE_DAYS = 30;

const cookieName = (eventId: string) => `turnout_aff_${eventId}`;
const visitMarkName = (eventId: string, code: string) =>
  `turnout_aff_visit_${eventId}_${code.toUpperCase()}`;

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function writeCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const maxAge = Math.max(1, Math.round(days * 24 * 60 * 60));
  const secure = isSecureContext() ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/** First-touch affiliate code for this event (cookie, lasts ~30 days). */
export function getTrackedLinkCode(eventId: string): string | null {
  if (typeof window === 'undefined' || !eventId) return null;
  try {
    const v = normalizeCode(readCookie(cookieName(eventId)) || '');
    return v || null;
  } catch {
    return null;
  }
}

/**
 * Persist affiliate code in a first-party cookie on the current host
 * (custom domain or app). First touch wins for the cookie lifetime.
 */
export function setTrackedLinkCode(eventId: string, code: string): void {
  if (typeof window === 'undefined' || !eventId) return;
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    if (getTrackedLinkCode(eventId)) return;
    writeCookie(cookieName(eventId), normalized, AFFILIATE_COOKIE_DAYS);
  } catch {
    // Ignore cookie blocks.
  }
}

export function readTrackedLinkCodeFromSearch(search: string | URLSearchParams): string | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  const raw = (params.get('ref') || params.get('via') || params.get('aff') || '').trim();
  const normalized = normalizeCode(raw);
  return normalized || null;
}

/**
 * Debounce visit/click recording to once per calendar day per code
 * so return landings still count without spamming every page view.
 */
export function shouldRecordTrackedLinkClick(eventId: string, code: string): boolean {
  if (typeof window === 'undefined' || !eventId) return false;
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const marked = readCookie(visitMarkName(eventId, normalized));
    return marked !== day;
  } catch {
    return true;
  }
}

export function markTrackedLinkClickRecorded(eventId: string, code: string): void {
  if (typeof window === 'undefined' || !eventId) return;
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    // Keep the mark for ~2 days so the day key stays meaningful across midnight.
    writeCookie(visitMarkName(eventId, normalized), day, 2);
  } catch {
    // Ignore.
  }
}

export const AFFILIATE_ATTRIBUTION_DAYS = AFFILIATE_COOKIE_DAYS;
