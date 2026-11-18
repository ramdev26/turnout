const storageKey = (eventId: string) => `turnout_tracked_link_${eventId}`;
const clickKey = (eventId: string, code: string) =>
  `turnout_tracked_link_click_${eventId}_${code.toUpperCase()}`;

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** First-touch tracked link code for this event (from ?ref= / ?via=). */
export function getTrackedLinkCode(eventId: string): string | null {
  if (typeof window === 'undefined' || !eventId) return null;
  try {
    const v = normalizeCode(sessionStorage.getItem(storageKey(eventId)) || '');
    return v || null;
  } catch {
    return null;
  }
}

export function setTrackedLinkCode(eventId: string, code: string): void {
  if (typeof window === 'undefined' || !eventId) return;
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    // First touch wins for the session.
    if (getTrackedLinkCode(eventId)) return;
    sessionStorage.setItem(storageKey(eventId), normalized);
  } catch {
    // Ignore quota / private mode.
  }
}

export function readTrackedLinkCodeFromSearch(search: string | URLSearchParams): string | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  const raw = (params.get('ref') || params.get('via') || '').trim();
  const normalized = normalizeCode(raw);
  return normalized || null;
}

/** True if this browser session has not yet recorded a click for this code. */
export function shouldRecordTrackedLinkClick(eventId: string, code: string): boolean {
  if (typeof window === 'undefined' || !eventId) return false;
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  try {
    return sessionStorage.getItem(clickKey(eventId, normalized)) !== '1';
  } catch {
    return true;
  }
}

export function markTrackedLinkClickRecorded(eventId: string, code: string): void {
  if (typeof window === 'undefined' || !eventId) return;
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    sessionStorage.setItem(clickKey(eventId, normalized), '1');
  } catch {
    // Ignore.
  }
}
