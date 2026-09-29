const storageKey = (eventId: string) => `turnout_event_access_${eventId}`;

export function getEventAccessToken(eventId: string): string | null {
  try {
    const v = sessionStorage.getItem(storageKey(eventId));
    return v && v.trim() !== '' ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setEventAccessToken(eventId: string, token: string | null | undefined): void {
  try {
    if (!token) {
      sessionStorage.removeItem(storageKey(eventId));
      return;
    }
    sessionStorage.setItem(storageKey(eventId), token);
  } catch {
    // ignore quota / private mode
  }
}

export function clearEventAccessToken(eventId: string): void {
  setEventAccessToken(eventId, null);
}

/** Optional event id for the next API calls (landing unlock flow / slug routes). */
let pendingEventAccessId: string | null = null;

export function setPendingEventAccessContext(eventId: string | null): void {
  pendingEventAccessId = eventId;
}

export function getPendingEventAccessHeader(): Record<string, string> {
  if (!pendingEventAccessId) return {};
  const token = getEventAccessToken(pendingEventAccessId);
  if (!token) return {};
  return { 'X-Event-Access-Token': token };
}

/** Attach stored access token for `/api/events/{id}/...` (and pending slug context). */
export function getEventAccessHeaderForApiPath(path: string): Record<string, string> {
  const match = path.match(/\/api\/events\/(\d+)(?:\/|$|\?)/);
  if (match?.[1]) {
    const token = getEventAccessToken(match[1]);
    if (token) return { 'X-Event-Access-Token': token };
  }
  return getPendingEventAccessHeader();
}
